import { defineConfig, devices } from "@playwright/test"

/**
 * Visual/e2e harness for the player. Drives the real frontend against a LOCAL
 * backend (port 8010) seeded by `backend/scripts/seed_dev.py` — never prod.
 *
 * Prereqs (see e2e/README.md):
 *   1. createdb luminar_dev
 *   2. PYTHONPATH=. LOCAL_DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev \
 *        .venv/bin/python scripts/seed_dev.py
 *   3. DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev ENVIRONMENT=development \
 *        CORS_ORIGINS='["http://localhost:5180"]' uvicorn app.main:app --port 8010
 *   4. npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:5180",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "VITE_API_BASE_URL=http://localhost:8010 VITE_WS_BASE_URL=ws://localhost:8010 npm run dev -- --port 5180 --strictPort",
    url: "http://localhost:5180",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
