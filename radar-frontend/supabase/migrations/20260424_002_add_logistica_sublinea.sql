-- =============================================================================
-- Migration: 20260424_002_add_logistica_sublinea.sql
-- Purpose:   Add 'logistica' as a new sub-línea under intralogística.
--            Corresponds to PROSPECCIÓN/Línea Logistica/ Excel files (~190 rows).
-- =============================================================================

INSERT INTO matec_radar.sub_lineas_negocio
  (linea_id, codigo, nombre, descripcion, excel_file_pattern, excel_sheet_name,
   meta_schema_version, activo, orden)
VALUES
  (
    (SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica'),
    'logistica',
    'Logística',
    'Operadores logísticos, 3PL, fulfillment, centros de distribución y supply chain LATAM',
    'BASE DE DATOS LOGÍSTICA*',
    'Base de Datos',
    'v2_amplio',
    TRUE,
    4   -- after solumat (orden=3)
  )
ON CONFLICT (linea_id, codigo) DO UPDATE SET
  nombre              = EXCLUDED.nombre,
  descripcion         = EXCLUDED.descripcion,
  excel_file_pattern  = EXCLUDED.excel_file_pattern,
  excel_sheet_name    = EXCLUDED.excel_sheet_name,
  meta_schema_version = EXCLUDED.meta_schema_version,
  updated_at          = NOW();

-- Verification
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM matec_radar.sub_lineas_negocio
  WHERE codigo = 'logistica';
  RAISE NOTICE 'logistica sub_linea rows: %', cnt;
END $$;
