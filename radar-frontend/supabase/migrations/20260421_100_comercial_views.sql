-- Migration: 20260421_100_comercial_views
-- Purpose: Create comercial_* views over physical radar_v2_* tables.
--   Physical tables are NOT renamed to preserve RLS policies, FKs, and indices.
--   New code targets the comercial_* views; legacy code continues to work unchanged.
--
-- Requires: matec_radar schema and radar_v2_* tables from prior migrations.

SET search_path = matec_radar;

-- 1. Sessions ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW matec_radar.comercial_sesiones
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_sessions;

-- 2. Results ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW matec_radar.comercial_resultados
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_results;

-- 3. Informes (execution reports) ─────────────────────────────────────────────
CREATE OR REPLACE VIEW matec_radar.comercial_informes_ejecucion
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_reports;

-- 4. Budgets ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW matec_radar.comercial_budgets
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_budgets;

-- 5. Token events ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW matec_radar.comercial_token_events
  WITH (security_invoker = true)
AS
  SELECT * FROM matec_radar.radar_v2_token_events;

-- 6. RAG ingest log ───────────────────────────────────────────────────────────
--    This view is forward-looking; the physical table may not exist yet.
--    Wrapped in DO block to avoid failure if radar_v2_rag_ingest_log is absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'matec_radar'
      AND table_name = 'radar_v2_rag_ingest_log'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW matec_radar.comercial_rag_ingest_log
        WITH (security_invoker = true)
      AS
        SELECT * FROM matec_radar.radar_v2_rag_ingest_log
    ';
  END IF;
END $$;

-- Confirm views created
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.views
  WHERE table_schema = 'matec_radar'
    AND table_name LIKE 'comercial_%';

  RAISE NOTICE 'comercial_* views created: %', v_count;
END $$;
