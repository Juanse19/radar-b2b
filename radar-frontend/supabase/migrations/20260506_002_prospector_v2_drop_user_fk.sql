-- =============================================================================
-- Migración: Drop FK prospector_v2_sessions.user_id → users(id)
-- =============================================================================
-- Fecha:    2026-05-06
-- Razón:
--   Matec usa iron-session sobre matec_radar.usuarios, NO Supabase Auth
--   (auth.users). El FK añadido en la migración anterior bloquea cualquier
--   INSERT con un user_id que provenga de iron-session. Resultado:
--   createProspectorSession falla silenciosamente, contactos posteriores
--   violan el FK contactos.prospector_session_id por sesión inexistente.
--
--   Solución: mantenemos la columna user_id pero sin FK enforcement.
--   Es nullable y solo informativo (atribución de auditoría).
-- =============================================================================

ALTER TABLE matec_radar.prospector_v2_sessions
  DROP CONSTRAINT IF EXISTS prospector_v2_sessions_user_id_fkey;

COMMENT ON COLUMN matec_radar.prospector_v2_sessions.user_id
  IS 'UUID del usuario (matec_radar.usuarios o iron-session). Sin FK por compatibilidad con múltiples sistemas de auth.';
