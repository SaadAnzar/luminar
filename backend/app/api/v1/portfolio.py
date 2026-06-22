from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.quiz import QuizAttempt, QuizCard
from app.models.luminar import Luminar

router = APIRouter()


class ConceptStat(BaseModel):
    luminar_id: str
    luminar_title: str | None = None
    total_attempts: int
    correct: int
    accuracy_pct: float
    hint_uses: int


class PortfolioResponse(BaseModel):
    total_attempts: int
    total_correct: int
    overall_accuracy_pct: float
    by_luminar: list[ConceptStat]


@router.get("/", response_model=PortfolioResponse)
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    result = await db.execute(
        select(
            QuizAttempt.luminar_id,
            func.count(QuizAttempt.id).label("total"),
            func.sum(
                func.cast(QuizAttempt.is_correct, __import__('sqlalchemy').Integer())
            ).label("correct"),
            func.sum(
                func.cast(QuizAttempt.hint_used, __import__('sqlalchemy').Integer())
            ).label("hints"),
        )
        .where(QuizAttempt.user_id == current_user.id)
        .group_by(QuizAttempt.luminar_id)
    )
    rows = result.all()

    by_luminar: list[ConceptStat] = []
    grand_total = 0
    grand_correct = 0

    for row in rows:
        total = row.total or 0
        correct = int(row.correct or 0)
        hints = int(row.hints or 0)
        grand_total += total
        grand_correct += correct

        v_result = await db.execute(select(Luminar.title).where(Luminar.id == row.luminar_id))
        v_title = v_result.scalar_one_or_none()

        by_luminar.append(ConceptStat(
            luminar_id=str(row.luminar_id),
            luminar_title=v_title,
            total_attempts=total,
            correct=correct,
            accuracy_pct=round(correct / total * 100, 1) if total else 0.0,
            hint_uses=hints,
        ))

    overall = round(grand_correct / grand_total * 100, 1) if grand_total else 0.0
    return PortfolioResponse(
        total_attempts=grand_total,
        total_correct=grand_correct,
        overall_accuracy_pct=overall,
        by_luminar=by_luminar,
    )
