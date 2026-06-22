from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.asyncio import AsyncIOExecutor
from loguru import logger

# In-memory job store — no DB connection needed.
# APScheduler jobs are ephemeral; they'll re-register on next startup.
scheduler = AsyncIOScheduler(
    executors={"default": AsyncIOExecutor()},
    job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 60},
    timezone="UTC",
)


def register_jobs() -> None:
    logger.info("Registering background jobs...")
    # Add recurring jobs here, e.g.:
    # from app.jobs.streaks import update_all_streaks
    # scheduler.add_job(update_all_streaks, "cron", hour=0, id="update_streaks", replace_existing=True)
