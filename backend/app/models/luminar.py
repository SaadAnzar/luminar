from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User
    from .scene import Scene
    from .user_favorite import UserFavorite

from sqlalchemy import String, Integer, Boolean, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base, AuditMixin
import uuid


class Luminar(AuditMixin, Base):
    __tablename__ = "luminars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_type: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    dialogue_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    voice_style: Mapped[str] = mapped_column(String(32), default="alloy")

    # full_script: [{scene_index, narration, caption_segments, estimated_duration_ms}]
    full_script: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # From orchestrator blueprint
    key_concepts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    suggested_next_topics: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # "easy" when generated with weak-area context, "hard" when user is strong on concepts
    difficulty_hint: Mapped[str] = mapped_column(String(8), default="medium")

    # pending → script_generating → script_ready → assets_generating → ready | failed
    status: Mapped[str] = mapped_column(String(32), default="pending")

    # When true (and status=ready), appears in the public Discover feed.
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="luminars")
    scenes: Mapped[list["Scene"]] = relationship(back_populates="luminar", cascade="all, delete-orphan", order_by="Scene.scene_index")
    favorites: Mapped[list["UserFavorite"]] = relationship(back_populates="luminar", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("duration_minutes IN (2, 3, 5)", name="check_duration_minutes"),
        CheckConstraint(
            "source_type IN ('none','pdf','txt','ppt','docx','blog','website','youtube')",
            name="check_source_type",
        ),
    )
