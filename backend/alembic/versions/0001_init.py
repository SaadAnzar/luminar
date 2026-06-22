"""Luminar initial schema — applied directly via Supabase MCP

Revision ID: 0001_init
Revises:
Create Date: 2026-05-16

Schema (all tables created in Supabase, RLS enabled):
  users, luminars, scenes, quiz_cards, quiz_attempts,
  user_favorites, concept_nodes, luminar_concepts,
  study_rooms, study_room_participants
"""
from typing import Sequence, Union

revision: str = "0001_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema was applied directly via Supabase MCP migrations:
    #   drop_all_and_recreate_luminars
    #   enable_rls_and_policies
    # Run `alembic stamp 0001_init` to mark this baseline applied.
    pass


def downgrade() -> None:
    pass
