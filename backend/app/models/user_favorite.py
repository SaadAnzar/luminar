from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User
    from .luminar import Luminar

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="favorites")
    luminar: Mapped["Luminar"] = relationship(back_populates="favorites")
