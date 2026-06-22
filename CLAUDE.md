# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Luminar

AI-powered educational platform. Transforms a topic prompt or an uploaded/linked source → an interactive multimedia "luminar" (animated SVG scenes + TTS audio) via a multi-agent pipeline. **v1 is a student-only consumer learning platform** ("video + AI"): generate → review script → approve → watch with inline adaptive quizzes → track mastery/portfolio. Adaptive learning (mastery tracking) and real-time generation progress via WebSocket are live.

**Deferred (code may exist but is NOT wired/live in v1):** teacher accounts & authored tests, standalone graded tests, sharing/enrollment, chat-against-luminar, knowledge-graph visualization, study rooms, Anki export, teach-back, Dodo subscription. See `docs/PLAN.md` for the roadmap. Do not treat these as current features.

## Dev Commands

### Full stack (recommended)
```bash
docker-compose up
```
- Redis: 6379
- Backend API: 8000 (uvicorn hot-reload)
- Frontend: 5173 (Vite dev)

> Background jobs run **in-process via APScheduler** (`app/core/scheduler.py`) — there is no separate worker. Celery/Redis were removed (broken/orphaned). If durable cross-restart job queuing is needed later, reintroduce a real queue (see `docs/PLAN.md` §3.2).

### Backend only
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # fill in keys
uvicorn app.main:app --reload
# No separate worker needed — APScheduler runs jobs in-process on app startup.
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
npm run build      # tsc + vite build
npm run lint       # eslint, 0 warnings allowed
npm run preview    # preview production build
```

### DB migrations
```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "description"
```

## Architecture

### Multi-Agent Pipeline (PydanticAI)

Generation runs in **two phases** orchestrated by `backend/app/jobs/luminar_jobs.py` (scheduled on APScheduler). Agents live in `backend/app/agents/` and use **PydanticAI + OpenAI GPT-4o**.

**Phase 1 — `generate_script_job` (cheap):** extract source → Orchestrator blueprint → Script → persist scenes. Status → `script_ready`. User reviews & approves.

**Phase 2 — `generate_assets_job` (expensive, on approval):**
```
  └─ per scene (parallelized):
       SVGAnimator    → 800×450 animated SVG (CSS @keyframes)
       QualityReview  → validates SVG/narration alignment, retries if fails (capped)
       TTS            → MP3 audio via OpenAI TTS-1-HD (dialogue mode stitches voices via pydub)
       upload → S3
  then QuizGen → inline gated quiz cards on the cumulative timeline
```
Status → `ready`. Progress broadcasts via WebSocket at `/api/v1/luminars/ws/{luminar_id}` through the in-process `app/core/ws_manager.py`.

Agents present but **dormant in v1** (defined, not wired into the live flow): `code_gen`, `citation` (persistence TBD — see PLAN §3.3), `concept_extractor`, `teach_back_evaluator`.

### Adaptive Learning

`backend/app/services/adaptive_engine.py` manages mastery scores (0.0–1.0) per concept per user:
- Quiz correct → +0.15, incorrect → -0.1
- Teach-back evaluation → score-based adjustment
- Re-exposure → +0.05
- Weak areas (mastery < 0.5) fed back into Orchestrator to tailor next video

### Data Model

```
User → Luminar → Scene → QuizCard
User → QuizAttempt (→ Luminar, QuizCard)
User → ConceptNode            (mastery 0–1; ConceptEdge not yet defined)
User ↔ Luminar (UserFavorite)
StudyRoom / StudyParticipant  (models exist; feature deferred)
```

Models in `backend/app/models/` (`user`, `luminar`, `scene`, `quiz`, `study_room`, `knowledge_graph`, `user_favorite`). `video.py` is a backward-compat alias: `from luminar import Luminar as Video`. Async SQLAlchemy 2.x + asyncpg + PostgreSQL 16, AuditMixin adds `created_at`/`updated_at`/`deleted`. `luminar.status`: `pending → script_generating → script_ready → assets_generating → ready | failed`.

### Frontend Routing

TanStack Router (file-based). Routes in `frontend/src/routes/`:
- `/` → landing page; `/signin`, `/auth/callback` → Google OAuth
- `/_authenticated/*` → protected layout (AppShell + sidebar). Sidebar links: My Luminars, Create, Profile.
- `/home` → my luminars / favorites / recent
- `/create` → prompt form + source upload (PdfDropzone)
- `/generating/$jobId` → live WebSocket progress (+ polling fallback)
- `/script-review/$luminarId` → review & approve script (triggers Phase 2)
- `/watch/$luminarId` → player (SceneRenderer + inline `<audio>` sync + QuizOverlay + CaptionOverlay + CitationsPanel)
- `/profile/$userId` → profile + portfolio (quiz accuracy)
- `/knowledge`, `/social`, `/library` → **stubs that redirect to `/home`** (deferred features; not linked in nav)

Audio is played via an inline `<audio>` ref in the watch route (an 80ms ticker syncs `currentTime`→`positionMs`); there is no separate `AudioEngine` component. Route tree auto-generated to `routeTree.gen.ts` by the Vite plugin — do not edit manually.

### Auth

**Google OAuth 2.0 → JWT** (python-jose HS256, in `backend/app/core/security.py`; signin + `/auth/google/callback` in `app/api/v1/auth.py`). Backend dependency `get_current_user` decodes the Bearer JWT and looks up the user. **Supabase is NOT used for auth** — only for S3 storage. Frontend stores token + user in `localStorage`; `useAuth` hook + `AuthProvider` in `frontend/src/hooks/`. No roles in v1 (every user is a learner); schema is role-ready for later.

### Storage

All media (SVG, MP3) → Supabase S3 (S3-compatible, via boto3) in `backend/app/services/storage.py`.

## Key Config

Backend env vars (see `backend/.env.example`): `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SUPABASE_URL`, `S3_*` (endpoint/key/secret/bucket), `APP_URL`. `REDIS_URL` is present but only relevant if Celery is revived.

Frontend env vars: `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`. (No Supabase client in the frontend.)

Config loaded via pydantic-settings in `backend/app/core/config.py`. Path alias `@` → `frontend/src`.

## SVG Animator Constraints

When modifying `svg_animator.py`: SVGs must be self-contained (no external resources), 800×450, educational color palette (soft blues/greens/ambers), CSS `@keyframes` only (no JS). Quality review agent validates these before accepting output.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
