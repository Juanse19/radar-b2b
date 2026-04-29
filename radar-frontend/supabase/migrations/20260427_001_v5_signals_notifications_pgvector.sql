-- MAOA v5 · Sesión 1 — Migraciones BD para Modo Señales, Portafolio, Notificaciones, Calificación v2 y RAG en pgvector.
-- Idempotente: usa IF NOT EXISTS / IF EXISTS en todos los DDL.

-- ─────────────────────────────────────────────────────────────────
-- 1. Extensión pgvector (necesaria para columnas embedding)
-- ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────
-- 2. radar_v2_sessions — agregar modo + provider
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE matec_radar.radar_v2_sessions
  ADD COLUMN IF NOT EXISTS modo     TEXT DEFAULT 'empresa' CHECK (modo IN ('empresa', 'señales', 'chat')),
  ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS radar_v2_sessions_modo_idx ON matec_radar.radar_v2_sessions(modo);

-- ─────────────────────────────────────────────────────────────────
-- 3. radar_v2_results — agregar nivel_confianza + embedding
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE matec_radar.radar_v2_results
  ADD COLUMN IF NOT EXISTS nivel_confianza TEXT CHECK (nivel_confianza IN ('ALTA','MEDIA','BAJA')),
  ADD COLUMN IF NOT EXISTS embedding       VECTOR(1536);

CREATE INDEX IF NOT EXISTS radar_v2_results_confianza_idx ON matec_radar.radar_v2_results(nivel_confianza);

-- ─────────────────────────────────────────────────────────────────
-- 4. empresas — agregar embedding para match_empresa_by_name
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE matec_radar.empresas
  ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- ─────────────────────────────────────────────────────────────────
-- 5. radar_signals — tabla nueva (Modo Señales)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matec_radar.radar_signals (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID         REFERENCES matec_radar.radar_v2_sessions(id) ON DELETE CASCADE,
  empresa_id         BIGINT       REFERENCES matec_radar.empresas(id) ON DELETE SET NULL,
  empresa_es_nueva   BOOLEAN      DEFAULT false,
  empresa_nombre     TEXT         NOT NULL,
  pais               TEXT,
  linea_negocio      TEXT,
  sub_linea          TEXT,
  tipo_senal         TEXT,
  descripcion        TEXT,
  ventana_compra     TEXT,
  nivel_confianza    TEXT         CHECK (nivel_confianza IN ('ALTA','MEDIA','BAJA')),
  monto_inversion    TEXT,
  fuentes            JSONB        DEFAULT '[]'::jsonb,
  score_radar        NUMERIC(5,2),
  raw_json           JSONB,
  embedding          VECTOR(1536),
  created_at         TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radar_signals_session_idx    ON matec_radar.radar_signals(session_id);
CREATE INDEX IF NOT EXISTS radar_signals_empresa_idx    ON matec_radar.radar_signals(empresa_id);
CREATE INDEX IF NOT EXISTS radar_signals_confianza_idx  ON matec_radar.radar_signals(nivel_confianza);
CREATE INDEX IF NOT EXISTS radar_signals_created_idx    ON matec_radar.radar_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS radar_signals_es_nueva_idx   ON matec_radar.radar_signals(empresa_es_nueva) WHERE empresa_es_nueva = true;

COMMENT ON TABLE matec_radar.radar_signals IS 'Señales de inversión detectadas en Modo Señales (sin empresa preestablecida).';

-- ─────────────────────────────────────────────────────────────────
-- 6. notificaciones — tabla nueva
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matec_radar.notificaciones (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT         NOT NULL CHECK (tipo IN ('scan_alta','empresa_nueva','scan_completado','calificacion','sistema')),
  titulo      TEXT         NOT NULL,
  mensaje     TEXT,
  link        TEXT,
  meta        JSONB        DEFAULT '{}'::jsonb,
  leida       BOOLEAN      DEFAULT false,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notificaciones_user_idx     ON matec_radar.notificaciones(user_id, leida, created_at DESC);
CREATE INDEX IF NOT EXISTS notificaciones_tipo_idx     ON matec_radar.notificaciones(tipo);

COMMENT ON TABLE matec_radar.notificaciones IS 'Notificaciones in-app para Paola y equipo comercial.';

-- ─────────────────────────────────────────────────────────────────
-- 7. Funciones RPC para RAG
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION matec_radar.match_signals(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id              UUID,
  empresa_nombre  TEXT,
  descripcion     TEXT,
  linea_negocio   TEXT,
  pais            TEXT,
  similarity      FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    rs.id,
    rs.empresa_nombre,
    rs.descripcion,
    rs.linea_negocio,
    rs.pais,
    1 - (rs.embedding <=> query_embedding) AS similarity
  FROM matec_radar.radar_signals rs
  WHERE rs.embedding IS NOT NULL
    AND 1 - (rs.embedding <=> query_embedding) > match_threshold
  ORDER BY rs.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION matec_radar.match_empresa_by_name(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.85,
  match_count     INT   DEFAULT 1
)
RETURNS TABLE (
  id            BIGINT,
  company_name  TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    e.id,
    e.company_name,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM matec_radar.empresas e
  WHERE e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 8. Índices vectoriales (ivfflat para queries rápidas)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'matec_radar' AND indexname = 'radar_signals_embedding_idx') THEN
    CREATE INDEX radar_signals_embedding_idx ON matec_radar.radar_signals
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'matec_radar' AND indexname = 'empresas_embedding_idx') THEN
    CREATE INDEX empresas_embedding_idx ON matec_radar.empresas
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;
