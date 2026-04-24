-- Migration: 20260424_103_calificador_v2
-- Purpose: Extend existing calificaciones table for Calificador v2 (UI-native).
--   - Adds v2-only columns (provider, session_id, sub_linea_id, perfil_web, rag, etc.)
--   - Creates comercial_calificaciones view for the /calificador module
-- Requires: 20260408_002_business_model (calificaciones table + tier_enum)
--           20260421_100_comercial_views (pattern reference)
--           20260421_101_radar_v2_feedback (feedback table)

SET search_path = matec_radar;

-- 1. Add v2 columns (all idempotent via IF NOT EXISTS) ──────────────────────────

ALTER TABLE matec_radar.calificaciones
  ADD COLUMN IF NOT EXISTS provider            TEXT,
  ADD COLUMN IF NOT EXISTS session_id          UUID,
  ADD COLUMN IF NOT EXISTS sub_linea_id        SMALLINT
                             REFERENCES matec_radar.sub_lineas_negocio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linea_negocio       TEXT,
  ADD COLUMN IF NOT EXISTS perfil_web_summary  TEXT,
  ADD COLUMN IF NOT EXISTS perfil_web_sources  JSONB,
  ADD COLUMN IF NOT EXISTS rag_context_used    JSONB,
  ADD COLUMN IF NOT EXISTS raw_llm_json        JSONB,
  ADD COLUMN IF NOT EXISTS is_v2               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_id         UUID;

-- FK to feedback table — wrapped in DO to survive if feedback table is absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'matec_radar' AND table_name = 'radar_v2_feedback'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'matec_radar'
      AND table_name    = 'calificaciones'
      AND constraint_name = 'calificaciones_feedback_id_fkey'
  ) THEN
    ALTER TABLE matec_radar.calificaciones
      ADD CONSTRAINT calificaciones_feedback_id_fkey
      FOREIGN KEY (feedback_id)
      REFERENCES matec_radar.radar_v2_feedback(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS calif_is_v2_idx
  ON matec_radar.calificaciones(is_v2) WHERE is_v2 = TRUE;

CREATE INDEX IF NOT EXISTS calif_session_id_idx
  ON matec_radar.calificaciones(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calif_provider_idx
  ON matec_radar.calificaciones(provider) WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS calif_sub_linea_idx
  ON matec_radar.calificaciones(sub_linea_id) WHERE sub_linea_id IS NOT NULL;

-- 3. comercial_calificaciones view ─────────────────────────────────────────────
--    Read-only. security_invoker = true so RLS on calificaciones applies.
--    Writes must target the physical table directly.

CREATE OR REPLACE VIEW matec_radar.comercial_calificaciones
  WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.empresa_id,
  e.company_name                AS empresa,
  e.pais_nombre                 AS pais,
  c.sub_linea_id,
  sl.nombre                     AS sub_linea_nombre,
  sl.linea_id,
  l.nombre                      AS linea_nombre,
  COALESCE(c.linea_negocio, l.nombre) AS linea_negocio,
  c.provider,
  c.session_id,
  c.score_impacto               AS score_impacto_presupuesto,
  c.score_multiplanta,
  c.score_recurrencia,
  c.score_referente             AS score_referente_mercado,
  c.score_anio                  AS score_anio_objetivo,
  c.score_ticket                AS score_ticket_estimado,
  c.score_prioridad             AS score_prioridad_comercial,
  c.score_total,
  c.tier_calculado::TEXT        AS tier,
  c.razonamiento_agente         AS razonamiento,
  c.perfil_web_summary,
  c.perfil_web_sources,
  c.rag_context_used,
  c.raw_llm_json,
  c.modelo_llm,
  c.tokens_input,
  c.tokens_output,
  c.costo_usd,
  c.is_v2,
  c.feedback_id,
  c.created_at
FROM matec_radar.calificaciones c
LEFT JOIN matec_radar.empresas          e  ON e.id  = c.empresa_id
LEFT JOIN matec_radar.sub_lineas_negocio sl ON sl.id = c.sub_linea_id
LEFT JOIN matec_radar.lineas_negocio    l  ON l.id  = sl.linea_id;

GRANT SELECT ON matec_radar.comercial_calificaciones TO authenticated;

-- 4. Verification ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_cols INT;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'calificaciones'
    AND column_name  IN ('provider','session_id','sub_linea_id','linea_negocio',
                         'perfil_web_summary','rag_context_used','is_v2');
  RAISE NOTICE 'calificaciones v2 columns present: % / 7', v_cols;
END $$;
