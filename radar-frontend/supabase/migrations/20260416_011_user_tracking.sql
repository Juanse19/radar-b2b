-- Audit: who triggered each radar scan
-- Applied to senales table (written by n8n) and radar_scans (also written by n8n)
-- When n8n is restored, it will read ejecutado_por_* from the webhook payload and INSERT it

ALTER TABLE matec_radar.senales
  ADD COLUMN IF NOT EXISTS ejecutado_por_id     TEXT,
  ADD COLUMN IF NOT EXISTS ejecutado_por_nombre TEXT;

ALTER TABLE matec_radar.radar_scans
  ADD COLUMN IF NOT EXISTS ejecutado_por_id     TEXT,
  ADD COLUMN IF NOT EXISTS ejecutado_por_nombre TEXT;

-- Index for fast per-user filtering
CREATE INDEX IF NOT EXISTS idx_senales_ejecutado_por_id
  ON matec_radar.senales (ejecutado_por_id);

COMMENT ON COLUMN matec_radar.senales.ejecutado_por_id IS 'User ID from matec_session who triggered the scan';
COMMENT ON COLUMN matec_radar.senales.ejecutado_por_nombre IS 'Display name of user who triggered the scan';
