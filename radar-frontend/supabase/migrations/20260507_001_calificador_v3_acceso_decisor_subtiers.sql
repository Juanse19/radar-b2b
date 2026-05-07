-- Migration: 20260507_001_calificador_v3_acceso_decisor_subtiers
-- Purpose: Calificador V3 (Fase A1)
--   1. Add `score_acceso_al_decisor` column (new dimension).
--   2. Extend `tier_enum` with B-Alta and B-Baja sub-tiers.
--   3. score_ticket / score_tier remain in the table for backwards-compat
--      with V2 rows but are no longer populated by the engine.
--   4. Refresh comercial_calificaciones view to expose the new column.
-- Idempotent — safe to re-run.

SET search_path = matec_radar;

-- 1. Add new column ─────────────────────────────────────────────────────────────

ALTER TABLE matec_radar.calificaciones
  ADD COLUMN IF NOT EXISTS score_acceso_al_decisor NUMERIC;

COMMENT ON COLUMN matec_radar.calificaciones.score_acceso_al_decisor IS
  'V3 — score derived from acceso_al_decisor categorical (Sin Contacto=1, Líder/Jefe=4, Gerente/Directivo=7, 3+ áreas=10)';

-- 2. Extend tier_enum with B-Alta and B-Baja ────────────────────────────────────
--    ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
--    Postgres versions, but Supabase pg/query handles each statement
--    independently. Wrap in DO block + check for safety.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'tier_enum' AND e.enumlabel = 'B-Alta'
  ) THEN
    ALTER TYPE matec_radar.tier_enum ADD VALUE 'B-Alta';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'tier_enum' AND e.enumlabel = 'B-Baja'
  ) THEN
    ALTER TYPE matec_radar.tier_enum ADD VALUE 'B-Baja';
  END IF;
END $$;

-- 3. Refresh comercial_calificaciones view to surface the new column ─────────────

DROP VIEW IF EXISTS matec_radar.comercial_calificaciones;

CREATE VIEW matec_radar.comercial_calificaciones
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
  c.score_acceso_al_decisor,
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
DECLARE v_col INT; v_lab INT;
BEGIN
  SELECT COUNT(*) INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'calificaciones'
    AND column_name  = 'score_acceso_al_decisor';
  SELECT COUNT(*) INTO v_lab
  FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'tier_enum' AND e.enumlabel IN ('B-Alta', 'B-Baja');
  RAISE NOTICE 'V3 migration: score_acceso_al_decisor=%, tier_enum sub-values=% (expect 2)', v_col, v_lab;
END $$;
