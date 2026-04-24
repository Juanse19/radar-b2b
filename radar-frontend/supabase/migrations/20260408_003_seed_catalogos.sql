-- =============================================================================
-- Migration: 20260408_003_seed_catalogos.sql
-- Purpose:   Seed inicial de catálogos administrables (idempotente con ON CONFLICT).
--            3 líneas primarias + 6 sub-líneas + 7 pesos de scoring global.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Líneas de negocio primarias
-- ---------------------------------------------------------------------------
INSERT INTO matec_radar.lineas_negocio (codigo, nombre, descripcion, color_hex, icono, activo, orden)
VALUES
  ('bhs',           'BHS (Baggage Handling Systems)',
   'Sistemas de manejo de equipaje y carga en aeropuertos',
   '#3B82F6', 'plane', TRUE, 1),
  ('carton_papel',  'Cartón y Papel',
   'Líneas de producción de cartón corrugado y papel industrial',
   '#10B981', 'box', TRUE, 2),
  ('intralogistica','Intralogística',
   'Automatización de bodegas, CEDI, WMS y líneas de producción',
   '#F59E0B', 'warehouse', TRUE, 3)
ON CONFLICT (codigo) DO UPDATE SET
  nombre      = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  color_hex   = EXCLUDED.color_hex,
  icono       = EXCLUDED.icono,
  updated_at  = NOW();

-- ---------------------------------------------------------------------------
-- 2. Sub-líneas de negocio
-- ---------------------------------------------------------------------------
INSERT INTO matec_radar.sub_lineas_negocio
  (linea_id, codigo, nombre, descripcion, excel_file_pattern, excel_sheet_name,
   meta_schema_version, activo, orden)
VALUES
  -- BHS
  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'bhs'),
   'aeropuertos', 'Aeropuertos',
   'Terminales de pasajeros y carga con sistemas BHS/sorters/CUTE/CUSS',
   'BASE DE DATOS AEROPUERTOS*', 'Base de Datos',
   'v2_amplio', TRUE, 1),

  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'bhs'),
   'cargo_uld', 'Cargo / ULD',
   'Operadores de carga aérea y manejo de ULD',
   'BASE DE DATOS CARGO LATAM*', 'Base de Datos',
   'v1_compacto', TRUE, 2),

  -- Cartón y Papel
  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'carton_papel'),
   'carton_corrugado', 'Cartón Corrugado',
   'Plantas de cartón corrugado y empaques',
   'BASE DE DATOS CARTON Y PAPEL*', 'Base de Datos',
   'v2_amplio', TRUE, 1),

  -- Intralogística
  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica'),
   'final_linea', 'Final de Línea',
   'Líneas de empaque, paletizado y logística de alimentos/bebidas',
   'BASE DE DATOS FINAL DE LINEA*', 'Base de Datos',
   'v2_amplio', TRUE, 1),

  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica'),
   'ensambladoras_motos', 'Ensambladoras de Motos',
   'Fabricantes y ensambladoras de motocicletas en LATAM',
   'BASE DE DATOS ENSAMBLADORAS MOTOS*', 'Base de Datos',
   'v1_compacto', TRUE, 2),

  ((SELECT id FROM matec_radar.lineas_negocio WHERE codigo = 'intralogistica'),
   'solumat', 'Solumat',
   'Plantas de materiales y plásticos industriales',
   'BASE DE DATOS SOLUMAT*', 'Base de Datos',
   'v2_amplio', TRUE, 3)

ON CONFLICT (linea_id, codigo) DO UPDATE SET
  nombre              = EXCLUDED.nombre,
  descripcion         = EXCLUDED.descripcion,
  excel_file_pattern  = EXCLUDED.excel_file_pattern,
  excel_sheet_name    = EXCLUDED.excel_sheet_name,
  meta_schema_version = EXCLUDED.meta_schema_version,
  updated_at          = NOW();

-- ---------------------------------------------------------------------------
-- 3. Configuración de scoring global (pesos por dimensión)
--    sub_linea_id = NULL → aplica a todas las sub-líneas por defecto.
--    Pesos suman 1.00 exacto (coincide con los 7 factores del WF01).
-- ---------------------------------------------------------------------------
INSERT INTO matec_radar.configuracion_scoring
  (sub_linea_id, dimension, peso, vigente_desde)
VALUES
  (NULL, 'impacto',    0.25, CURRENT_DATE),
  (NULL, 'anio',       0.15, CURRENT_DATE),
  (NULL, 'recurrencia',0.15, CURRENT_DATE),
  (NULL, 'multiplanta',0.15, CURRENT_DATE),
  (NULL, 'ticket',     0.10, CURRENT_DATE),
  (NULL, 'referente',  0.10, CURRENT_DATE),
  (NULL, 'prioridad',  0.10, CURRENT_DATE)
ON CONFLICT (sub_linea_id, dimension, vigente_desde) DO UPDATE SET
  peso = EXCLUDED.peso;

-- ---------------------------------------------------------------------------
-- Verificación inline (informativa, no bloquea)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cnt_lineas    INT;
  cnt_sublineas INT;
  cnt_scoring   INT;
BEGIN
  SELECT COUNT(*) INTO cnt_lineas    FROM matec_radar.lineas_negocio;
  SELECT COUNT(*) INTO cnt_sublineas FROM matec_radar.sub_lineas_negocio;
  SELECT COUNT(*) INTO cnt_scoring   FROM matec_radar.configuracion_scoring;
  RAISE NOTICE 'Seed OK → lineas: %, sub_lineas: %, scoring rows: %',
    cnt_lineas, cnt_sublineas, cnt_scoring;
END $$;
