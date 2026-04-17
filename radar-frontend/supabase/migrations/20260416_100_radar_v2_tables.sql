-- Radar v2 — 2 tablas nuevas dentro del schema matec_radar existente.
-- NO modifica tablas existentes. Solo agrega radar_v2_sessions y radar_v2_results.

CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  linea_negocio    TEXT        NOT NULL,
  empresas_count   INT         NOT NULL DEFAULT 1,
  total_cost_usd   NUMERIC(10,4),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_results (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE CASCADE,
  empresa_id          BIGINT      REFERENCES matec_radar.empresas(id) ON DELETE SET NULL,
  empresa_evaluada    TEXT        NOT NULL,
  radar_activo        TEXT        CHECK (radar_activo IN ('Sí', 'No')),
  linea_negocio       TEXT,
  tipo_senal          TEXT,
  pais                TEXT,
  empresa_o_proyecto  TEXT,
  descripcion_resumen TEXT,
  criterios_cumplidos JSONB,
  total_criterios     INT         DEFAULT 0,
  ventana_compra      TEXT,
  monto_inversion     TEXT,
  fuente_link         TEXT,
  fuente_nombre       TEXT,
  fecha_senal         TEXT,
  evaluacion_temporal TEXT,
  observaciones       TEXT,
  motivo_descarte     TEXT,
  raw_json            JSONB       NOT NULL,
  tokens_input        INT,
  tokens_output       INT,
  cost_usd            NUMERIC(10,6),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radar_v2_results_session_idx   ON matec_radar.radar_v2_results(session_id);
CREATE INDEX IF NOT EXISTS radar_v2_results_empresa_idx   ON matec_radar.radar_v2_results(empresa_id);
CREATE INDEX IF NOT EXISTS radar_v2_results_activo_idx    ON matec_radar.radar_v2_results(radar_activo);
CREATE INDEX IF NOT EXISTS radar_v2_results_created_idx   ON matec_radar.radar_v2_results(created_at DESC);

COMMENT ON TABLE matec_radar.radar_v2_sessions IS 'Sesiones de escaneo con Agente 1 RADAR (Claude Sonnet 4.6 + web_search)';
COMMENT ON TABLE matec_radar.radar_v2_results  IS 'Resultados del Agente 1 RADAR — detección pura de señales de inversión LATAM';
