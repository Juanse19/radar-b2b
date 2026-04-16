-- Audit: who triggered each radar scan
-- NOTE: senales table was dropped by _0015. Only radar_scans is altered here.
-- When n8n is restored, it will read ejecutado_por_* from the webhook payload and INSERT it.

ALTER TABLE matec_radar.radar_scans
  ADD COLUMN IF NOT EXISTS ejecutado_por_id     TEXT,
  ADD COLUMN IF NOT EXISTS ejecutado_por_nombre TEXT;

-- Index for fast per-user filtering on radar_scans
CREATE INDEX IF NOT EXISTS idx_radar_scans_ejecutado_por_id
  ON matec_radar.radar_scans (ejecutado_por_id);

COMMENT ON COLUMN matec_radar.radar_scans.ejecutado_por_id IS 'User ID from matec_session who triggered the scan';
COMMENT ON COLUMN matec_radar.radar_scans.ejecutado_por_nombre IS 'Display name of user who triggered the scan';
