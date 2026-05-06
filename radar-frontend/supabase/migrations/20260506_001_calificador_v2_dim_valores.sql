-- Migration: 20260506_001_calificador_v2_dim_valores
-- Purpose: Extend calificaciones for V2 9-dimension categorical scoring.
--   - Adds `dimensiones` (jsonb) with [{dim, valor, score, justificacion}].
--   - Adds `score_cuenta_estrategica` and `score_tier` numeric columns.
--   - Refreshes comercial_calificaciones view to expose the new fields.
-- Idempotent — safe to re-run.

SET search_path = matec_radar;

-- 1. New columns ────────────────────────────────────────────────────────────────

ALTER TABLE matec_radar.calificaciones
  ADD COLUMN IF NOT EXISTS dimensiones              JSONB,
  ADD COLUMN IF NOT EXISTS score_cuenta_estrategica NUMERIC,
  ADD COLUMN IF NOT EXISTS score_tier               NUMERIC;

COMMENT ON COLUMN matec_radar.calificaciones.dimensiones IS
  'V2 — categorical dimension array [{dim, valor, score, justificacion}]';

COMMENT ON COLUMN matec_radar.calificaciones.score_cuenta_estrategica IS
  'V2 — numeric score derived from `cuenta_estrategica` categorical (Sí=10/No=0)';

COMMENT ON COLUMN matec_radar.calificaciones.score_tier IS
  'V2 — numeric score derived from `tier` categorical (A=10/B=6/C=2)';

-- 2. Index for jsonb querying ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS calif_dimensiones_gin_idx
  ON matec_radar.calificaciones
  USING GIN (dimensiones);

-- 3. Refresh comercial_calificaciones view with new fields ─────────────────────

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
  c.score_cuenta_estrategica,
  c.score_tier,
  c.score_total,
  c.tier_calculado::TEXT        AS tier,
  c.dimensiones,
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

-- 4. Verification ───────────────────────────────────────────────────────────────
DO $$
DECLARE v_cols INT;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'calificaciones'
    AND column_name  IN ('dimensiones', 'score_cuenta_estrategica', 'score_tier');
  RAISE NOTICE 'calificaciones v2 dim_valores columns present: % / 3', v_cols;
END $$;
