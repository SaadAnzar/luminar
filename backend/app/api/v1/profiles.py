import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.user import User
from app.models.luminar import Luminar
from pydantic import BaseModel

router = APIRouter()


class RecentLuminarOut(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    duration_minutes: int
    created_at: str


class ProfileOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None
    total_luminars: int
    ready_luminars: int
    recent_luminars: list[RecentLuminarOut]


@router.get("/{user_id}", response_model=ProfileOut)
async def get_user_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ProfileOut:
    u_result = await db.execute(select(User).where(User.id == user_id))
    user = u_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    total = (await db.execute(
        select(func.count(Luminar.id)).where(Luminar.user_id == user_id)
    )).scalar() or 0

    ready = (await db.execute(
        select(func.count(Luminar.id)).where(Luminar.user_id == user_id, Luminar.status == "ready")
    )).scalar() or 0

    recent_result = await db.execute(
        select(Luminar)
        .where(Luminar.user_id == user_id)
        .order_by(Luminar.created_at.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()

    return ProfileOut(
        id=user.id,
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        total_luminars=total,
        ready_luminars=ready,
        recent_luminars=[
            RecentLuminarOut(
                id=v.id,
                title=v.title,
                status=v.status,
                duration_minutes=v.duration_minutes,
                created_at=v.created_at.isoformat(),
            )
            for v in recent
        ],
    )
