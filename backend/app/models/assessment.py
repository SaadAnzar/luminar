"""Assessments — teacher-authored question sheets on a video, shareable by link.

Ported from the standalone `pulse` / `oraci` apps: an owner builds a set of
timed multiple-choice questions over a YouTube video (or one of their
luminars), publishes it, and shares the link. Learners answer in-line — a
wrong answer earns an AI hint and another try — and the owner sees
per-learner and per-question results.
"""
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User

from sqlalchemy import String, Integer, Boolean, ForeignKey, Text, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base, AuditMixin
import uuid


class Assessment(AuditMixin, Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 'youtube' → timed questions over an embedded YouTube video
    # 'luminar' → questions over one of the owner's luminars (untimed list)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    youtube_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    luminar_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="SET NULL"), nullable=True
    )

    # Only published assessments can be opened/answered by anyone but the owner.
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship()
    questions: Mapped[list["AssessmentQuestion"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan", order_by="AssessmentQuestion.position"
    )
    submissions: Mapped[list["AssessmentSubmission"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("source_type IN ('youtube','luminar')", name="check_assessment_source_type"),
    )


class AssessmentQuestion(AuditMixin, Base):
    __tablename__ = "assessment_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # Seconds into the video where playback pauses for this question (YouTube source).
    time_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)  # exactly 4 strings
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="questions")

    __table_args__ = (
        CheckConstraint("correct_index BETWEEN 0 AND 3", name="check_assessment_correct_index"),
    )


class AssessmentSubmission(AuditMixin, Base):
    """One learner's run through an assessment (created on their first answer)."""
    __tablename__ = "assessment_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))

    assessment: Mapped["Assessment"] = relationship(back_populates="submissions")
    user: Mapped["User"] = relationship()
    answers: Mapped[list["AssessmentAnswer"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("assessment_id", "user_id", name="uix_assessment_submission_user"),
    )


class AssessmentAnswer(AuditMixin, Base):
    """A learner's state on one question: tries until solved, hints received."""
    __tablename__ = "assessment_answers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_submissions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_questions.id", ondelete="CASCADE")
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    solved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    first_try_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hints_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    submission: Mapped["AssessmentSubmission"] = relationship(back_populates="answers")

    __table_args__ = (
        UniqueConstraint("submission_id", "question_id", name="uix_assessment_answer_question"),
    )
