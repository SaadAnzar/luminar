from sqlalchemy import String, Float, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base, AuditMixin
import uuid
from sqlalchemy.dialects.postgresql import UUID


class ConceptNode(AuditMixin, Base):
    __tablename__ = "concept_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0 to 1.0

    __table_args__ = (
        UniqueConstraint("user_id", "label", name="uix_user_concept_label"),
    )


class LuminarConceptLink(Base):
    __tablename__ = "luminar_concepts"

    luminar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("luminars.id", ondelete="CASCADE"), primary_key=True)
    concept_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("concept_nodes.id", ondelete="CASCADE"), primary_key=True)
