-- =============================================================================
-- Migration: 20260414_009_test_keywords.sql
-- Purpose:   Tests L2 — verifica integridad del seed de keywords y
--            las columnas agregadas en migración 008.
--            Idempotente. Solo lectura (DO $$ ASSERT).
-- Sprint:    A.6 — Nivel L2 Supabase tests
-- =============================================================================

DO $$
DECLARE
  cnt_keywords    INTEGER;
  cnt_lineas      INTEGER;
  cnt_sublineas   INTEGER;
  cnt_cols_008    INTEGER;
  cnt_fuentes_col INTEGER;
  lineas_sin_kw   TEXT;
  peso_invalido   INTEGER;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'L2 Tests — Sprint A (keywords + schema 008)';
  RAISE NOTICE '════════════════════════════════════════════════════';

  -- ── TEST 1: Keywords seed existe ─────────────────────────────────────────
  SELECT COUNT(*) INTO cnt_keywords
  FROM matec_radar.palabras_clave_por_linea
  WHERE activo = TRUE;

  ASSERT cnt_keywords >= 30,
    FORMAT('TEST 1 FAIL: se esperaban >= 30 keywords activas, hay %s', cnt_keywords);
  RAISE NOTICE 'TEST 1 PASS: keywords activas = %', cnt_keywords;

  -- ── TEST 2: Todas las sub-líneas tienen al menos 3 keywords ─────────────
  SELECT COUNT(DISTINCT sl.id) INTO cnt_sublineas
  FROM matec_radar.sub_lineas_negocio sl
  WHERE sl.activo = TRUE;

  SELECT STRING_AGG(sl.nombre, ', ') INTO lineas_sin_kw
  FROM matec_radar.sub_lineas_negocio sl
  WHERE sl.activo = TRUE
    AND (
      SELECT COUNT(*) FROM matec_radar.palabras_clave_por_linea pc
      WHERE pc.sub_linea_id = sl.id AND pc.activo = TRUE
    ) < 3;

  ASSERT lineas_sin_kw IS NULL,
    FORMAT('TEST 2 FAIL: sub-líneas con < 3 keywords: %s', lineas_sin_kw);
  RAISE NOTICE 'TEST 2 PASS: todas las % sub-líneas tienen >= 3 keywords', cnt_sublineas;

  -- ── TEST 3: Pesos válidos en rango [-5, 5] ───────────────────────────────
  SELECT COUNT(*) INTO peso_invalido
  FROM matec_radar.palabras_clave_por_linea
  WHERE peso < -5 OR peso > 5;

  ASSERT peso_invalido = 0,
    FORMAT('TEST 3 FAIL: %s keywords con peso fuera de [-5, 5]', peso_invalido);
  RAISE NOTICE 'TEST 3 PASS: todos los pesos están en rango [-5, 5]';

  -- ── TEST 4: Tipos válidos ────────────────────────────────────────────────
  SELECT COUNT(*) INTO peso_invalido  -- reutilizamos variable
  FROM matec_radar.palabras_clave_por_linea
  WHERE tipo NOT IN ('senal', 'producto', 'sector', 'exclusion');

  ASSERT peso_invalido = 0,
    FORMAT('TEST 4 FAIL: %s keywords con tipo inválido', peso_invalido);
  RAISE NOTICE 'TEST 4 PASS: todos los tipos son válidos (senal/producto/sector/exclusion)';

  -- ── TEST 5: Columnas de migración 008 en radar_scans ────────────────────
  SELECT COUNT(*) INTO cnt_cols_008
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'radar_scans'
    AND column_name  IN ('peso_fuente_max', 'tiene_fuente_gov', 'horizonte_meses',
                         'convergencia', 'keywords_usadas', 'queries_count');

  ASSERT cnt_cols_008 = 6,
    FORMAT('TEST 5 FAIL: se esperaban 6 columnas nuevas en radar_scans, hay %s', cnt_cols_008);
  RAISE NOTICE 'TEST 5 PASS: 6 columnas de migración 008 presentes en radar_scans';

  -- ── TEST 6: Columna peso_fuente en radar_fuentes ─────────────────────────
  SELECT COUNT(*) INTO cnt_fuentes_col
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'radar_fuentes'
    AND column_name  = 'peso_fuente';

  ASSERT cnt_fuentes_col = 1,
    'TEST 6 FAIL: columna peso_fuente no existe en radar_fuentes';
  RAISE NOTICE 'TEST 6 PASS: peso_fuente presente en radar_fuentes';

  -- ── TEST 7: Índices de migración 008 creados ─────────────────────────────
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'matec_radar'
      AND indexname  = 'radar_convergencia_idx'
  ), 'TEST 7 FAIL: índice radar_convergencia_idx no existe';
  RAISE NOTICE 'TEST 7 PASS: índice radar_convergencia_idx presente';

  -- ── TEST 8: Unicidad sub_linea_id + palabra + idioma + tipo ─────────────
  SELECT COUNT(*) INTO peso_invalido
  FROM (
    SELECT sub_linea_id, palabra, idioma, tipo, COUNT(*) AS n
    FROM matec_radar.palabras_clave_por_linea
    GROUP BY sub_linea_id, palabra, idioma, tipo
    HAVING COUNT(*) > 1
  ) dupes;

  ASSERT peso_invalido = 0,
    FORMAT('TEST 8 FAIL: %s duplicados en palabras_clave_por_linea', peso_invalido);
  RAISE NOTICE 'TEST 8 PASS: sin duplicados en palabras_clave_por_linea';

  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'L2 Tests COMPLETOS: 8/8 PASS ✅';
  RAISE NOTICE '════════════════════════════════════════════════════';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'L2 Tests FAILED: %', SQLERRM;
END $$;
