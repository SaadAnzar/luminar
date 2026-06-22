-- Widen luminars.source_type CHECK to allow docx / website / youtube.
-- Mirrors alembic migration 0002_extend_source_types, but name-agnostic and
-- idempotent so it's safe to apply to the live Supabase DB (whose constraint
-- was created via the Supabase MCP and may not be named `check_source_type`).
--
-- Strictly ADDITIVE: it only widens the allowed set, so existing rows (whose
-- values are all in the old set) cannot be invalidated.
--
-- Apply via the Supabase SQL editor, or:
--   psql "$DATABASE_URL_PSQL" -f backend/scripts/apply_source_types_prod.sql
-- (use the postgresql:// form of DATABASE_URL — drop the "+asyncpg").

BEGIN;

-- Drop whatever CHECK currently constrains source_type, by name, if present.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.luminars'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%source_type%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.luminars DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.luminars
  ADD CONSTRAINT check_source_type
  CHECK (source_type IN ('none','pdf','txt','ppt','docx','blog','website','youtube'));

COMMIT;

-- Verify:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid='public.luminars'::regclass AND conname='check_source_type';
