import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from loguru import logger
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.models.luminar import Luminar
from app.models.user import User

router = APIRouter()

class LuminarFeedItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None = None
    prompt: str
    duration_minutes: int
    author_id: uuid.UUID
    author_name: str
    author_avatar_url: str | None = None
    created_at: datetime


@router.get("/feed", response_model=list[LuminarFeedItem])
async def get_discover_feed(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Public Discover feed: luminars their authors have published."""
    logger.info("Fetching discover feed")

    result = await db.execute(
        select(Luminar, User.id, User.name, User.avatar_url)
        .join(User, User.id == Luminar.user_id)
        .where(Luminar.status == "ready", Luminar.published.is_(True))
        .order_by(desc(Luminar.created_at))
        .limit(60)
    )

    return [
        {
            "id": luminar.id,
            "title": luminar.title,
            "description": luminar.description,
            "prompt": luminar.prompt,
            "duration_minutes": luminar.duration_minutes,
            "author_id": author_id,
            "author_name": name,
            "author_avatar_url": avatar_url,
            "created_at": luminar.created_at,
        }
        for luminar, author_id, name, avatar_url in result.all()
    ]
