-- Verificación de veracidad + informes + RAG log
-- NO toca tablas existentes pre-v2

-- 1) Columnas de verificación en resultados
ALTER TABLE matec_radar.radar_v2_results
  ADD COLUMN IF NOT EXISTS fuente_verificada TEXT
    CHECK (fuente_verificada IN ('verificada','no_verificable','pendiente','no_aplica'))
    DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS verificacion_http_status INT NULL,
  ADD COLUMN IF NOT EXISTS verificacion_fecha_valida BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS verificacion_monto_coincide BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS verificacion_notas TEXT NULL,
  ADD COLUMN IF NOT EXISTS verificado_en TIMESTAMPTZ NULL;

-- 2) Contadores y duración en sesiones
ALTER TABLE matec_radar.radar_v2_sessions
  ADD COLUMN IF NOT EXISTS duration_ms INT NULL,
  ADD COLUMN IF NOT EXISTS activas_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descartadas_count INT DEFAULT 0;

-- 3) Snapshot de informe por sesión
CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE
    REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE CASCADE,
  resumen   JSONB NOT NULL,
  activas   JSONB NOT NULL,
  descartes JSONB NOT NULL,
  markdown  TEXT  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) RAG ingest log
CREATE TABLE IF NOT EXISTS matec_radar.radar_v2_rag_ingest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('senal','criterio','keyword','fuente_confiable')),
  vector_id TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'radar_v2',
  embedding_model TEXT NOT NULL,
  chunk_chars INT NOT NULL,
  cost_usd NUMERIC(10,8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_v2_results_verificada
  ON matec_radar.radar_v2_results(fuente_verificada);

CREATE INDEX IF NOT EXISTS idx_radar_v2_sessions_created_at
  ON matec_radar.radar_v2_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_ingest_session
  ON matec_radar.radar_v2_rag_ingest_log(session_id);

-- RLS para nuevas tablas
ALTER TABLE matec_radar.radar_v2_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_radar_v2_reports" ON matec_radar.radar_v2_reports
  FOR SELECT TO authenticated USING (TRUE);
GRANT ALL ON matec_radar.radar_v2_reports TO service_role;

ALTER TABLE matec_radar.radar_v2_rag_ingest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_radar_v2_rag_log" ON matec_radar.radar_v2_rag_ingest_log
  FOR SELECT TO authenticated USING (TRUE);
GRANT ALL ON matec_radar.radar_v2_rag_ingest_log TO service_role;
