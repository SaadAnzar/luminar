"""Add learner-profile fields to users (onboarding + tailoring)

Additive: onboarded defaults false; the rest are nullable.

Revision ID: 0004_user_profile
Revises: 0003_luminar_published
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_user_profile"
down_revision: Union[str, None] = "0003_luminar_published"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("interests", postgresql.JSONB(), nullable=True))
    op.add_column("users", sa.Column("goals", postgresql.JSONB(), nullable=True))
    op.add_column("users", sa.Column("skill_level", sa.String(length=16), nullable=True))
    op.add_column("users", sa.Column("learning_style", sa.String(length=16), nullable=True))


def downgrade() -> None:
    for col in ("learning_style", "skill_level", "goals", "interests", "onboarded"):
        op.drop_column("users", col)
