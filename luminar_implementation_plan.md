# Luminar — Full Implementation Plan

> AI-powered animated learning video platform with adaptive quizzes, knowledge graphs, and intuitive learning features.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema](#4-database-schema)
5. [Backend Implementation](#5-backend-implementation)
   - 5.1 [FastAPI App Setup](#51-fastapi-app-setup)
   - 5.2 [Authentication](#52-authentication)
   - 5.3 [Agent System (PydanticAI)](#53-agent-system-pydanticai)
   - 5.4 [Job Queue (Celery + Redis)](#54-job-queue-celery--redis)
   - 5.5 [API Endpoints](#55-api-endpoints)
   - 5.6 [WebSocket (Progress Streaming)](#56-websocket-progress-streaming)
6. [Frontend Implementation](#6-frontend-implementation)
   - 6.1 [Project Setup](#61-project-setup)
   - 6.2 [Routing Structure](#62-routing-structure)
   - 6.3 [Core Components](#63-core-components)
   - 6.4 [Video Player Engine](#64-video-player-engine)
   - 6.5 [Quiz Overlay System](#65-quiz-overlay-system)
   - 6.6 [Knowledge Graph View](#66-knowledge-graph-view)
7. [Feature Implementation Details](#7-feature-implementation-details)
   - 7.1 [Video Generation Pipeline](#71-video-generation-pipeline)
   - 7.2 [Adaptive Difficulty](#72-adaptive-difficulty)
   - 7.3 [Explain It Differently](#73-explain-it-differently)
   - 7.4 [Source Citation Layer](#74-source-citation-layer)
   - 7.5 [Teach It Back Mode](#75-teach-it-back-mode)
   - 7.6 [Live Coding Scenes (CS topics)](#76-live-coding-scenes-cs-topics)
   - 7.7 [Multi-voice Dialogue Mode](#77-multi-voice-dialogue-mode)
   - 7.8 [Study Rooms (Collaborative Watch)](#78-study-rooms-collaborative-watch)
   - 7.9 [Spaced Repetition Export](#79-spaced-repetition-export)
   - 7.10 [Teacher / Course Builder Mode](#710-teacher--course-builder-mode)
   - 7.11 [Social Features](#711-social-features)
8. [Environment Variables](#8-environment-variables)
9. [Build & Run Instructions](#9-build--run-instructions)
10. [Phase-by-Phase Build Order](#10-phase-by-phase-build-order)

---

## 1. Product Overview

**Luminar** is a learning platform where users submit a topic prompt (optionally with a PDF) and receive an animated educational video — SVG animations synced with AI voiceovers — instead of a wall of text. The experience is interactive: quizzes gate progress, knowledge graphs track what users know, and multiple advanced modes (live coding, dialogue narration, "teach it back") deepen learning.

### Core user flow

1. User enters a prompt ("How does JavaScript work asynchronously?") + optional PDF + duration (2 min / 5 min) + options (quiz toggle, voice style, dialogue mode).
2. Backend kicks off a Celery job that runs the agent pipeline: Orchestrator → Script → (SVG Agent + TTS Agent + Quiz Agent in parallel) → Combiner.
3. Frontend polls/listens via WebSocket and shows live progress.
4. User watches the generated video in a custom SVG+audio player.
5. Quiz cards pop up at gated scenes. User must answer correctly to continue.
6. After completion: "Teach It Back" prompt, source citations panel, spaced repetition export.
7. User can favourite, publish to community feed, or add to a course.

---

## 2. Tech Stack

### Backend

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Framework        | FastAPI (Python 3.12+)                         |
| Agents           | PydanticAI                                     |
| AI model         | OpenAI GPT-4o (`gpt-4o`)                       |
| TTS              | OpenAI TTS API (`tts-1-hd`)                    |
| STT (teach-back) | OpenAI Whisper API                             |
| Job queue        | Celery 5.x                                     |
| Message broker   | Redis 7                                        |
| ORM              | SQLAlchemy 2.x (async) with Alembic migrations |
| Database         | PostgreSQL 16                                  |
| File storage     | Cloudflare R2 (S3-compatible)                  |
| Auth             | JWT (python-jose) + bcrypt                     |
| WebSocket        | FastAPI native WebSocket                       |
| PDF parsing      | pymupdf4llm                                    |
| HTTP client      | httpx (async)                                  |
| Validation       | Pydantic v2                                    |

### Frontend

| Layer                     | Technology                             |
| ------------------------- | -------------------------------------- |
| Build tool                | Vite                                   |
| Framework                 | React                                  |
| Routing                   | TanStack Router (file-based)           |
| Server state              | TanStack Query                         |
| Styling                   | Tailwind CSS v4                        |
| Component library         | shadcn/ui                              |
| Code editor (live coding) | Monaco Editor (`@monaco-editor/react`) |
| Graph visualisation       | React Flow (`@xyflow/react`)           |
| Audio                     | Web Audio API (native)                 |
| Icons                     | Lucide React                           |
| Form handling             | React Hook Form + Zod                  |

---

## 3. Repository Structure

```
luminar/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Settings via pydantic-settings
│   │   ├── database.py               # Async SQLAlchemy engine + session
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── video.py
│   │   │   ├── scene.py
│   │   │   ├── quiz.py
│   │   │   ├── knowledge_graph.py
│   │   │   ├── course.py
│   │   │   └── study_room.py
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   │   ├── video.py
│   │   │   ├── quiz.py
│   │   │   ├── user.py
│   │   │   └── course.py
│   │   ├── routers/                  # FastAPI routers
│   │   │   ├── auth.py
│   │   │   ├── videos.py
│   │   │   ├── scenes.py
│   │   │   ├── quiz.py
│   │   │   ├── knowledge.py
│   │   │   ├── courses.py
│   │   │   ├── social.py
│   │   │   ├── study_rooms.py
│   │   │   └── export.py
│   │   ├── agents/                   # PydanticAI agent definitions
│   │   │   ├── orchestrator.py
│   │   │   ├── script.py
│   │   │   ├── svg_animator.py
│   │   │   ├── tts.py
│   │   │   ├── quiz_gen.py
│   │   │   ├── combiner.py
│   │   │   ├── quality_review.py
│   │   │   ├── citation.py
│   │   │   ├── concept_extractor.py
│   │   │   └── teach_back_evaluator.py
│   │   ├── tasks/                    # Celery tasks
│   │   │   ├── celery_app.py
│   │   │   ├── generate_video.py
│   │   │   └── regenerate_scene.py
│   │   ├── services/                 # Business logic
│   │   │   ├── storage.py            # R2/S3 upload/download
│   │   │   ├── pdf_parser.py
│   │   │   ├── adaptive_engine.py
│   │   │   └── progress_publisher.py
│   │   └── websocket/
│   │       └── manager.py
│   ├── alembic/                      # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── routes/                   # TanStack Router file-based routes
│   │   │   ├── index.tsx             # / home feed
│   │   │   ├── create.tsx            # /create
│   │   │   ├── generating.$jobId.tsx # /generating/:jobId
│   │   │   ├── watch.$videoId.tsx    # /watch/:videoId
│   │   │   ├── profile.$userId.tsx   # /profile/:userId
│   │   │   ├── explore.tsx           # /explore
│   │   │   ├── knowledge.tsx         # /knowledge (graph)
│   │   │   ├── courses.$courseId.tsx # /courses/:courseId
│   │   │   └── room.$roomId.tsx      # /room/:roomId (study room)
│   │   ├── components/
│   │   │   ├── player/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── SceneRenderer.tsx
│   │   │   │   ├── AudioEngine.tsx
│   │   │   │   ├── ChapterScrubber.tsx
│   │   │   │   └── TranscriptPanel.tsx
│   │   │   ├── quiz/
│   │   │   │   ├── QuizOverlay.tsx
│   │   │   │   ├── QuizCard.tsx
│   │   │   │   └── HintButton.tsx
│   │   │   ├── coding/
│   │   │   │   ├── CodeScene.tsx
│   │   │   │   └── CodeRunner.tsx
│   │   │   ├── teach-back/
│   │   │   │   └── TeachBackModal.tsx
│   │   │   ├── knowledge/
│   │   │   │   └── KnowledgeGraph.tsx
│   │   │   ├── create/
│   │   │   │   ├── PromptForm.tsx
│   │   │   │   └── PdfUploader.tsx
│   │   │   ├── social/
│   │   │   │   ├── VideoCard.tsx
│   │   │   │   └── StudyRoom.tsx
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── useVideoPlayer.ts
│   │   │   ├── useJobProgress.ts
│   │   │   ├── useQuizAttempt.ts
│   │   │   └── useStudyRoom.ts
│   │   ├── lib/
│   │   │   ├── api.ts                # Typed API client
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 4. Database Schema

Create all tables via Alembic migrations. Use `UUID` primary keys throughout.

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(64) UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  avatar_url TEXT,
  streak_days INT DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### videos

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  pdf_url TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (2, 5)),
  quiz_enabled BOOLEAN DEFAULT false,
  dialogue_mode BOOLEAN DEFAULT false,
  voice_style VARCHAR(32) DEFAULT 'alloy',
  status VARCHAR(32) DEFAULT 'pending',  -- pending|generating|ready|failed
  manifest_url TEXT,                     -- URL to the VideoManifest JSON in R2
  is_public BOOLEAN DEFAULT false,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### scenes

```sql
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  scene_index INT NOT NULL,
  title TEXT,
  narration_text TEXT,
  svg_url TEXT,
  audio_url TEXT,
  duration_ms INT,
  scene_type VARCHAR(32) DEFAULT 'svg',  -- svg|code|dialogue
  code_language VARCHAR(32),             -- e.g. 'javascript', only for code scenes
  code_starter TEXT,                     -- starter code for code scenes
  code_tests TEXT,                       -- JSON array of test cases
  UNIQUE(video_id, scene_index)
);
```

### quiz_cards

```sql
CREATE TABLE quiz_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,        -- ["option A", "option B", "option C", "option D"]
  correct_index INT NOT NULL,    -- 0-3
  hint TEXT,
  explanation TEXT
);
```

### quiz_attempts

```sql
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quiz_card_id UUID REFERENCES quiz_cards(id) ON DELETE CASCADE,
  selected_index INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);
```

### concept_nodes

```sql
CREATE TABLE concept_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  mastery_score FLOAT DEFAULT 0.0,  -- 0.0 to 1.0
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, label)
);
```

### concept_edges

```sql
CREATE TABLE concept_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_concept_id UUID REFERENCES concept_nodes(id),
  to_concept_id UUID REFERENCES concept_nodes(id),
  relation VARCHAR(64)  -- e.g. 'prerequisite', 'related', 'part_of'
);
```

### video_concepts (join: which concepts appear in which video)

```sql
CREATE TABLE video_concepts (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, concept_id)
);
```

### scene_citations

```sql
CREATE TABLE scene_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  claim_text TEXT,
  source_title TEXT,
  source_url TEXT,
  source_type VARCHAR(32)  -- 'mdn', 'wikipedia', 'arxiv', 'official_docs', 'other'
);
```

### favourites

```sql
CREATE TABLE favourites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
```

### video_progress

```sql
CREATE TABLE video_progress (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  last_scene_index INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
```

### teach_back_attempts

```sql
CREATE TABLE teach_back_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  video_id UUID REFERENCES videos(id),
  submission_text TEXT,
  audio_url TEXT,
  score FLOAT,           -- 0.0 to 1.0
  feedback TEXT,
  gaps JSONB,            -- list of missing concepts
  attempted_at TIMESTAMPTZ DEFAULT now()
);
```

### flashcard_decks

```sql
CREATE TABLE flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  video_id UUID REFERENCES videos(id),
  name TEXT,
  cards JSONB,           -- [{front, back, due_date, interval, ease_factor}]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### courses

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### course_videos

```sql
CREATE TABLE course_videos (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  position INT NOT NULL,
  teacher_notes TEXT,
  PRIMARY KEY (course_id, video_id)
);
```

### study_rooms

```sql
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id),
  host_user_id UUID REFERENCES users(id),
  code VARCHAR(8) UNIQUE NOT NULL,  -- join code e.g. "LUNA4821"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### study_room_participants

```sql
CREATE TABLE study_room_participants (
  room_id UUID REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
```

---

## 5. Backend Implementation

### 5.1 FastAPI App Setup

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, videos, quiz, knowledge, courses, social, study_rooms, export
from app.websocket.manager import router as ws_router

app = FastAPI(title="Luminar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(videos.router, prefix="/videos", tags=["videos"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
app.include_router(courses.router, prefix="/courses", tags=["courses"])
app.include_router(social.router, prefix="/social", tags=["social"])
app.include_router(study_rooms.router, prefix="/rooms", tags=["rooms"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(ws_router)
```

### 5.2 Authentication

Use JWT bearer tokens. Implement:

- `POST /auth/register` — email, username, password. Hash password with bcrypt. Return access token.
- `POST /auth/login` — email + password. Verify bcrypt. Return JWT (24h expiry) and refresh token (7d).
- `POST /auth/refresh` — exchange refresh token for new access token.
- `GET /auth/me` — return current user from JWT.

Use a `get_current_user` dependency that decodes the JWT and fetches the user from DB. Apply this dependency to all protected routes.

```python
# app/routers/auth.py pattern
from fastapi import Depends, HTTPException
from app.services.auth_service import verify_password, create_access_token, get_current_user

@router.post("/login")
async def login(form: LoginSchema, db: AsyncSession = Depends(get_db)):
    user = await db.execute(select(User).where(User.email == form.email))
    user = user.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
```

### 5.3 Agent System (PydanticAI)

Each agent is defined as a `pydantic_ai.Agent` with a structured output type. Agents call OpenAI GPT-4o.

#### Pydantic output types

```python
# app/agents/orchestrator.py
from pydantic import BaseModel
from typing import Literal
from pydantic_ai import Agent

class ScenePlan(BaseModel):
    index: int
    topic: str
    visual_style: Literal["concept_diagram", "code_animation", "timeline", "metaphor", "process_flow"]
    has_quiz_gate: bool
    is_code_scene: bool  # True = use live coding scene instead of SVG
    is_dialogue_scene: bool

class VideoBlueprint(BaseModel):
    title: str
    scenes: list[ScenePlan]
    key_concepts: list[str]  # for concept graph
    suggested_next_topics: list[str]
    weak_areas_addressed: list[str]  # from adaptive engine context

orchestrator_agent = Agent(
    model="openai:gpt-4o",
    result_type=VideoBlueprint,
    system_prompt="""
    You are a learning curriculum designer. Given a topic prompt, a duration,
    and optional weak areas for the learner, produce a VideoBlueprint.

    For a 2-minute video: 3-4 scenes.
    For a 5-minute video: 7-9 scenes.

    Place quiz gates after conceptually dense scenes (never after the first scene).
    Use code scenes only when the topic is programming and a hands-on exercise
    would directly reinforce the scene's concept.
    Keep key_concepts to 3-6 terms.
    """
)
```

```python
# app/agents/script.py
class SceneScript(BaseModel):
    scene_index: int
    narration: str  # Full narration text with [VISUAL_CUE: ...] annotations
    speaker_a: str | None  # For dialogue mode
    speaker_b: str | None  # For dialogue mode
    estimated_duration_ms: int

class FullScript(BaseModel):
    scenes: list[SceneScript]

script_agent = Agent(
    model="openai:gpt-4o",
    result_type=FullScript,
    system_prompt="""
    You are an educational script writer. Write narration for each scene.
    Embed [VISUAL_CUE: <specific animation instruction>] tags inline to guide
    the SVG animator. Keep narration at a measured pace: ~130 words per minute.

    For dialogue_mode scenes, write speaker_a as "Teacher" and speaker_b as
    "Curious Student" — the student asks questions a confused learner would ask.

    Example visual cues:
    [VISUAL_CUE: animate call stack growing with three frames]
    [VISUAL_CUE: show event loop diagram with microtask queue highlighted]
    [VISUAL_CUE: draw timeline with async operations overlapping]
    """
)
```

```python
# app/agents/svg_animator.py
class AnimatedSVGOutput(BaseModel):
    svg_code: str  # Complete self-contained animated SVG
    animation_duration_ms: int  # Total animation duration to match audio

svg_agent = Agent(
    model="openai:gpt-4o",
    result_type=AnimatedSVGOutput,
    system_prompt="""
    You are an SVG animation engineer for an educational platform.

    Given a scene's narration text and VISUAL_CUE annotations, produce a complete
    self-contained animated SVG that visually explains the concept.

    Rules:
    - Use <animate> and <animateTransform> for SVG-native animation
    - Use CSS @keyframes for complex transitions (embed in <style> inside SVG)
    - Sync animation timing to the given target duration in milliseconds
    - Use begin="Xs" attributes to sequence elements appearing with narration
    - Colour palette: use soft educational colours (#4A90D9 blue, #7ED321 green,
      #F5A623 amber, #D0021B red, #9B59B6 purple, #ECF0F1 light gray)
    - Background: #FAFAFA or #1A1A2E for dark scenes
    - Font: system-ui, sans-serif. Labels 14px, titles 18px.
    - Always include a descriptive <title> and <desc> for accessibility
    - Output only valid SVG — no markdown fences, no explanation text
    - Width 800, height 450 (16:9 ratio)

    The SVG must be completely self-contained and renderable by a browser's
    <img> or inline <svg> tag without external dependencies.
    """
)
```

```python
# app/agents/quiz_gen.py
class QuizCard(BaseModel):
    question: str
    options: list[str]  # Exactly 4 options
    correct_index: int  # 0-3
    hint: str
    explanation: str  # Shown after answer

quiz_agent = Agent(
    model="openai:gpt-4o",
    result_type=QuizCard,
    system_prompt="""
    You create multiple-choice quiz questions for educational videos.

    Rules:
    - Question must test genuine comprehension, not trivial recall
    - All 4 options must be plausible (no obviously wrong distractors)
    - Hint should nudge without giving away the answer
    - Explanation should be 2-3 sentences clarifying why the answer is correct
      and why the distractors are wrong
    - Difficulty should match the scene complexity
    """
)
```

```python
# app/agents/citation.py
class Citation(BaseModel):
    claim_text: str
    source_title: str
    source_url: str
    source_type: str  # 'mdn', 'wikipedia', 'arxiv', 'official_docs', 'other'

class CitationResult(BaseModel):
    citations: list[Citation]

citation_agent = Agent(
    model="openai:gpt-4o",
    result_type=CitationResult,
    system_prompt="""
    You extract key factual claims from educational narration text and map each
    to a real, verifiable URL. Only cite well-known authoritative sources:
    MDN Web Docs, Wikipedia, official language/framework documentation,
    arXiv papers, or W3C specs. Never invent URLs. If you cannot find a
    credible source for a claim, omit it.
    """
)
```

```python
# app/agents/teach_back_evaluator.py
class TeachBackEvaluation(BaseModel):
    score: float  # 0.0 to 1.0
    feedback: str
    missing_concepts: list[str]
    strong_points: list[str]

teach_back_agent = Agent(
    model="openai:gpt-4o",
    result_type=TeachBackEvaluation,
    system_prompt="""
    You evaluate a learner's explanation of a topic they just watched a video about.
    Score their explanation from 0.0 (completely wrong) to 1.0 (expert explanation).

    Evaluate on: accuracy, completeness, use of correct terminology, and ability
    to explain the 'why' not just the 'what'.

    Be encouraging but honest. Identify specific missing concepts by name.
    """
)
```

```python
# app/agents/combiner.py
class SceneManifestItem(BaseModel):
    scene_index: int
    scene_type: str  # 'svg' | 'code' | 'dialogue'
    title: str
    narration: str
    svg_url: str | None
    audio_url: str | None  # None for code scenes
    duration_ms: int
    quiz_card_id: str | None
    citations: list[dict]
    code_language: str | None
    code_starter: str | None
    code_tests: list[dict] | None  # [{input, expected_output, description}]

class VideoManifest(BaseModel):
    video_id: str
    title: str
    total_duration_ms: int
    scenes: list[SceneManifestItem]
    key_concepts: list[str]
    suggested_next_topics: list[str]
```

#### Quality review agent

```python
# app/agents/quality_review.py
class QualityResult(BaseModel):
    scene_index: int
    passes: bool
    issue: str | None  # Reason for failure if passes=False

quality_agent = Agent(
    model="openai:gpt-4o",
    result_type=QualityResult,
    system_prompt="""
    You review whether an animated SVG meaningfully illustrates the given narration text.
    Check: Does the SVG contain relevant labels and visual elements matching the topic?
    Does it appear to have animation elements? Is the SVG valid (not empty/broken)?

    Be lenient — only fail if the SVG is clearly off-topic or structurally broken.
    """
)
```

### 5.4 Job Queue (Celery + Redis)

```python
# app/tasks/celery_app.py
from celery import Celery
from app.config import settings

celery_app = Celery(
    "luminar",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
```

```python
# app/tasks/generate_video.py
from celery import shared_task
from app.agents.orchestrator import orchestrator_agent, VideoBlueprint
from app.agents.script import script_agent
from app.agents.svg_animator import svg_agent
from app.agents.tts import generate_tts
from app.agents.quiz_gen import quiz_agent
from app.agents.combiner import VideoManifest
from app.agents.quality_review import quality_agent
from app.agents.citation import citation_agent
from app.agents.concept_extractor import concept_extractor_agent
from app.services.storage import upload_to_r2
from app.services.progress_publisher import publish_progress
from app.services import adaptive_engine
import asyncio, json

@shared_task(bind=True)
def generate_video_task(self, video_id: str, prompt: str, pdf_text: str | None,
                         duration: int, quiz_enabled: bool, dialogue_mode: bool,
                         voice_style: str, user_id: str):
    asyncio.run(_generate(self, video_id, prompt, pdf_text, duration,
                           quiz_enabled, dialogue_mode, voice_style, user_id))

async def _generate(task, video_id, prompt, pdf_text, duration, quiz_enabled,
                     dialogue_mode, voice_style, user_id):
    publish_progress(video_id, 5, "Planning your video...")

    # Step 1: Get adaptive context for this user
    weak_areas = await adaptive_engine.get_weak_areas(user_id)

    # Step 2: Orchestrator
    blueprint = await orchestrator_agent.run(
        f"Topic: {prompt}\nDuration: {duration} minutes\n"
        f"PDF content: {pdf_text or 'None'}\n"
        f"User weak areas: {', '.join(weak_areas) or 'None'}"
    )
    blueprint: VideoBlueprint = blueprint.data
    publish_progress(video_id, 15, "Writing the script...")

    # Step 3: Script agent
    script_input = f"Blueprint: {blueprint.model_dump_json()}\n"
    if dialogue_mode:
        script_input += "Use dialogue mode (Teacher + Curious Student).\n"
    full_script = (await script_agent.run(script_input)).data
    publish_progress(video_id, 30, "Generating animations and voiceovers...")

    # Step 4: Parallel SVG + TTS + Quiz generation
    scenes_data = []
    total = len(blueprint.scenes)
    for i, scene_plan in enumerate(blueprint.scenes):
        scene_script = full_script.scenes[i]

        # SVG agent
        svg_result = await svg_agent.run(
            f"Scene topic: {scene_plan.topic}\n"
            f"Visual style: {scene_plan.visual_style}\n"
            f"Narration: {scene_script.narration}\n"
            f"Target duration ms: {scene_script.estimated_duration_ms}"
        )
        svg_output = svg_result.data

        # Quality review — retry once if fails
        quality = (await quality_agent.run(
            f"Narration: {scene_script.narration}\nSVG: {svg_output.svg_code[:1000]}"
        )).data
        if not quality.passes:
            svg_result = await svg_agent.run(
                f"Previous attempt failed: {quality.issue}\n"
                f"Scene topic: {scene_plan.topic}\nNarration: {scene_script.narration}"
            )
            svg_output = svg_result.data

        # Upload SVG
        svg_url = await upload_to_r2(
            f"videos/{video_id}/scenes/{i}/animation.svg",
            svg_output.svg_code.encode(),
            content_type="image/svg+xml"
        )

        # TTS agent (skip for code scenes)
        audio_url = None
        actual_duration_ms = scene_script.estimated_duration_ms
        if not scene_plan.is_code_scene:
            voice = "alloy" if not dialogue_mode else None
            audio_data, duration_ms = await generate_tts(
                scene_script.narration, voice_style if not dialogue_mode else None,
                scene_script.speaker_a, scene_script.speaker_b
            )
            audio_url = await upload_to_r2(
                f"videos/{video_id}/scenes/{i}/audio.mp3",
                audio_data, content_type="audio/mpeg"
            )
            actual_duration_ms = duration_ms

        # Citation agent
        citations_result = (await citation_agent.run(scene_script.narration)).data

        # Quiz agent
        quiz_card_data = None
        if quiz_enabled and scene_plan.has_quiz_gate:
            quiz_card_data = (await quiz_agent.run(
                f"Scene topic: {scene_plan.topic}\nNarration: {scene_script.narration}"
            )).data

        scenes_data.append({
            "plan": scene_plan,
            "script": scene_script,
            "svg_url": svg_url,
            "audio_url": audio_url,
            "duration_ms": actual_duration_ms,
            "quiz_card": quiz_card_data,
            "citations": citations_result.citations,
        })

        progress = 30 + int((i + 1) / total * 50)
        publish_progress(video_id, progress, f"Scene {i+1} of {total} done...")

    publish_progress(video_id, 82, "Assembling your video...")

    # Step 5: Build and store manifest + persist to DB
    await _persist_manifest(video_id, blueprint, scenes_data, user_id)
    publish_progress(video_id, 95, "Updating your knowledge graph...")

    # Step 6: Update concept graph
    await adaptive_engine.update_knowledge_graph(user_id, blueprint.key_concepts, video_id)
    publish_progress(video_id, 100, "Ready!")
```

#### TTS service with dialogue support

```python
# app/agents/tts.py
from openai import AsyncOpenAI
import io

client = AsyncOpenAI()

VOICE_MAP = {
    "calm_tutor": "nova",
    "energetic": "echo",
    "professional": "onyx",
    "friendly": "alloy",
    "teacher": "nova",    # dialogue teacher voice
    "student": "shimmer", # dialogue student voice
}

async def generate_tts(narration: str, voice_style: str | None,
                        speaker_a: str | None, speaker_b: str | None) -> tuple[bytes, int]:
    """Returns (audio_bytes, duration_ms)."""
    if speaker_a and speaker_b:
        # Dialogue mode: parse turns and stitch audio
        return await _generate_dialogue_tts(narration, speaker_a, speaker_b)

    voice = VOICE_MAP.get(voice_style or "friendly", "alloy")
    response = await client.audio.speech.create(
        model="tts-1-hd",
        voice=voice,
        input=narration,
        response_format="mp3",
    )
    audio_bytes = response.content
    # Estimate duration: TTS-1-HD averages ~130 words/min
    word_count = len(narration.split())
    duration_ms = int((word_count / 130) * 60 * 1000)
    return audio_bytes, duration_ms

async def _generate_dialogue_tts(narration: str, speaker_a: str, speaker_b: str):
    """Parse [Teacher]: / [Student]: tags and interleave audio."""
    import re
    from pydub import AudioSegment

    turns = re.findall(r'\[(Teacher|Student)\]:\s*(.+?)(?=\[(?:Teacher|Student)\]:|$)',
                       narration, re.DOTALL)
    segments = []
    total_duration = 0
    for speaker, text in turns:
        voice = VOICE_MAP["teacher"] if speaker == "Teacher" else VOICE_MAP["student"]
        response = await client.audio.speech.create(
            model="tts-1-hd", voice=voice, input=text.strip(), response_format="mp3"
        )
        seg = AudioSegment.from_mp3(io.BytesIO(response.content))
        segments.append(seg)
        total_duration += len(seg)

    combined = segments[0]
    for seg in segments[1:]:
        combined += seg

    buf = io.BytesIO()
    combined.export(buf, format="mp3")
    return buf.getvalue(), total_duration
```

### 5.5 API Endpoints

#### Videos router

```python
# app/routers/videos.py

# POST /videos/generate
# Body: { prompt, duration_minutes, quiz_enabled, dialogue_mode, voice_style }
# File: pdf (optional multipart)
# Returns: { job_id, video_id }

# GET /videos/{video_id}
# Returns: full VideoManifest

# GET /videos/{video_id}/status
# Returns: { status, progress_pct, stage_label }

# PATCH /videos/{video_id}/publish
# Toggles is_public

# DELETE /videos/{video_id}

# GET /videos/feed?page=1&per_page=20
# Returns: paginated public videos

# GET /videos/me
# Returns: current user's videos

# POST /videos/{video_id}/favourite
# DELETE /videos/{video_id}/favourite
# GET /videos/{video_id}/favourite  -> { is_favourite: bool }

# GET /videos/{video_id}/progress
# POST /videos/{video_id}/progress
# Body: { last_scene_index, completed }

# POST /videos/{video_id}/scenes/{scene_id}/regenerate
# Triggers regenerate_scene Celery task for a single scene
```

#### Quiz router

```python
# app/routers/quiz.py

# POST /quiz/{quiz_card_id}/attempt
# Body: { selected_index: int }
# Returns: { is_correct, explanation, correct_index }

# GET /quiz/{quiz_card_id}/stats
# Returns: { total_attempts, correct_attempts, user_attempts }
```

#### Knowledge router

```python
# app/routers/knowledge.py

# GET /knowledge/graph
# Returns: { nodes: [ConceptNode], edges: [ConceptEdge] } for current user

# GET /knowledge/suggestions
# Returns: list of suggested next video topics based on graph gaps
```

#### Teach-back router (under videos)

```python
# POST /videos/{video_id}/teach-back/text
# Body: { submission_text: str }
# Runs teach_back_agent, stores result, updates mastery scores
# Returns: TeachBackEvaluation

# POST /videos/{video_id}/teach-back/audio
# File: audio file (webm/mp3)
# Transcribes with Whisper, then runs teach_back_agent
# Returns: TeachBackEvaluation + { transcription }
```

#### Export router

```python
# app/routers/export.py

# GET /export/{video_id}/anki
# Returns: .apkg Anki deck file download
# Uses genanki library to build deck from quiz_cards

# GET /export/{video_id}/flashcards
# Returns: JSON flashcard deck (for built-in spaced repetition)

# POST /export/{video_id}/flashcards/review
# Body: { card_id, quality: 0-5 }  -- SM-2 algorithm review
# Updates interval, ease_factor, due_date
```

#### Study rooms router

```python
# app/routers/study_rooms.py

# POST /rooms/create
# Body: { video_id }
# Returns: { room_id, code }

# POST /rooms/join
# Body: { code }
# Returns: { room_id, video_id, participants }

# GET /rooms/{room_id}
# Returns room state

# DELETE /rooms/{room_id}  (host only)
```

#### Courses router

```python
# app/routers/courses.py

# POST /courses
# Body: { title, description }

# GET /courses/{course_id}
# Returns course + ordered video list

# POST /courses/{course_id}/videos
# Body: { video_id, position, teacher_notes }

# PATCH /courses/{course_id}/videos/{video_id}
# Body: { position?, teacher_notes? }

# DELETE /courses/{course_id}/videos/{video_id}

# PATCH /courses/{course_id}/publish
# Toggles is_public

# GET /courses/explore
# Paginated public courses
```

### 5.6 WebSocket (Progress Streaming)

```python
# app/websocket/manager.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.progress_publisher import subscribe_progress
import asyncio, json

router = APIRouter()
active_connections: dict[str, list[WebSocket]] = {}

@router.websocket("/ws/progress/{video_id}")
async def progress_ws(websocket: WebSocket, video_id: str):
    await websocket.accept()
    if video_id not in active_connections:
        active_connections[video_id] = []
    active_connections[video_id].append(websocket)
    try:
        async for message in subscribe_progress(video_id):
            await websocket.send_text(json.dumps(message))
            if message.get("progress") == 100:
                break
    except WebSocketDisconnect:
        active_connections[video_id].remove(websocket)
```

```python
# app/services/progress_publisher.py
import redis.asyncio as aioredis
import json
from app.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL)

def publish_progress(video_id: str, pct: int, label: str):
    import redis
    r = redis.from_url(settings.REDIS_URL)
    r.publish(f"progress:{video_id}", json.dumps({"progress": pct, "label": label}))

async def subscribe_progress(video_id: str):
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(f"progress:{video_id}")
    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])
```

### 5.7 Adaptive Engine

```python
# app/services/adaptive_engine.py
from sqlalchemy import select, update
from app.models.quiz import QuizAttempt
from app.models.knowledge_graph import ConceptNode, ConceptEdge, VideoConceptLink

async def get_weak_areas(user_id: str, db) -> list[str]:
    """Return concept labels where mastery_score < 0.5."""
    result = await db.execute(
        select(ConceptNode.label)
        .where(ConceptNode.user_id == user_id, ConceptNode.mastery_score < 0.5)
        .order_by(ConceptNode.mastery_score)
        .limit(5)
    )
    return [r[0] for r in result.fetchall()]

async def update_knowledge_graph(user_id: str, concepts: list[str], video_id: str, db):
    """Upsert concept nodes and create video-concept links."""
    for label in concepts:
        existing = await db.execute(
            select(ConceptNode).where(ConceptNode.user_id == user_id,
                                      ConceptNode.label == label)
        )
        node = existing.scalar_one_or_none()
        if not node:
            node = ConceptNode(user_id=user_id, label=label, mastery_score=0.3)
            db.add(node)
        else:
            node.mastery_score = min(1.0, node.mastery_score + 0.1)
    await db.commit()

async def update_mastery_from_quiz(user_id: str, quiz_card_id: str,
                                    is_correct: bool, db):
    """Adjust mastery score of concepts tested by this quiz card."""
    # Look up which concepts are linked to the scene this quiz belongs to,
    # then nudge mastery up (correct) or down (incorrect)
    delta = +0.15 if is_correct else -0.1
    # ... implementation: join quiz_cards → scenes → video_concepts → concept_nodes
    pass
```

---

## 6. Frontend Implementation

### 6.1 Project Setup

```bash
npm create vite@latest luminar-frontend -- --template react-ts
cd luminar-frontend
npm install @tanstack/react-router @tanstack/react-query
npm install tailwindcss @tailwindcss/vite
npm install lucide-react @monaco-editor/react @xyflow/react
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest init
# Add components: button, card, dialog, progress, toggle, slider, tabs,
# badge, textarea, dropdown-menu, separator, tooltip, sheet
```

### 6.2 Routing Structure (TanStack Router file-based)

```typescript
// src/routes/index.tsx          → /          Home feed
// src/routes/create.tsx         → /create    Create video
// src/routes/generating.$jobId  → /generating/:jobId
// src/routes/watch.$videoId     → /watch/:videoId
// src/routes/profile.$userId    → /profile/:userId
// src/routes/explore.tsx        → /explore
// src/routes/knowledge.tsx      → /knowledge  Knowledge graph
// src/routes/courses.$courseId  → /courses/:courseId
// src/routes/room.$roomId       → /room/:roomId
```

### 6.3 Core Components

#### PromptForm

```typescript
// src/components/create/PromptForm.tsx
interface CreateVideoForm {
  prompt: string;
  duration: 2 | 5;
  quizEnabled: boolean;
  dialogueMode: boolean;
  voiceStyle: "calm_tutor" | "energetic" | "professional" | "friendly";
  pdf?: File;
}
```

Renders: large textarea for prompt, PDF drag-drop zone (show file name on upload), duration toggle (2 min / 5 min pills), quiz toggle switch, dialogue mode toggle, voice style dropdown. On submit: upload PDF if present (`POST /upload/pdf` → get pdf_url), then `POST /videos/generate`. Navigate to `/generating/:jobId`.

#### VideoCard (feed)

Show: thumbnail (first SVG frame as static image), title, duration, author avatar + name, view count, favourite button, "Watch" CTA. If `is_public`, show a "Community" badge.

### 6.4 Video Player Engine

This is the most important component. It reads a `VideoManifest` and drives SVG rendering + audio playback.

```typescript
// src/hooks/useVideoPlayer.ts
type PlayerState =
  | "idle"
  | "playing"
  | "paused"
  | "quiz"
  | "code"
  | "teach-back"
  | "ended";

interface PlayerStore {
  currentSceneIndex: number;
  playerState: PlayerState;
  progress: number; // 0-1 within current scene
  manifest: VideoManifest | null;
  quizCard: QuizCard | null;
}
```

```typescript
// src/components/player/VideoPlayer.tsx
// Responsibilities:
// 1. Load VideoManifest from API
// 2. Render current scene's SVG inline (dangerouslySetInnerHTML inside an iframe for sandboxing)
// 3. Play scene audio using Web Audio API
// 4. On audio end: check if next scene has quiz_gate → show QuizOverlay
//    or if scene_type === 'code' → show CodeScene component
// 5. Track progress for resume: POST /videos/:id/progress every 30s
// 6. Show chapter scrubber at bottom
// 7. Show TranscriptPanel (collapsible, word-highlight driven by audio currentTime)
// 8. After last scene: show TeachBackModal + CitationsPanel

export function VideoPlayer({ videoId }: { videoId: string }) {
  const { data: manifest } = useQuery({ queryKey: ['video', videoId], ... })
  const player = useVideoPlayer(manifest)

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <SceneRenderer scene={manifest.scenes[player.currentSceneIndex]} />
      <AudioEngine
        audioUrl={currentScene.audio_url}
        onEnded={player.handleSceneEnd}
        onTimeUpdate={player.handleTimeUpdate}
      />
      {player.playerState === 'quiz' && (
        <QuizOverlay quizCard={player.quizCard} onCorrect={player.advanceScene} />
      )}
      {player.playerState === 'code' && (
        <CodeScene scene={currentScene} onComplete={player.advanceScene} />
      )}
      <ChapterScrubber manifest={manifest} currentIndex={player.currentSceneIndex} />
      <TranscriptPanel scenes={manifest.scenes} currentTime={player.currentTime} />
    </div>
  )
}
```

#### SceneRenderer

```typescript
// src/components/player/SceneRenderer.tsx
// Fetches SVG from svg_url, renders it inside a sandboxed iframe.
// Uses an iframe so SVG animations run in isolation.
// The iframe srcdoc gets the SVG content wrapped in minimal HTML.
// On mount, forward animation start via postMessage.
```

#### AudioEngine

```typescript
// src/components/player/AudioEngine.tsx
// Uses HTML <audio> element, exposes:
// - play(), pause(), seek(ms)
// - onTimeUpdate callback (for transcript highlighting)
// - onEnded callback (triggers scene advance)
// For dialogue mode: audio is already a single stitched file, plays normally.
```

### 6.5 Quiz Overlay System

```typescript
// src/components/quiz/QuizOverlay.tsx
// Renders as an absolutely-positioned overlay on the player
// State machine: 'unanswered' → 'incorrect' (shake + allow retry) | 'correct' (green flash → advance)
// After 2 wrong attempts: show explanation and allow skip
// Props: quizCard, onCorrect callback

// QuizCard shows:
// - Question text (large, centered)
// - 4 option buttons (A/B/C/D)
// - "Show hint" toggle (reveals hint text below options)
// - Submit button (disabled until option selected)
// On incorrect: shake animation on selected option, red border, attempts counter
// On correct: green border, confetti micro-animation, "Correct! Continuing..."
```

### 6.6 Knowledge Graph View

```typescript
// src/components/knowledge/KnowledgeGraph.tsx
// Uses React Flow (@xyflow/react)
// Nodes: ConceptNode, coloured by mastery_score
//   - mastery < 0.3: red node (weak)
//   - mastery 0.3–0.6: amber node (developing)
//   - mastery > 0.6: green node (strong)
// Edges: ConceptEdge, labelled with relation type
// Clicking a node: sidebar showing concept details + "Generate video on this" button
//   that pre-fills the /create form with the concept as prompt
// Bottom panel: "Suggested next topics" list from API /knowledge/suggestions

interface KnowledgeGraphNode {
  id: string;
  label: string;
  masteryScore: number;
  videoCount: number; // how many videos covered this concept
}
```

---

## 7. Feature Implementation Details

### 7.1 Video Generation Pipeline

Full Celery task flow described in section 5.4. Key implementation notes:

- Upload SVG and audio to R2 immediately after generation so they're available for streaming
- Store the full `VideoManifest` as a JSON file in R2 (e.g. `manifests/{video_id}.json`) and store only the manifest URL in the DB
- On `GET /videos/{video_id}`, fetch and return the manifest JSON from R2
- Handle partial failures: if one scene's SVG fails quality review twice, use a fallback "static diagram" SVG with the narration text as a text-only slide
- Set Celery task `soft_time_limit=300` (5 min) and `time_limit=400` (hard kill at 6.5 min)

### 7.2 Adaptive Difficulty

When calling the orchestrator, always pass `weak_areas` from the adaptive engine. The orchestrator's system prompt instructs it to allocate more scenes to weak areas and mark them as `has_quiz_gate: true`.

After every quiz attempt, call `adaptive_engine.update_mastery_from_quiz()` to adjust the concept node's `mastery_score`. After a teach-back attempt, parse `missing_concepts` from the evaluation and set those concepts' mastery scores to `max(0, score - 0.2)`.

Display mastery scores on the knowledge graph (see 6.6) and in the user's profile as a "strength radar" chart showing top-level concept categories.

### 7.3 Explain It Differently

Add a "↺ Explain differently" button to the player UI, visible on each scene. When clicked:

1. `POST /videos/{video_id}/scenes/{scene_id}/regenerate` with body `{ reason: "user_requested_alternative" }`
2. Backend runs the SVG agent again with a modified prompt: append "The learner did not understand the previous explanation. Use a completely different visual metaphor or analogy."
3. Also re-runs the script agent for just that scene with the same instruction.
4. New SVG and audio uploaded, scene record updated.
5. Frontend receives the updated manifest via WebSocket, re-renders the current scene.

Limit: max 2 regenerations per scene per video (track `regeneration_count` column on `scenes`).

### 7.4 Source Citation Layer

After video generation completes, run `citation_agent` on each scene's narration. Store results in `scene_citations` table.

In the player UI: add a "Sources" button in the scene controls bar. Opens a `Sheet` (shadcn/ui) from the right showing citations for the current scene, each as a clickable link with source type badge (MDN, Wikipedia, etc.).

In the player footer: show a small "Verified by X sources" indicator for scenes that have citations.

### 7.5 Teach It Back Mode

After the last scene plays and `onEnded` fires, transition `playerState` to `'teach-back'`. Show `TeachBackModal`.

```typescript
// TeachBackModal UI:
// - Title: "Now you try — explain it back"
// - Instructions: "Explain [video title] in your own words. You can type or record audio."
// - Tab: "Type" | "Record"
// - Type tab: <Textarea> with 500 word limit + character counter
// - Record tab: MediaRecorder API recording button, 3-minute max, waveform visualiser
// - Submit button
// On submit:
//   - Text: POST /videos/:id/teach-back/text
//   - Audio: POST /videos/:id/teach-back/audio (multipart)
// Show loading state while evaluating
// Results screen: score ring (0-100%), feedback text, missing concepts as red badges,
//   strong points as green badges, "Watch again" and "Continue" buttons
```

### 7.6 Live Coding Scenes (CS Topics)

When a scene has `scene_type === 'code'`, the player shows `CodeScene` instead of SVG+audio.

```typescript
// src/components/coding/CodeScene.tsx
// Layout: left panel = SVG animation (the visual explanation), right panel = Monaco editor
// The SVG plays automatically to explain the concept
// Below editor: "Run Code" button
// CodeRunner executes JS in a sandboxed iframe using postMessage
// For Python/other languages: call backend POST /run-code (sandboxed Docker exec)
// Test cases: shown as pass/fail badges after each run
// On all tests passing: green success state, "Great work! Continuing..." → onComplete()
// On failure: show which tests failed, allow unlimited retries

interface CodeTest {
  description: string;
  input: string;
  expected_output: string;
}
```

For JavaScript: use `new Function()` in a sandboxed iframe. For Python: implement a lightweight backend endpoint `POST /execute` that runs code in a restricted subprocess with a 5-second timeout. Do NOT use full Docker for MVP — use Python's `subprocess` with `timeout` and `resource` limits.

### 7.7 Multi-voice Dialogue Mode

Controlled by `dialogue_mode` flag in the creation form. When enabled:

- Script agent produces `speaker_a` (Teacher) and `speaker_b` (Student) turn-annotated narration
- TTS service stitches two voices into one audio file per scene (see `_generate_dialogue_tts`)
- In the transcript panel: show speaker labels ("Teacher:", "Student:") with different colours
- In the player: show two avatar icons at bottom-left that pulse/highlight based on who's speaking (driven by turn timestamps extracted from the script)

### 7.8 Study Rooms (Collaborative Watch)

When a user creates or joins a study room, connect to `WS /ws/rooms/{room_id}`.

```typescript
// Room WebSocket protocol (messages):
// Client → Server:
//   { type: 'scene_change', scene_index: number }  (host only)
//   { type: 'quiz_answer', quiz_card_id, selected_index }
//   { type: 'chat', text }
//   { type: 'cursor', x, y }  // relative 0-1 position on player
// Server → All clients:
//   { type: 'scene_change', scene_index, from_user }
//   { type: 'quiz_result', user_id, is_correct }
//   { type: 'chat', user_id, username, text, timestamp }
//   { type: 'participant_joined/left', user_id, username }
//   { type: 'cursor', user_id, x, y }
```

Backend room WebSocket manager: maintain per-room connection lists in memory (Redis pub/sub for multi-process). Host controls scene advancement; all clients follow. Show chat panel as a collapsible side drawer. Show other participants' coloured cursor dots on the player.

Show each participant's quiz result as a small avatar + ✓/✗ badge in the quiz overlay.

### 7.9 Spaced Repetition Export

#### Built-in flashcards

Store deck in `flashcard_decks` table. Implement SM-2 algorithm server-side:

```python
def sm2_review(ease_factor: float, interval: int, quality: int) -> tuple[float, int]:
    """quality: 0-5 (0=blackout, 5=perfect)"""
    if quality < 3:
        interval = 1
    elif interval == 0:
        interval = 1
    elif interval == 1:
        interval = 6
    else:
        interval = round(interval * ease_factor)
    ease_factor = max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    return ease_factor, interval
```

#### Anki export

```python
# app/routers/export.py
import genanki, random

@router.get("/{video_id}/anki")
async def export_anki(video_id: str, ...):
    # Fetch all quiz_cards for this video via scenes
    model = genanki.Model(
        random.randrange(1 << 30, 1 << 31),
        'Luminar Card',
        fields=[{'name': 'Question'}, {'name': 'Answer'}, {'name': 'Hint'}],
        templates=[{
            'name': 'Card 1',
            'qfmt': '{{Question}}<br><small>Hint: {{Hint}}</small>',
            'afmt': '{{FrontSide}}<hr>{{Answer}}',
        }]
    )
    deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), video.title)
    for card in quiz_cards:
        note = genanki.Note(model=model, fields=[
            card.question,
            f"{card.options[card.correct_index]}\n\n{card.explanation}",
            card.hint
        ])
        deck.add_note(note)

    pkg = genanki.Package(deck)
    buf = io.BytesIO()
    pkg.write_to_file(buf)
    return Response(buf.getvalue(), media_type="application/octet-stream",
                    headers={"Content-Disposition": f"attachment; filename={video.title}.apkg"})
```

### 7.10 Teacher / Course Builder Mode

#### Course builder UI (`/courses/:courseId/edit`)

- Drag-and-drop video ordering using `@dnd-kit/core`
- Each video card has an expandable "Teacher notes" textarea
- "Add video" button opens a modal to search/select from user's videos
- "Publish course" toggle
- Course share link: `/courses/:courseId` (public view)

#### Course player (`/courses/:courseId`)

- Sidebar showing all videos with completion checkmarks
- Auto-advances to next video after current one ends and teach-back is completed (or skipped)
- Overall course progress bar at top
- Course completion screen with certificate placeholder (MVP: just a well-designed completion card)

### 7.11 Social Features

#### Community feed (`/explore`)

- Masonry or 3-column grid of `VideoCard` components
- Filter bar: topic tags, duration, sort by (recent / most viewed / trending)
- Search: `GET /videos/search?q=<term>` — full-text search on title + prompt
- Each card: title, author, view count, favourite count, duration badge, topic tag

#### User profile (`/profile/:userId`)

- Hero section: avatar, username, join date, streak counter
- Tabs: "My Videos", "Favourites", "Courses", "Knowledge Graph" (radar chart of mastery)
- Streak calendar: GitHub-style heatmap of learning activity

#### Streak system

On every `POST /videos/{video_id}/progress` and `POST /quiz/.../attempt`, check if `last_active_date < today`. If so, update `last_active_date = today` and:

- If `last_active_date == yesterday`: increment `streak_days`
- Otherwise: reset `streak_days = 1`

---

## 8. Environment Variables

### Backend (`backend/.env`)

```
DATABASE_URL=postgresql+asyncpg://luminar:password@localhost:5432/luminar
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=luminar-assets
R2_PUBLIC_URL=https://assets.luminar.app
JWT_SECRET=<random-256-bit-hex>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

### Frontend (`frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

---

## 9. Build & Run Instructions

### docker-compose.yml (development)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: luminar
      POSTGRES_USER: luminar
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    depends_on: [postgres, redis]
    volumes: ["./backend:/app"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build: ./backend
    env_file: ./backend/.env
    depends_on: [postgres, redis]
    volumes: ["./backend:/app"]
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    command: npm run dev -- --host

volumes:
  pgdata:
```

### Backend Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg  # needed for pydub audio stitching
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Key Python dependencies (`requirements.txt`)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
pydantic==2.9.0
pydantic-ai==0.0.13
pydantic-settings==2.5.0
sqlalchemy[asyncio]==2.0.35
alembic==1.13.3
asyncpg==0.29.0
celery==5.4.0
redis==5.1.0
openai==1.51.0
pdfplumber==0.11.4
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
httpx==0.27.2
pydub==0.25.1
genanki==0.13.0
boto3==1.35.0  # for R2 (S3-compatible)
```

---

## 10. Phase-by-Phase Build Order

### Phase 1 — Core pipeline (Week 1–3)

**Goal: end-to-end video generation working, playable in browser.**

1. Set up FastAPI app, database, Alembic, and auth (register/login/me)
2. Implement R2 storage service
3. Implement orchestrator, script, SVG, TTS, and combiner agents with basic prompts
4. Implement Celery task `generate_video_task` (sequential, no parallelism yet)
5. Implement `POST /videos/generate` and `GET /videos/{id}` endpoints
6. Implement WebSocket progress streaming
7. Frontend: create page with form, generating page with live progress bar
8. Frontend: basic video player that loads manifest and plays SVG + audio scene by scene

**Done when:** User can type "How does TCP work?", generate a 2-minute video, and watch it.

---

### Phase 2 — Quiz system (Week 4–5)

**Goal: quiz gates working in the player.**

1. Add quiz agent to the pipeline
2. Store quiz cards in DB, return them in manifest
3. Frontend: QuizOverlay component with full attempt flow
4. Backend: `POST /quiz/{id}/attempt` endpoint
5. Backend: adaptive engine `get_weak_areas` + `update_mastery_from_quiz`
6. Pass weak areas to orchestrator

**Done when:** Quiz gates pause the video, track right/wrong, and influence the next video's orchestrator.

---

### Phase 3 — Knowledge graph + teach-back (Week 6–7)

**Goal: learning loop is closed.**

1. Concept extractor agent — run after generation, build graph
2. `GET /knowledge/graph` endpoint
3. Frontend: Knowledge Graph page using React Flow
4. Teach-back modal (text mode first, audio mode second)
5. Teach-back evaluator agent + `POST /teach-back/text` endpoint
6. Update mastery from teach-back evaluation

**Done when:** After watching a video, user can teach it back, get scored, and see their knowledge graph update.

---

### Phase 4 — Quality + extra scene types (Week 8–9)

**Goal: output quality improves, CS topics work better.**

1. Quality review agent in pipeline (with one retry)
2. Citation agent + scene citations stored and shown in player
3. "Explain differently" regeneration endpoint + frontend button
4. Code scenes: script agent detects coding topics, sets `is_code_scene: true`
5. CodeScene component with Monaco editor and test runner
6. Dialogue mode: TTS stitching, transcript with speaker labels

**Done when:** Videos reliably look good, CS topics have live coding, dialogue mode works.

---

### Phase 5 — Social + courses (Week 10–12)

**Goal: community layer is live.**

1. Favourites, publish, view count endpoints
2. Community feed page (`/explore`) with search and filters
3. Study rooms: WebSocket room manager, room creation/join flow, room page
4. Courses: CRUD endpoints, course builder UI, course player
5. User profile page: video history, favourites, streak calendar, knowledge radar

**Done when:** Users can publish videos, join study rooms, and build courses.

---

### Phase 6 — Spaced repetition + polish (Week 13–14)

**Goal: retention loop and production readiness.**

1. Flashcard deck generation from quiz cards
2. SM-2 algorithm review endpoint
3. Anki `.apkg` export
4. Built-in flashcard review UI (daily due cards)
5. Resume playback (restore `last_scene_index` on watch page load)
6. Streak system
7. Error handling, loading states, empty states throughout frontend
8. Rate limiting on generation endpoint (per user: max 10 videos/day)
9. Video thumbnail generation (render first SVG to PNG via Puppeteer)

**Done when:** The product is stable, polished, and ready for a public beta.

---

_Last updated: April 2026. Build Luminar — make learning something people actually look forward to._
