"""Extend luminar source_type CHECK to allow docx / website / youtube

Adds ingestion source types for .docx uploads, generic website URLs, and
YouTube links (see docs/PLAN.md §3.1).

NOTE: The live schema is managed in Supabase (0001_init is a no-op baseline
applied directly via Supabase MCP). Apply this change to the live DB either by
running `alembic upgrade head` against it, or via the equivalent Supabase
migration — the SQL is the drop/add of the `check_source_type` constraint below.

Revision ID: 0002_extend_source_types
Revises: 0001_init
Create Date: 2026-06-21
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002_extend_source_types"
down_revision: Union[str, None] = "0001_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD = "source_type IN ('none','pdf','txt','ppt','blog')"
_NEW = "source_type IN ('none','pdf','txt','ppt','docx','blog','website','youtube')"


def upgrade() -> None:
    op.drop_constraint("check_source_type", "luminars", type_="check")
    op.create_check_constraint("check_source_type", "luminars", _NEW)


def downgrade() -> None:
    op.drop_constraint("check_source_type", "luminars", type_="check")
    op.create_check_constraint("check_source_type", "luminars", _OLD)
