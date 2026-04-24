-- Migration: 20260421_101_radar_v2_feedback
-- Purpose: Feedback table for scan result quality signals (👍/👎)
-- Physical table uses radar_v2_* naming convention (views created separately).

SET search_path = matec_radar;

CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_feedback (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT,
  resultado_id UUID        REFERENCES matec_radar.radar_v2_results(id) ON DELETE SET NULL,
  util         BOOLEAN     NOT NULL,
  motivo       TEXT        CHECK (motivo IN (
                             'fuente_falsa',
                             'fecha_equivocada',
                             'empresa_irrelevante',
                             'senal_real',
                             'otro'
                           )),
  comentario   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_v2_feedback_resultado_id
  ON matec_radar.radar_v2_feedback (resultado_id);

CREATE INDEX IF NOT EXISTS idx_radar_v2_feedback_util
  ON matec_radar.radar_v2_feedback (util);

-- View (comercial namespace alias)
CREATE OR REPLACE VIEW matec_radar.comercial_feedback
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_feedback;

DO $$
BEGIN
  RAISE NOTICE 'radar_v2_feedback table + comercial_feedback view created OK';
END $$;
