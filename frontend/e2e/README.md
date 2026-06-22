# Local visual / e2e harness

Drives the **real** frontend against a **local** backend + Postgres seeded with a
ready luminar. Never touches production (the committed `.env` points at prod
Supabase — the harness overrides `DATABASE_URL` to a local DB).

## One-time setup

```bash
createdb luminar_dev
cd frontend && npx playwright install chromium
```

## Run

1. **Seed** the local DB (creates schema from the SQLAlchemy models + inserts a
   ready luminar with scenes & quiz cards, and writes `backend/scripts/.dev-seed.json`):

   ```bash
   cd backend
   PYTHONPATH=. LOCAL_DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev \
     .venv/bin/python scripts/seed_dev.py
   ```

2. **Run the local backend** on port 8010 (override DB + CORS; needs no OpenAI/S3
   for the read/quiz paths):

   ```bash
   cd backend
   DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev ENVIRONMENT=development \
     CORS_ORIGINS='["http://localhost:5180"]' \
     .venv/bin/python -m uvicorn app.main:app --port 8010
   ```

3. **Run the tests** (Playwright auto-starts the Vite dev server on :5180 pointed
   at the :8010 backend):

   ```bash
   cd frontend
   npm run test:e2e          # headless
   npm run test:e2e:headed   # watch it drive the browser
   ```

Screenshots land in `frontend/e2e/__screens__/` (gitignored).

## What it verifies

- Watch player renders (scene SVG, chaptered timeline with scene ticks + quiz-gate
  markers, transport controls, Script/Scenes/Concepts panel).
- Quiz overlay gates at the scene boundary.
- Quiz attempt → live grading via the real backend (`POST /quiz/{id}/attempt` →
  adaptive engine → DB) returns correct/explanation feedback.

## Notes

- Ports 8010 (backend) and 5180 (frontend) are used to avoid colliding with a
  normal dev stack on 8000/5173.
- To extend coverage (completion overlay, retry flow, ingestion), add specs under
  `e2e/` and reseed as needed.
