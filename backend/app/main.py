from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, get_db
from app.core.logging import setup_logging, RequestIDMiddleware
from app.core.scheduler import scheduler, register_jobs
from app.api.v1.router import api_router

# Setup logging configuration
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Lifespan Startup
    register_jobs()
    scheduler.start()

    # DB check
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    # Fail any luminar left mid-generation by a previous crash/restart —
    # in-memory APScheduler jobs don't survive a restart.
    from app.jobs.luminar_jobs import recover_stuck_luminars
    await recover_stuck_luminars()

    yield
    
    # Lifespan Shutdown
    scheduler.shutdown(wait=False)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Middleware Registration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware)
app.add_middleware(RequestIDMiddleware)

# API Router Registration
app.include_router(api_router, prefix="/api/v1")

@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "version": settings.VERSION}

@app.get("/ready", tags=["health"])
async def ready_check(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    # Check if DB is reachable
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)