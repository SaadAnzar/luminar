# Luminar AI: The Future of Personalized Learning

Luminar is an end-to-end AI educational platform that transforms static topics and documents into interactive, multimedi-rich learning experiences. Grounded in research and powered by an agentic orchestration engine, Luminar helps students master complex subjects through adaptive visualization, collaborative study, and active recall.

## 🚀 Key Features

- **Document-Grounded Generation**: Upload research PDFs or documentation to guide the AI's educational blueprint.
- **Agentic Pipeline**: A multi-agent system (Orchestrator, Scriptwriter, Animator, TTS, QA) that builds high-fidelity educational videos from scratch.
- **Interactive Coding Scenes**: Live Monaco-powered coding challenges integrated directly into the video player.
- **Collaborative Study Rooms**: Real-time watch parties with shared player synchronization and unique join codes.
- **Automated Citations**: Fact-checked claims with direct links to authoritative sources (MDN, Wikipedia, official docs).
- **Mastery Ecosystem**: Spaced-repetition flashcard export (Anki), Quiz gates, and adaptive "Explain It Differently" re-generation.
- **Knowledge Graph Learning**: Visualizing subject mastery through dynamic concept nodes and mastery heatmaps.

## 🛠 Tech Stack

- **Frontend**: React (Vite), TanStack Router, TanStack Query, Monaco Editor, Lucide Icons.
- **Backend**: FastAPI (Python), PydanticAI, Celery + Redis, SQLAlchemy.
- **Infrastructure**: Supabase (PostgreSQL, Auth, S3 Storage), OpenAI (GPT-4o, TTS, Whisper).

## 📦 Setup & Installation

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. Configure `.env` with OpenAI and Supabase credentials.
4. `uvicorn app.main:app --reload`
5. (Worker) `celery -A app.tasks.celery_app worker --loglevel=info`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 🛡 Stability & QA
Every generated asset passes through a **Quality Review Agent** to ensure semantic accuracy between visuals and narration. The platform features robust error boundaries and real-time progress tracking via WebSockets.
