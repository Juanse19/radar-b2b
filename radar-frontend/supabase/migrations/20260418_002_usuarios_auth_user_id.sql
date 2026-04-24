-- Migration 20260418_002 — Ensure auth_user_id exists on matec_radar.usuarios
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Safe to run on a DB that already
-- has the column (from 20260408_003_auth_and_admin.sql) or one that doesn't.
--
-- This column links each app user row to a Supabase Auth identity.
-- Used by resolveSessionFromSupabaseUser() in lib/auth/session.ts.

ALTER TABLE matec_radar.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for fast lookup during login (resolveSessionFromSupabaseUser queries by this column).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_user_id
  ON matec_radar.usuarios (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN matec_radar.usuarios.auth_user_id IS
  'Supabase Auth user UUID (auth.users.id). Used to link app user to Supabase identity.';
