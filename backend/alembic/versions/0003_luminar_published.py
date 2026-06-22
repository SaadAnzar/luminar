"""Add luminars.published (Discover feed visibility)

Additive: a boolean defaulting to false, so existing rows stay private.

Revision ID: 0003_luminar_published
Revises: 0002_extend_source_types
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_luminar_published"
down_revision: Union[str, None] = "0002_extend_source_types"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "luminars",
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("luminars", "published")
