# Project Audit: Luminar Stack Inventory

## Backend (Python)
- **Interpreter**: Python 3.14.3
- **FastAPI**: 0.135.3
- **Pydantic**: 2.12.5 (v2)
- **SQLAlchemy**: 2.0.49 (asyncio enabled)
- **Background Tasks**: Celery (v5.5.0.rc3), Redis (v7.4.0)
- **Auth**: Supabase Auth + `python-jose` (3.5.0) for JWT validation
- **Environment**: `pydantic-settings` (2.13.1), `python-dotenv` (1.2.2)
- **Logging**: Standard library `logging`
- **Database Driver**: `asyncpg` (used via SQLAlchemy `asyncio`)

## Frontend (React/Vite)
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.1
- **Styling**: Tailwind CSS v4.0.0-alpha.25
- **Icons**: Lucide React 0.446.0
- **State Management**: Zustand (implied by plan, checking implementation...)
- **Routing**: TanStack Router 1.58.1
- **Data Fetching**: TanStack Query 5.56.2
- **UI Components**: shadcn/ui (style: base-nova, baseColor: neutral)
- **Type System**: TypeScript 5.5.3 (strict mode: enabled)

## Infrastructure
- **Containerization**: Dockerfile present, docker-compose.yml present.
- **Workflow / CI**: None currently in place.
- **Secrets Management**: .env files.
