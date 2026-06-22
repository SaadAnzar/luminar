-- Add learner-profile fields to users (mirrors migration 0004).
-- Additive + idempotent. Apply via Supabase SQL editor or psql.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarded      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests      jsonb,
  ADD COLUMN IF NOT EXISTS goals          jsonb,
  ADD COLUMN IF NOT EXISTS skill_level    varchar(16),
  ADD COLUMN IF NOT EXISTS learning_style varchar(16);
