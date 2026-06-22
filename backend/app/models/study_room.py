from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .luminar import Luminar
    from .user import User

from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, AuditMixin
import uuid
from sqlalchemy.dialects.postgresql import UUID


class StudyRoom(AuditMixin, Base):
    __tablename__ = "study_rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"))
    host_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    luminar: Mapped["Luminar"] = relationship()
    host: Mapped["User"] = relationship()
    participants: Mapped[list["StudyParticipant"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class StudyParticipant(AuditMixin, Base):
    __tablename__ = "study_room_participants"

    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    room: Mapped["StudyRoom"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()
