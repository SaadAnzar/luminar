from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .luminar import Luminar
    from .user_favorite import UserFavorite

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base, AuditMixin
import uuid


class User(AuditMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Learner profile (collected at onboarding, editable; used to tailor generation)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    interests: Mapped[list | None] = mapped_column(JSONB, nullable=True)        # ["machine learning", ...]
    goals: Mapped[list | None] = mapped_column(JSONB, nullable=True)            # ["exam prep", "career", ...]
    skill_level: Mapped[str | None] = mapped_column(String(16), nullable=True)  # beginner|intermediate|advanced
    learning_style: Mapped[str | None] = mapped_column(String(16), nullable=True)  # concise|balanced|in_depth

    luminars: Mapped[list["Luminar"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    favorites: Mapped[list["UserFavorite"]] = relationship(back_populates="user", cascade="all, delete-orphan")
