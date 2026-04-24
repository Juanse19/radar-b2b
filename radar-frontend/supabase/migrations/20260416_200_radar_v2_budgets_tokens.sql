-- Fase E v3: tablas de tokens granulares y budgets por sesión
-- NO toca tablas existentes (sessions, results, reports, rag_ingest_log)

-- ---------------------------------------------------------------------------
-- 1) Budget por sesión (límite + alertas + estado)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_budgets (
  session_id        UUID        PRIMARY KEY REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE CASCADE,
  limit_usd         NUMERIC(10,4) NOT NULL,
  alert_thresholds  JSONB       NOT NULL DEFAULT '[0.5, 0.8, 0.95, 1.0]'::jsonb,
  alerts_fired      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  consumed_usd      NUMERIC(10,4) NOT NULL DEFAULT 0,
  status            TEXT        CHECK (status IN ('ok','warning','blocked')) DEFAULT 'ok',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2) Eventos granulares de tokens por stage / empresa / provider
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_token_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE CASCADE,
  empresa_id  BIGINT      REFERENCES matec_radar.empresas(id) ON DELETE SET NULL,
  stage       TEXT        NOT NULL CHECK (stage IN ('prefilter_haiku','sonnet_scan','criteria_eval','report_gen')),
  provider    TEXT        NOT NULL,
  model       TEXT        NOT NULL,
  tokens_in   INT         NOT NULL DEFAULT 0,
  tokens_out  INT         NOT NULL DEFAULT 0,
  cost_usd    NUMERIC(10,6) NOT NULL DEFAULT 0,
  cached      BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_events_session  ON matec_radar.radar_v2_token_events(session_id);
CREATE INDEX IF NOT EXISTS idx_token_events_stage    ON matec_radar.radar_v2_token_events(stage);
CREATE INDEX IF NOT EXISTS idx_token_events_created  ON matec_radar.radar_v2_token_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) RLS — lectura autenticada, inserción solo service_role
-- ---------------------------------------------------------------------------

ALTER TABLE matec_radar.radar_v2_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_radar_v2_budgets" ON matec_radar.radar_v2_budgets
  FOR SELECT TO authenticated USING (TRUE);
GRANT ALL ON matec_radar.radar_v2_budgets TO service_role;

ALTER TABLE matec_radar.radar_v2_token_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_radar_v2_token_events" ON matec_radar.radar_v2_token_events
  FOR SELECT TO authenticated USING (TRUE);
GRANT ALL ON matec_radar.radar_v2_token_events TO service_role;

COMMENT ON TABLE matec_radar.radar_v2_budgets
  IS 'Budget y thresholds de alerta por sesión (Fase E v3)';
COMMENT ON TABLE matec_radar.radar_v2_token_events
  IS 'Eventos granulares de uso de tokens por stage/empresa/provider (Fase E v3)';
