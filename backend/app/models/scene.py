from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .luminar import Luminar
    from .quiz import QuizCard

from sqlalchemy import String, Integer, ForeignKey, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base, AuditMixin
import uuid


class Scene(AuditMixin, Base):
    __tablename__ = "scenes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"))
    scene_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    narration_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Caption segments: [{text, start_ms, end_ms}] — word-level chunks at ~130wpm
    caption_segments: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    svg_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    dialogue_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    visual_style: Mapped[str] = mapped_column(String(32), default="concept_diagram")

    __table_args__ = (
        UniqueConstraint("luminar_id", "scene_index", name="uix_luminar_scene_index"),
    )

    luminar: Mapped["Luminar"] = relationship(back_populates="scenes")
    quiz_cards: Mapped[list["QuizCard"]] = relationship(back_populates="scene", cascade="all, delete-orphan")
