import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.luminar import Luminar
from app.models.user_favorite import UserFavorite
from app.schemas.luminar import LuminarInDB

router = APIRouter()


@router.post("/{luminar_id}", status_code=201)
async def add_favorite(
    luminar_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    luminar = await db.get(Luminar, luminar_id)
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")

    existing = await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == current_user.id,
            UserFavorite.luminar_id == luminar_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_favorited"}

    db.add(UserFavorite(user_id=current_user.id, luminar_id=luminar_id))
    await db.commit()
    return {"status": "favorited"}


@router.delete("/{luminar_id}", status_code=200)
async def remove_favorite(
    luminar_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await db.execute(
        delete(UserFavorite).where(
            UserFavorite.user_id == current_user.id,
            UserFavorite.luminar_id == luminar_id,
        )
    )
    await db.commit()
    return {"status": "unfavorited"}


@router.get("/", response_model=list[LuminarInDB])
async def get_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Luminar]:
    result = await db.execute(
        select(Luminar)
        .join(UserFavorite, UserFavorite.luminar_id == Luminar.id)
        .where(UserFavorite.user_id == current_user.id)
        .order_by(UserFavorite.created_at.desc())
    )
    return list(result.scalars().all())
