-- Add luminars.published for the Discover feed (mirrors migration 0003).
-- Additive + idempotent: existing rows default to false (private).
-- Apply via the Supabase SQL editor, or:
--   psql "$DATABASE_URL_PSQL" -f backend/scripts/apply_published_prod.sql

ALTER TABLE public.luminars
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

-- Verify:
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'luminars' AND column_name = 'published';
