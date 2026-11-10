"""Uploaded-video assessments, assessment directory, luminar likes & views

Additive:
- assessments: + video_url, transcript (JSONB), listed; source_type also allows 'upload'
- luminar_likes / luminar_views: one row per (user, luminar)

Revision ID: 0006_uploads_engagement
Revises: 0005_assessments
Create Date: 2026-11-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_uploads_engagement"
down_revision: Union[str, None] = "0005_assessments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENGAGEMENT_TABLES = ("luminar_likes", "luminar_views")


def upgrade() -> None:
    op.add_column("assessments", sa.Column("video_url", sa.Text(), nullable=True))
    op.add_column("assessments", sa.Column("transcript", postgresql.JSONB(), nullable=True))
    op.add_column("assessments", sa.Column("listed", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.drop_constraint("check_assessment_source_type", "assessments", type_="check")
    op.create_check_constraint(
        "check_assessment_source_type", "assessments", "source_type IN ('youtube','upload','luminar')"
    )

    for table, uix in (("luminar_likes", "uix_luminar_like_user"), ("luminar_views", "uix_luminar_view_user")):
        op.create_table(
            table,
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("luminar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("luminars.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.UniqueConstraint("user_id", "luminar_id", name=uix),
        )
        op.create_index(f"ix_{table}_luminar_id", table, ["luminar_id"])
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(ENGAGEMENT_TABLES):
        op.drop_table(table)
    op.drop_constraint("check_assessment_source_type", "assessments", type_="check")
    op.create_check_constraint("check_assessment_source_type", "assessments", "source_type IN ('youtube','luminar')")
    for col in ("listed", "transcript", "video_url"):
        op.drop_column("assessments", col)
