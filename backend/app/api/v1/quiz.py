import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.quiz import QuizCard, QuizAttempt
from app.models.user import User
from app.services.adaptive_engine import update_mastery_from_quiz

router = APIRouter()


class QuizAttemptIn(BaseModel):
    selected_index: int
    hint_used: bool = False
    time_to_answer_ms: int | None = None


class QuizAttemptResponse(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str | None = None
    hint: str | None = None
    new_mastery_updated: bool = False


@router.get("/{luminar_id}/cards")
async def get_quiz_cards(
    luminar_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(QuizCard).where(QuizCard.luminar_id == luminar_id).order_by(QuizCard.trigger_at_ms)
    )
    cards = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "scene_id": str(c.scene_id),
            "question": c.question,
            "options": c.options,
            "hint": c.hint,
            "difficulty": c.difficulty,
            "trigger_at_ms": c.trigger_at_ms,
        }
        for c in cards
    ]


@router.post("/{quiz_card_id}/attempt", response_model=QuizAttemptResponse)
async def attempt_quiz(
    quiz_card_id: uuid.UUID,
    attempt_in: QuizAttemptIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizAttemptResponse:
    logger.info(f"User {current_user.id} attempting quiz card {quiz_card_id}")

    result = await db.execute(select(QuizCard).where(QuizCard.id == quiz_card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Quiz card not found")

    is_correct = attempt_in.selected_index == card.correct_index

    db.add(QuizAttempt(
        user_id=current_user.id,
        luminar_id=card.luminar_id,
        quiz_card_id=quiz_card_id,
        selected_index=attempt_in.selected_index,
        is_correct=is_correct,
        hint_used=attempt_in.hint_used,
        time_to_answer_ms=attempt_in.time_to_answer_ms,
    ))
    await db.commit()

    # Update mastery scores based on this attempt
    await update_mastery_from_quiz(current_user.id, quiz_card_id, is_correct, db)

    return QuizAttemptResponse(
        is_correct=is_correct,
        correct_index=card.correct_index,
        explanation=card.explanation,
        hint=card.hint,
        new_mastery_updated=True,
    )
