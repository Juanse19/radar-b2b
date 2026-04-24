-- =============================================================================
-- Migration: 20260414_007_seed_radar_keywords.sql
-- Purpose:   Seed inicial de palabras_clave_por_linea para WF02 Radar.
--            Usa la tabla ya existente (20260408_002_business_model.sql §3.5).
--            Idempotente via ON CONFLICT DO UPDATE.
-- Sprint:    A.3 — Keywords parametrizables desde admin web
-- =============================================================================

-- ── BHS / Aeropuertos ────────────────────────────────────────────────────────
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX aeropuerto',        'senal',    2),
  ('licitacion terminal',     'senal',    2),
  ('expansion BHS',           'producto', 1),
  ('automatizacion equipaje', 'producto', 1),
  ('sorter bagaje',           'producto', 1),
  ('concesion aeroportuaria', 'senal',    2),
  ('nueva terminal',          'sector',   1),
  ('ampliacion pista',        'sector',   1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'aeropuertos'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- BHS / Cargo ULD
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX carga aerea',       'senal',    2),
  ('licitacion ULD',          'senal',    2),
  ('expansion cargo',         'senal',    1),
  ('nuevo almacen ULD',       'producto', 1),
  ('hub logistico aereo',     'sector',   1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'cargo_uld'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- ── Cartón y Papel / Cartón Corrugado ────────────────────────────────────────
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX corrugadora',       'senal',    2),
  ('licitacion carton',       'senal',    2),
  ('nueva planta carton',     'senal',    1),
  ('expansion capacidad',     'senal',    1),
  ('linea corrugado',         'producto', 1),
  ('eficiencia energetica',   'producto', 1),
  ('reduccion merma',         'sector',   1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'carton_corrugado'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- ── Intralogística / Final de Línea ──────────────────────────────────────────
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX paletizado',        'senal',    2),
  ('licitacion empaque',      'senal',    2),
  ('automatizacion linea',    'senal',    1),
  ('robotica embalaje',       'producto', 1),
  ('encajonado automatico',   'producto', 1),
  ('nueva linea produccion',  'sector',   1),
  ('expansion planta',        'sector',   1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'final_linea'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- ── Ensambladoras de Motos ───────────────────────────────────────────────────
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX ensambladora',      'senal',    2),
  ('licitacion motos',        'senal',    2),
  ('nueva planta motocicletas','senal',   1),
  ('linea ensamble semi',     'producto', 1),
  ('expansion capacidad motos','sector',  1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'ensambladoras_motos'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- ── SOLUMAT / Plásticos ──────────────────────────────────────────────────────
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
SELECT
  sl.id, kw.palabra, 'es', kw.tipo, kw.peso, TRUE
FROM matec_radar.sub_lineas_negocio sl
CROSS JOIN (VALUES
  ('CAPEX plasticos',         'senal',    2),
  ('licitacion inyeccion',    'senal',    2),
  ('nueva planta materiales', 'senal',    1),
  ('reduccion desperdicio',   'producto', 1),
  ('automatizacion inyeccion','producto', 1),
  ('expansion materiales',    'sector',   1)
) AS kw(palabra, tipo, peso)
WHERE sl.codigo = 'solumat'
ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
  SET peso = EXCLUDED.peso, activo = TRUE;

-- ── Verificación ─────────────────────────────────────────────────────────────
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM matec_radar.palabras_clave_por_linea WHERE activo = TRUE;
  RAISE NOTICE 'palabras_clave_por_linea activas: %', cnt;
  IF cnt < 30 THEN
    RAISE WARNING 'Se esperaban >= 30 keywords. Verificar seed.';
  END IF;
END $$;
