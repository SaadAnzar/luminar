# Luminar — Product & Engineering Plan

> Last updated: 2026-06-21

## 0. Stated assumptions (veto any line if wrong)

Decisions confirmed in planning, frozen for v1:

1. **Visual engine stays SVG + CSS keyframes + TTS audio.** No native video-gen models in v1. We polish the existing pipeline. (A native-video renderer is a deferred roadmap item, swappable per-scene later.)
2. **v1 is a student-only consumer learning platform: "video + AI".** No teacher signup, no roles, no classrooms, no standalone graded tests, no share-with-students/enrollment.
3. **Assessment in v1 = inline mid-video quizzes only** (the existing gated quiz model + adaptive mastery). Teacher-authored tests, grading dashboards, and sharing are deferred to Phase 2+.
4. **No chat-against-luminar in v1.** Deferred to Phase 3 (RAG over the luminar).
5. **Dodo subscription is deferred.** Build feature-complete free first; add billing/paywall later.
6. **Ingestion is an explicit v1 requirement** for the source types the user enumerated — see §3.1 for the exact v1 set and the one assumption (YouTube) flagged for confirmation.

The full original vision (teachers authoring questions, sharing links, student tests, grading) is **captured in §5 as the roadmap, explicitly not-now.**

---

## 1. What already works (the spine — do not rebuild)

The codebase is far more complete than it looks from git status. Baseline that already functions:

**Backend (`backend/app/`)**
- **Two-phase generation pipeline** (`jobs/video_jobs.py`): Phase 1 `generate_script_job` (cheap — extract source → orchestrator blueprint → script → persist scenes, status `script_ready`) → user approves → Phase 2 `generate_assets_job` (expensive — per-scene SVG + quality-review/retry + TTS + S3 upload, build quiz timeline, status `ready`).
- **11 PydanticAI agents** (GPT-4o) in `agents/`: orchestrator, script, svg_animator, quality_review, tts (dialogue mode + pydub stitching), quiz_gen, citation, code_gen, concept_extractor, teach_back_evaluator, data_extractor.
- **Auth**: Google OAuth 2.0 → JWT (python-jose HS256, 30-day), `get_current_user` dependency. (Supabase is used only for S3 storage, **not** auth.)
- **Working API routers** (`api/v1/`): luminars (generate/approve/get/scenes/ws), videos (legacy alias), auth, quiz (cards + attempt → mastery update), social (feed), profiles, favorites, portfolio.
- **Models** (`models/`): User, Luminar, Scene, QuizCard, QuizAttempt, StudyRoom/Participant, ConceptNode, UserFavorite. Async SQLAlchemy 2.x + asyncpg + Postgres 16, Alembic migrations.
- **Adaptive engine** (`services/adaptive_engine.py`): mastery 0–1 per concept; quiz ±, teach-back, re-exposure, weak-area feedback into orchestrator.
- **Infra**: APScheduler (in-memory) job runner, in-process WebSocket manager (`core/ws_manager.py`), S3 storage (`services/storage.py`).
- **Ingestion**: PDF (pdfplumber), TXT, PPT (python-pptx), blog (httpx + BeautifulSoup) via `data_extractor` agent.

**Frontend (`frontend/src/`)** — React 19, TanStack Router/Query, shadcn/Radix, framer-motion, Zod, axios.
- Working routes: landing, signin, OAuth callback, `_authenticated/home`, `create`, `watch/$luminarId` (SVG + `<audio>` sync via 80ms ticker, quiz gates, captions, citations), `generating/$jobId` (WebSocket progress + polling fallback), `script-review/$luminarId` (approve), `profile/$userId`.
- Working components: SceneRenderer, PlayerControls, QuizOverlay, CaptionOverlay, CitationsPanel, PdfDropzone, LuminarCard, AppShell/Sidebar, motion utilities.
- Auth via localStorage + context (`useAuth`), API client in `lib/api.ts`, Zod schemas in `lib/schemas.ts`.

**Conclusion: this is a polish + close-gaps effort, not a from-scratch build.**

---

## 2. Known breakage — and why most of it is "delete," not "fix"

The inventory flagged broken modules. **Almost all belong to features we just deferred.** For v1 the action is to *remove the broken surface*, not repair it.

| Module | State | v1 action |
|---|---|---|
| `api/v1/rooms.py` | Missing `StudyRoom`/`StudyParticipant` imports | **Remove from router registration** (study rooms = Phase 4) |
| `api/v1/export.py` | Imports nonexistent `agents/flashcard_gen` | **Remove route** (Anki export = later) |
| `api/v1/knowledge.py` | Imports nonexistent `ConceptEdge` | **Remove route** (knowledge graph = Phase 3) |
| teach_back_evaluator agent | No endpoint wired | **Leave agent dormant**, no endpoint (teach-back = later) |
| Frontend `/knowledge`, `/social`, `/library` | Stub → redirect `/home` | **Hide nav entries**; keep redirect or remove routes |
| Citation persistence | Agent runs, no table | Decide in §3.3 — either persist or render transiently |

**Guardrail: do not schedule repairs of deferred-feature code in the v1 budget.** The single v1 cleanup task is "ensure no broken/dead route is reachable and no stub page is linked in nav."

---

## 3. v1 workstreams (what we ship)

### 3.1 Ingestion completeness (named workstream — explicit user requirement) — ✅ IMPLEMENTED

**Status:** all six v1 source types are wired end-to-end (backend extractor + dispatch + endpoint validation + CHECK constraint/migration + frontend create UI + Zod schema + card labels). Also fixed two latent bugs: `python-pptx` and `beautifulsoup4` were imported but **missing from `requirements.txt`** (PPT + blog extraction were silently failing to empty). YouTube uses caption/transcript fetch only (`youtube-transcript-api`); the **Whisper-on-downloaded-audio fallback is deferred to v1.5** (avoids a `yt-dlp` dependency + bot-detection surface) — videos with no captions return a clear error. Empty/garbage extraction now raises `ExtractionError` → luminar marked `failed` with a reason broadcast over WebSocket. Migration `0002_extend_source_types` must be applied to the live Supabase DB (`alembic upgrade head` or equivalent MCP migration).

User enumerated: **txt, doc, pdf, blog url, website url, youtube link.** Coverage:

| Source | Status | v1 plan |
|---|---|---|
| PDF | ✅ pdfplumber | keep; add size/page guardrails (already ~40MB/60pg in dropzone) |
| TXT | ✅ | keep |
| PPT (.pptx) | ✅ python-pptx | keep (bonus, user didn't ask but it's free) |
| **.doc / .docx** | ❌ | **add** — `python-docx` for .docx; `.doc` (legacy binary) optional, recommend rejecting with a clear message or converting via `textract`/libreoffice headless |
| Blog URL | ✅ httpx + BeautifulSoup | keep |
| **Generic website URL** | ⚠️ only "blog" path | **generalize** — readability-style main-content extraction (e.g. `trafilatura` or `readability-lxml`) so arbitrary pages work, not just blog markup |
| **YouTube link** | ❌ | **add** — `youtube-transcript-api` for captions; **fallback to Whisper** on downloaded audio when no captions. `whisper_service.py` already exists but is unused — **wire it here.** |

**Assumption (not blocking — correct me in one line):** all six are v1. If YouTube proves heavy (yt-dlp + transcript API + whisper fallback + rate limits/bot-detection), it slips to **v1.5** while the other five ship. Everything else is squarely v1.

Tasks:
- Extend `source_type` enum + `data_extractor` agent dispatch for docx / generic-website / youtube.
- Frontend `create` flow: add the new source-type options + URL input validation per type.
- Unify upload limits + friendly errors (oversized, unparseable, empty extraction, YouTube no-transcript).

### 3.2 Generation flow hardening (the core loop must be bulletproof) — ✅ IMPLEMENTED

The two-phase flow works but is the product's beating heart. Done:
- **Job durability / restart recovery**: `recover_stuck_luminars()` runs in the FastAPI lifespan after the scheduler starts — any luminar left in a transient status (`pending`/`script_generating`/`assets_generating`) by a crash/restart is marked `failed` (in-memory APScheduler jobs don't survive a restart), so the UI never hangs and the owner can retry. APScheduler retained as the v1 runner (documented in CLAUDE.md).
- **Failure UX + retry**: `POST /luminars/{id}/retry` re-runs the correct phase — Phase 2 (assets) if the script/scenes already exist, else Phase 1. File-source Phase-1 retries re-download the original upload from its stored S3 url (`_download_bytes`), since the in-memory upload bytes are gone. Frontend: the `generating` page shows the real failure message (broadcast over WS) and a **Retry** button (restarts polling); failed cards on `home` link here.
- **Partial-asset resilience**: a single scene's SVG/TTS failure now **degrades that scene** (null asset urls → player falls back to placeholder + estimated duration) instead of failing the whole luminar. Only a total wipeout (every scene failed) is fatal; partial failures broadcast "N of M scenes degraded — continuing" and the luminar still reaches `ready`.
- **Progress fidelity**: both phases broadcast meaningful messages incl. failure reasons.
- **Quality-review bounds**: SVG QA is a single bounded retry (not a loop) — no infinite-retry / token-burn risk. Left as-is.

Not done (acceptable for v1): no `failed`-reason column persisted (reason is broadcast, not stored — a watcher who wasn't connected sees only the generic state); no per-scene retry UI (retry re-runs the whole phase).

### 3.3 Player + learning polish — ✅ IMPLEMENTED

- **Citations decision: removed.** `CitationsPanel` was orphan dead code (defined, imported nowhere, the `citation` agent isn't wired into Phase 2, and no `SceneCitation` table exists). Deleted it; citations now belong to **Phase 3** alongside the citation agent + a `SceneCitation` table.
- **Chaptered timeline** — replaced the flat slider with a custom seekable scrubber that renders **scene-boundary ticks** and **amber quiz-gate markers**, so the luminar reads as a real chaptered learning video. Drag + click to seek.
- **Keyboard shortcuts** — space (play/pause, or replay when finished), ←/→ (prev/next scene), m (mute); ignored while a quiz overlay is open or focus is in an input.
- **Non-ready guard** — visiting `/watch` on a non-ready luminar now shows a polished state (spinner for in-progress → link to `/generating`; alert for failed → "View & retry") instead of a broken empty player.
- **End-of-luminar completion overlay** — replay + "explore next" chips (from existing `suggested_next_topics`) + back-to-home.
- Inline quiz UX (hint, explanation, mastery feedback) already solid; left as-is.
- **Pre-existing build breakers fixed** (the frontend did not compile before this pass — `npm run build` failed): stale `/watch/$videoId` route refs + `videoId` params in `profile.$userId.tsx`, renamed portfolio field `by_video`→`by_luminar`, a Zod-4 `z.record(...)` arity break in `schemas.ts`, and the dead `VideoCard.tsx` (deleted, like `CitationsPanel`). **`npm run build` is now green.**

Deferred: resume/last-watched position; a deeper mobile pass (layout is responsive but not yet tuned for small screens).

#### 3.3a Player render bug — ✅ FIXED (post-launch)

Real luminars showed a **blank scene area** (no SVG/animation) and captions hidden. Root cause, found by cloning a real prod luminar into the local harness: **Supabase Storage serves stored SVGs with `Content-Disposition: attachment` and `CSP: default-src 'none'; sandbox`** (its anti-XSS default), so `<object data=svg>` renders blank and the SVG's inline `@keyframes` are blocked.
- **Fix:** `SceneRenderer` now **fetches the SVG text (CORS is open) and inlines it** (sanitized: `<script>`/`on*` stripped; fixed `width/height` dropped so the viewBox scales). The SVG then lives in the host document — renders, scales, and animates under the app CSP. This repairs **every already-generated luminar** with no re-render.
- Also fixed: captions were positioned `bottom-14`, colliding with the taller WS4 controls bar → moved to `bottom-28` (now visible above controls).
- Verified in the harness against a **real** cloned luminar (SVG renders + animates, captions show, audio advances) and via `player.spec` (quiz gates).
- **Not a bug — design note:** inline quizzes fire at *scene boundaries* (`trigger_at_ms` = scene end), which for typical 27–36s scenes means the first quiz only pops ~30s in. That's why quizzes "seemed not to pop." Consider mid-scene checkpoints or a "next quiz at…" affordance (Phase 2 polish).
- Optional backend hygiene (not required — client fix is complete): set `ContentDisposition='inline'` on SVG uploads in `storage.py` so direct links also render.

> **Lint: ✅ now green (0 problems).** Fixed via `eslint.config.js` — `react-refresh/only-export-components` is exempted for `src/routes/**` (TanStack `Route`+component pattern) and `src/components/ui/**` (shadcn cva variant exports), with `allowConstantExport`/`allowExportNames:['Route']` globally. The handful of React-Compiler-tier hook lints were fixed in code (non-mutating `useMemo`, `Date.now` moved out of render, latest-ref via effect, `catch` comments); one documented reset-on-scene-change effect uses a single justified inline disable.

### 3.6 Full-loop QA — ✅ STATIC PASS

- **Contract trace** create→generate→approve→assets→watch→quiz→mastery→profile: backend response schemas (`LuminarInDB`, `SceneOut`, `QuizAttemptResponse`, `PortfolioResponse`) vs frontend Zod schemas all align; quiz `getCards` returns `scene_id` (badge + timeline markers work) and correctly **omits** `correct_index`/`explanation` (no answer leak). Status machine values match across both sides.
- **Automated checks**: backend imports clean (17 routes incl. `/retry`); frontend `npm run build` green; `npm run lint` 0 problems; Vite dev server serves the app (HTTP 200, bundle loads).
- **Not done — live e2e**: `DATABASE_URL` targets the **production Supabase** DB and no headless browser is installed, so rendering the authenticated player with real data would require generating a luminar (spends OpenAI credits + writes prod DB/storage) or seeding prod — neither done unprompted. Recommend a local Postgres + seed script + Playwright for a safe visual/e2e harness.
- Polish: fixed placeholder `<title>vite-app</title>` → "Luminar — Learn anything, beautifully" + meta description.

### 3.4 Auth & account polish — ✅ IMPLEMENTED

- **401 response interceptor** (`lib/api.ts`): any 401 (expired/invalid/missing JWT) now clears the stored token+user and bounces to `/signin` (full reload resets in-memory auth), with a loop guard. Previously a dead 30-day token left the user "logged in" with silent failures and no re-auth path.
- **Client-side JWT expiry check** (`isTokenExpired`): the `_authenticated` route guard now rejects an expired token up front (clears storage + redirects) instead of flashing authed UI before the first 401. Backend still validates every request — this is purely a UX pre-check.
- Profile/portfolio verified end-to-end (the `by_video`→`by_luminar` + `/watch/$videoId`→`$luminarId` breakers fixed in §3.3).
- **No roles in v1** — every user is a learner; schema stays role-ready for Phase 2.

### 3.5 Cleanup & correctness

- Remove/disable deferred-feature routes (§2).
- **Update CLAUDE.md** — it's stale: claims Celery (actually APScheduler) and Supabase auth (actually Google OAuth + python-jose). Fix so future work doesn't inherit the fiction.
- De-dupe `luminars.py` vs `videos.py` (legacy alias) — keep one, alias the other, or document. (`videos.py` is currently not registered in `api/v1/router.py`, so it's harmless dead code.)
- **Orphaned Celery/Redis — DONE (removed).** The broken `worker` service + `redis` service were deleted from `docker-compose.yml`, and `celery`/`redis` deps + `REDIS_URL` env removed. APScheduler (`core/scheduler.py`) is the sole in-process job runner. If durable cross-restart queuing becomes a hard requirement, reintroduce a real queue (ties into §3.2 job-durability).
- Rebuild the code-review-graph (stale: 43 files, last update May).

---

## 4. v1 data model deltas

Mostly additive and small:
- `luminar.source_type`: extend enum → add `docx`, `website`, `youtube`.
- `SceneCitation` table (if §3.3 persists citations): `id, scene_id FK, luminar_id FK, claim, source_url, source_type`.
- (Optional) `WatchProgress`: `user_id, luminar_id, position_ms, scene_index, updated_at`.
- Alembic migration per change; no destructive changes to existing tables.

---

## 5. Roadmap — the full vision, sequenced and explicitly not-now

This is where the user's complete original ask lives. Each phase is independently shippable.

**Phase 2 — Teachers, authored questions, tests & grading**
- Add `role` (learner/teacher) — schema already easy to extend on User.
- Teacher question authoring: edit/add/remove quiz items (question, options, correct index, hint, explanation) on a luminar; seed from AI-generated, teacher edits. (quiz_gen already produces the seed; need CRUD + editor UI.)
- **Standalone test/assignment** entity distinct from inline quizzes: curated item set, attempt model, scoring, time-to-answer already tracked in `QuizAttempt`.
- **Grading**: per-student score, attempts, accuracy, hint-usage; teacher gradebook view.
- **Sharing/enrollment**: share-link or class-code → student joins → roster → per-student results. (StudyRoom model + 8-char code already exist — repurpose.)

**Phase 3 — Knowledge graph + chat-over-luminar + teach-back**
- Define missing `ConceptEdge` model; persist `concept_extractor` relationships; build `/knowledge` graph (React Flow + `@xyflow/react` already a dep).
- **Chat-against-luminar (RAG)**: ground on the luminar's script/narration/captions + extracted source; cite scenes. Bounded scope.
- Wire the dormant `teach_back_evaluator` agent to an endpoint + `TeachBackModal` UI.

**Phase 4 — Social & collaboration**
- Study rooms (real-time, WebSocket) — fix `rooms.py`, add WS handler.
- Anki export — build `flashcard_gen` agent, fix `export.py`.
- Social feed/follow, library.

**Phase 5 — Monetization**
- **Dodo Payments** subscription: tiers, paywall (e.g. generations/month, advanced sources, native-video), webhook handling, entitlement checks in `get_current_user` path.

**Phase 6 — Native video renderer (optional)**
- Per-scene pluggable renderer: SVG (default) | native model (Veo/Sora/Runway/Kling). Cost/latency-gated, likely paid-tier only. Designed as a swap at the asset-generation layer so the rest of the pipeline is unchanged.

---

## 6. Risks & watch-items

- **YouTube ingestion fragility**: transcript API rate limits / bot detection / no-caption videos. Whisper fallback adds cost + latency. Biggest v1 unknown → the v1.5 escape hatch.
- **Token/cost burn**: SVG quality-review retries and large source extraction (8k char cap exists). Keep caps; add per-user generation limits before opening signups (also the natural Dodo paywall lever later).
- **Job durability** on restart (APScheduler in-memory) — acceptable at v1 scale if status recovery from DB is solid.
- **GPT-4o dependency**: single-provider; structured PydanticAI outputs reduce parse risk. Fine for v1.
- **Stale docs/graph** misleading future contributors — fixed in §3.5.

---

## 7. Suggested v1 execution order

1. Cleanup & correctness (§3.5) — fast, removes broken surface, unblocks clean dev.
2. Ingestion completeness (§3.1) — docx + generic website first, YouTube last (slip to v1.5 if heavy).
3. Generation flow hardening (§3.2) — failure UX, partial-asset resilience, job recovery.
4. Player + learning polish (§3.3) + citations decision.
5. Auth/account polish (§3.4).
6. QA pass on the full student loop: create → (source) → script-review → approve → generate → watch → inline quizzes → mastery → profile.

Then Phase 2 planning when teacher/test/grading is greenlit.
