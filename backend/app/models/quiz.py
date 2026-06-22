from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .scene import Scene
    from .user import User
    from .luminar import Luminar

from sqlalchemy import Integer, ForeignKey, Text, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base, AuditMixin
import uuid


class QuizCard(AuditMixin, Base):
    __tablename__ = "quiz_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scene_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"))
    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(8), default="medium")

    # Exact ms from video start when the quiz overlay should appear
    trigger_at_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    scene: Mapped["Scene"] = relationship(back_populates="quiz_cards")
    attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="quiz_card", cascade="all, delete-orphan")


class QuizAttempt(AuditMixin, Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"))
    quiz_card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_cards.id", ondelete="CASCADE"))
    selected_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    time_to_answer_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz_card: Mapped["QuizCard"] = relationship(back_populates="attempts")
