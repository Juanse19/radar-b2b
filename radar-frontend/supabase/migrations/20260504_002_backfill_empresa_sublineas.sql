-- =============================================================================
-- Migration: 20260504_002_backfill_empresa_sublineas.sql
-- Purpose:
--   1. Ensure lineas_negocio has correct 'codigo' values (repair if missing).
--   2. Ensure all 7 expected sub_lineas exist (idempotent upsert).
--   3. Backfill empresa_sub_lineas pivot for companies that have
--      sub_linea_principal_id set but no pivot entry.
-- Idempotent — safe to re-run.
-- =============================================================================

-- ── 1. Ensure lineas_negocio have correct codigo values ───────────────────────
-- Some migration paths inserted lineas without 'codigo'. Repair by matching
-- on nombre (case-insensitive).

UPDATE matec_radar.lineas_negocio
  SET codigo = 'bhs'
WHERE codigo IS NULL AND nombre ILIKE '%BHS%';

UPDATE matec_radar.lineas_negocio
  SET codigo = 'carton_papel'
WHERE codigo IS NULL AND (nombre ILIKE '%cartón%' OR nombre ILIKE '%carton%' OR nombre ILIKE '%papel%');

UPDATE matec_radar.lineas_negocio
  SET codigo = 'intralogistica'
WHERE codigo IS NULL AND (nombre ILIKE '%intralog%' OR nombre ILIKE '%logíst%' OR nombre ILIKE '%logist%');

-- ── 2. Ensure all sub_lineas exist ────────────────────────────────────────────

INSERT INTO matec_radar.sub_lineas_negocio
  (linea_id, codigo, nombre, descripcion, excel_file_pattern, excel_sheet_name,
   meta_schema_version, activo, orden)
VALUES
  -- BHS
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'bhs' LIMIT 1),
    'aeropuertos', 'Aeropuertos',
    'Terminales de pasajeros y carga con sistemas BHS/sorters/CUTE/CUSS',
    'BASE DE DATOS AEROPUERTOS*', 'Base de Datos', 'v2_amplio', TRUE, 1
  ),
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'bhs' LIMIT 1),
    'cargo_uld', 'Cargo / ULD',
    'Operadores de carga aérea y manejo de ULD',
    'BASE DE DATOS CARGO LATAM*', 'Base de Datos', 'v1_compacto', TRUE, 2
  ),
  -- Cartón y Papel
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'carton_papel' LIMIT 1),
    'carton_corrugado', 'Cartón Corrugado',
    'Plantas de cartón corrugado y empaques',
    'BASE DE DATOS CARTON Y PAPEL*', 'Base de Datos', 'v2_amplio', TRUE, 1
  ),
  -- Intralogística
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica' LIMIT 1),
    'logistica', 'Logística',
    'Operadores logísticos, 3PL, fulfillment, centros de distribución y supply chain LATAM',
    'BASE DE DATOS LOGÍSTICA*', 'Base de Datos', 'v2_amplio', TRUE, 1
  ),
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica' LIMIT 1),
    'final_linea', 'Final de Línea',
    'Líneas de empaque, paletizado y logística de alimentos/bebidas',
    'BASE DE DATOS FINAL DE LINEA*', 'Base de Datos', 'v2_amplio', TRUE, 2
  ),
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica' LIMIT 1),
    'ensambladoras_motos', 'Ensambladoras de Motos',
    'Fabricantes y ensambladoras de motocicletas en LATAM',
    'BASE DE DATOS ENSAMBLADORAS MOTOS*', 'Base de Datos', 'v1_compacto', TRUE, 3
  ),
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica' LIMIT 1),
    'solumat', 'Solumat',
    'Plantas de materiales y plásticos industriales',
    'BASE DE DATOS SOLUMAT*', 'Base de Datos', 'v2_amplio', TRUE, 4
  )
ON CONFLICT (linea_id, codigo) DO UPDATE SET
  nombre              = EXCLUDED.nombre,
  descripcion         = EXCLUDED.descripcion,
  excel_file_pattern  = EXCLUDED.excel_file_pattern,
  excel_sheet_name    = EXCLUDED.excel_sheet_name,
  meta_schema_version = EXCLUDED.meta_schema_version,
  updated_at          = NOW();

-- ── 3. Backfill empresa_sub_lineas from sub_linea_principal_id ────────────────
-- Companies imported by old scripts have sub_linea_principal_id set but no
-- row in the pivot table. Insert missing pivot rows.

INSERT INTO matec_radar.empresa_sub_lineas (empresa_id, sub_linea_id, es_principal)
SELECT e.id, e.sub_linea_principal_id, TRUE
FROM matec_radar.empresas e
WHERE e.sub_linea_principal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM matec_radar.empresa_sub_lineas esl
    WHERE esl.empresa_id = e.id
      AND esl.sub_linea_id = e.sub_linea_principal_id
  )
ON CONFLICT DO NOTHING;

-- ── Verification ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_lineas      INT;
  n_sublineas   INT;
  n_backfilled  INT;
BEGIN
  SELECT COUNT(*) INTO n_lineas    FROM matec_radar.lineas_negocio WHERE codigo IS NOT NULL;
  SELECT COUNT(*) INTO n_sublineas FROM matec_radar.sub_lineas_negocio;
  SELECT COUNT(*) INTO n_backfilled
    FROM matec_radar.empresa_sub_lineas esl
    JOIN matec_radar.empresas e ON e.id = esl.empresa_id AND e.sub_linea_principal_id = esl.sub_linea_id;

  RAISE NOTICE 'lineas con codigo: %, sub_lineas total: %, empresa_sub_lineas (principal): %',
    n_lineas, n_sublineas, n_backfilled;
END $$;
