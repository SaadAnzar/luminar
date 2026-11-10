"""Add assessments (teacher-authored, shareable question sheets on a video)

Additive: four new tables, no changes to existing ones. Ported from the
standalone pulse/oraci apps. RLS is enabled to match the rest of the schema
(the backend connects as the table owner, so it is unaffected; this only
keeps the tables closed to Supabase's public PostgREST API).

Revision ID: 0005_assessments
Revises: 0004_user_profile
Create Date: 2026-11-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_assessments"
down_revision: Union[str, None] = "0004_user_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("assessments", "assessment_questions", "assessment_submissions", "assessment_answers")


def _audit_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(length=16), nullable=False),
        sa.Column("youtube_url", sa.Text(), nullable=True),
        sa.Column("luminar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("luminars.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_audit_columns(),
        sa.CheckConstraint("source_type IN ('youtube','luminar')", name="check_assessment_source_type"),
    )
    op.create_index("ix_assessments_user_id", "assessments", ["user_id"])

    op.create_table(
        "assessment_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("time_s", sa.Integer(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=False),
        sa.Column("correct_index", sa.Integer(), nullable=False),
        sa.Column("hint", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        *_audit_columns(),
        sa.CheckConstraint("correct_index BETWEEN 0 AND 3", name="check_assessment_correct_index"),
    )
    op.create_index("ix_assessment_questions_assessment_id", "assessment_questions", ["assessment_id"])

    op.create_table(
        "assessment_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        *_audit_columns(),
        sa.UniqueConstraint("assessment_id", "user_id", name="uix_assessment_submission_user"),
    )
    op.create_index("ix_assessment_submissions_assessment_id", "assessment_submissions", ["assessment_id"])

    op.create_table(
        "assessment_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessment_submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessment_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("solved", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("first_try_correct", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("hints_used", sa.Integer(), server_default="0", nullable=False),
        *_audit_columns(),
        sa.UniqueConstraint("submission_id", "question_id", name="uix_assessment_answer_question"),
    )
    op.create_index("ix_assessment_answers_submission_id", "assessment_answers", ["submission_id"])

    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
