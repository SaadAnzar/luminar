"""Public engagement on luminars: likes and unique views (one row per user).

Distinct from UserFavorite, which is a private bookmark.
"""
import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, AuditMixin


class LuminarLike(AuditMixin, Base):
    __tablename__ = "luminar_likes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    luminar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (UniqueConstraint("user_id", "luminar_id", name="uix_luminar_like_user"),)


class LuminarView(AuditMixin, Base):
    __tablename__ = "luminar_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    luminar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (UniqueConstraint("user_id", "luminar_id", name="uix_luminar_view_user"),)
