-- ============================================================
-- Radar B2B — Supabase Schema Migration
-- Schema: radar
-- Ejecutar en: Supabase Studio → SQL Editor
-- ============================================================

-- Asegurar que el schema existe
CREATE SCHEMA IF NOT EXISTS radar;

-- ============================================================
-- 1. LÍNEAS DE NEGOCIO (catálogo)
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.lineas_negocio (
  id          SMALLSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,        -- 'BHS' | 'Cartón' | 'Intralogística'
  descripcion TEXT,
  color_hex   TEXT DEFAULT '#6366f1',      -- color para UI
  icono       TEXT,                        -- emoji o nombre de icono
  activo      BOOLEAN DEFAULT TRUE,
  orden       SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de líneas
INSERT INTO radar.lineas_negocio (nombre, descripcion, color_hex, icono, orden) VALUES
  ('BHS',           'Baggage Handling Systems — Aeropuertos y terminales de carga', '#3b82f6', '✈️', 1),
  ('Cartón',        'Líneas de corrugado y empaque — Plantas cartón ondulado',       '#f59e0b', '📦', 2),
  ('Intralogística','Centros de distribución, WMS, ASRS, automatización interna',    '#10b981', '🏭', 3),
  ('Solumat',       'Soluciones de materiales especiales',                            '#8b5cf6', '⚙️', 4)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 2. EMPRESAS PROSPECTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.empresas (
  id               BIGSERIAL PRIMARY KEY,
  company_name     TEXT NOT NULL,
  company_domain   TEXT,
  company_url      TEXT,
  pais             TEXT,
  ciudad           TEXT,
  linea_negocio    TEXT NOT NULL REFERENCES radar.lineas_negocio(nombre),
  linea_raw        TEXT,                  -- valor original del CSV
  tier             TEXT DEFAULT 'Tier B'
                     CHECK (tier IN ('Tier A','Tier B-Alta','Tier B','Tier B-Baja','Tier C','Tier D')),
  status           TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending','active','discarded','no_contact')),
  notas            TEXT,
  selected_for_run BOOLEAN DEFAULT FALSE,
  last_run_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_linea    ON radar.empresas(linea_negocio);
CREATE INDEX IF NOT EXISTS idx_empresas_tier     ON radar.empresas(tier);
CREATE INDEX IF NOT EXISTS idx_empresas_status   ON radar.empresas(status);
CREATE INDEX IF NOT EXISTS idx_empresas_pais     ON radar.empresas(pais);
CREATE INDEX IF NOT EXISTS idx_empresas_last_run ON radar.empresas(last_run_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION radar.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_updated_at ON radar.empresas;
CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON radar.empresas
  FOR EACH ROW EXECUTE FUNCTION radar.set_updated_at();

-- ============================================================
-- 3. EJECUCIONES (log de escaneos)
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.ejecuciones (
  id                   BIGSERIAL PRIMARY KEY,
  n8n_execution_id     TEXT,              -- ID retornado por N8N (puede ser timestamp)
  linea_negocio        TEXT REFERENCES radar.lineas_negocio(nombre),
  batch_size           SMALLINT,
  estado               TEXT DEFAULT 'running'
                         CHECK (estado IN ('running','success','error','waiting','timeout')),
  trigger_type         TEXT DEFAULT 'manual'
                         CHECK (trigger_type IN ('manual','scheduled','api')),
  empresas_procesadas  SMALLINT,
  senales_encontradas  SMALLINT DEFAULT 0,
  parametros           JSONB,             -- {dateFilterFrom, empresasEspecificas, ...}
  error_msg            TEXT,
  started_at           TIMESTAMPTZ DEFAULT NOW(),
  finished_at          TIMESTAMPTZ,
  created_by           TEXT              -- email del usuario que lanzó (futuro auth)
);

CREATE INDEX IF NOT EXISTS idx_ejecuciones_linea    ON radar.ejecuciones(linea_negocio);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_estado   ON radar.ejecuciones(estado);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_started  ON radar.ejecuciones(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_n8n_id   ON radar.ejecuciones(n8n_execution_id);

-- ============================================================
-- 4. SEÑALES (resultados del radar por empresa)
-- Reemplaza la tabla de Google Sheets BASE_DE_DATOS
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.senales (
  id                   BIGSERIAL PRIMARY KEY,
  empresa_id           BIGINT REFERENCES radar.empresas(id) ON DELETE SET NULL,
  ejecucion_id         BIGINT REFERENCES radar.ejecuciones(id) ON DELETE SET NULL,
  empresa_nombre       TEXT NOT NULL,     -- desnormalizado para reportes rápidos
  empresa_pais         TEXT,
  linea_negocio        TEXT,
  tier                 TEXT,
  radar_activo         BOOLEAN DEFAULT FALSE,
  tipo_senal           TEXT,             -- 'expansion', 'licitacion', 'capex', 'nuevo_proyecto', etc.
  descripcion          TEXT,
  fuente               TEXT,             -- 'BNAmericas', 'latitude-15.com', 'LinkedIn', etc.
  fuente_url           TEXT,
  score_radar          SMALLINT CHECK (score_radar BETWEEN 0 AND 100),
  ventana_compra       TEXT,             -- '6-12 meses', '12-18 meses', etc.
  prioridad_comercial  TEXT CHECK (prioridad_comercial IN ('ALTA','MEDIA','BAJA','DESCARTAR')),
  horizonte_fecha      DATE,             -- fecha estimada del proyecto
  motivo_descarte      TEXT,
  metadata             JSONB,            -- datos extra que pueda retornar N8N
  fecha_escaneo        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_senales_empresa     ON radar.senales(empresa_id);
CREATE INDEX IF NOT EXISTS idx_senales_ejecucion   ON radar.senales(ejecucion_id);
CREATE INDEX IF NOT EXISTS idx_senales_linea       ON radar.senales(linea_negocio);
CREATE INDEX IF NOT EXISTS idx_senales_radar       ON radar.senales(radar_activo);
CREATE INDEX IF NOT EXISTS idx_senales_score       ON radar.senales(score_radar DESC);
CREATE INDEX IF NOT EXISTS idx_senales_prioridad   ON radar.senales(prioridad_comercial);
CREATE INDEX IF NOT EXISTS idx_senales_fecha       ON radar.senales(fecha_escaneo DESC);

-- ============================================================
-- 5. CONFIGURACIÓN DEL SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.configuracion (
  clave        TEXT PRIMARY KEY,
  valor        JSONB NOT NULL,
  descripcion  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de configuración por defecto
INSERT INTO radar.configuracion (clave, valor, descripcion) VALUES
  ('schedule_activo',    'true',                      'Si el scheduler automático está habilitado'),
  ('schedule_hora',      '"09:00"',                   'Hora de ejecución programada (HH:MM, UTC-5)'),
  ('batch_size_default', '10',                        'Cantidad de empresas por ejecución por defecto'),
  ('date_filter_from',   '"2025-07-01"',              'Fecha desde la cual buscar noticias (YYYY-MM-DD)'),
  ('rotacion_semanal',   '{"lunes":"BHS","martes":"Cartón","miercoles":"Intralogística","jueves":"BHS","viernes":"Cartón"}',
                                                       'Línea asignada por día de la semana'),
  ('max_score_minimo',   '30',                        'Score mínimo para registrar una señal como activa'),
  ('ventanas_compra',    '["3-6 meses","6-12 meses","12-18 meses","18-24 meses","+24 meses"]',
                                                       'Opciones válidas de ventana de compra')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- 6. FUENTES DE MONITOREO
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.fuentes (
  id              SMALLSERIAL PRIMARY KEY,
  nombre          TEXT NOT NULL UNIQUE,
  url_base        TEXT,
  tipo            TEXT DEFAULT 'web'
                    CHECK (tipo IN ('web','api','rss','linkedin','newsletter','secop','oficial')),
  lineas          TEXT[],               -- ['BHS','Cartón'] o NULL = todas
  priority_score  SMALLINT DEFAULT 50,  -- 0-100, mayor = más confiable
  activa          BOOLEAN DEFAULT TRUE,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de fuentes conocidas
INSERT INTO radar.fuentes (nombre, url_base, tipo, lineas, priority_score, notas) VALUES
  ('BNAmericas',          'https://www.bnamericas.com',          'web',     NULL,                    90, 'Fuente principal para proyectos de infraestructura LATAM'),
  ('latitude-15.com',     'https://latitude-15.com',             'web',     ARRAY['BHS'],            85, 'Proyectos aeroportuarios en LATAM'),
  ('Aerocivil Colombia',  'https://www.aerocivil.gov.co',        'oficial', ARRAY['BHS'],            80, 'Convocatorias y proyectos aeronáuticos Colombia'),
  ('SECOP Colombia',      'https://www.secop.gov.co',            'secop',   NULL,                    85, 'Contratación pública Colombia'),
  ('LinkedIn Empresas',   'https://www.linkedin.com',            'linkedin',NULL,                    60, 'Señales de expansión y contratación'),
  ('CAMACOL',             'https://camacol.co',                  'web',     ARRAY['Intralogística'], 70, 'Proyectos construcción y logística Colombia'),
  ('ProColombia',         'https://procolombia.co',              'web',     NULL,                    65, 'Inversión y exportación Colombia'),
  ('IATA News',           'https://www.iata.org',                'web',     ARRAY['BHS'],            75, 'Noticias aeroportuarias globales'),
  ('Corrugated Today',    'https://www.corrugatedtoday.com',     'web',     ARRAY['Cartón'],         70, 'Industria del cartón corrugado'),
  ('Modern Materials Hdl','https://www.mmh.com',                 'web',     ARRAY['Intralogística'], 72, 'Manejo de materiales y logística')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 7. CONTACTOS (para el módulo CRM futuro)
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.contactos (
  id           BIGSERIAL PRIMARY KEY,
  empresa_id   BIGINT REFERENCES radar.empresas(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  cargo        TEXT,
  email        TEXT,
  linkedin_url TEXT,
  telefono     TEXT,
  es_decisor   BOOLEAN DEFAULT FALSE,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contactos_empresa ON radar.contactos(empresa_id);

DROP TRIGGER IF EXISTS contactos_updated_at ON radar.contactos;
CREATE TRIGGER contactos_updated_at
  BEFORE UPDATE ON radar.contactos
  FOR EACH ROW EXECUTE FUNCTION radar.set_updated_at();

-- ============================================================
-- 8. ACTIVIDAD COMERCIAL (seguimiento de oportunidades)
-- ============================================================
CREATE TABLE IF NOT EXISTS radar.actividad (
  id           BIGSERIAL PRIMARY KEY,
  empresa_id   BIGINT REFERENCES radar.empresas(id) ON DELETE CASCADE,
  senal_id     BIGINT REFERENCES radar.senales(id) ON DELETE SET NULL,
  tipo         TEXT NOT NULL
                 CHECK (tipo IN ('llamada','email','reunion','propuesta','demo','cierre','nota')),
  descripcion  TEXT,
  resultado    TEXT,
  fecha        TIMESTAMPTZ DEFAULT NOW(),
  creado_por   TEXT,                    -- email del usuario (futuro auth)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividad_empresa ON radar.actividad(empresa_id);
CREATE INDEX IF NOT EXISTS idx_actividad_fecha   ON radar.actividad(fecha DESC);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: empresas con su última señal
CREATE OR REPLACE VIEW radar.v_empresas_con_ultima_senal AS
SELECT
  e.id,
  e.company_name,
  e.company_domain,
  e.pais,
  e.ciudad,
  e.linea_negocio,
  e.tier,
  e.status,
  e.last_run_at,
  s.radar_activo      AS ultima_radar_activo,
  s.score_radar       AS ultimo_score,
  s.prioridad_comercial AS ultima_prioridad,
  s.ventana_compra    AS ultima_ventana,
  s.fecha_escaneo     AS ultima_fecha_escaneo
FROM radar.empresas e
LEFT JOIN LATERAL (
  SELECT * FROM radar.senales
  WHERE empresa_id = e.id
  ORDER BY fecha_escaneo DESC
  LIMIT 1
) s ON TRUE;

-- Vista: resumen de ejecuciones recientes
CREATE OR REPLACE VIEW radar.v_ejecuciones_resumen AS
SELECT
  ej.id,
  ej.n8n_execution_id,
  ej.linea_negocio,
  ej.batch_size,
  ej.estado,
  ej.trigger_type,
  ej.empresas_procesadas,
  ej.senales_encontradas,
  ej.started_at,
  ej.finished_at,
  EXTRACT(EPOCH FROM (ej.finished_at - ej.started_at)) AS duracion_seg,
  ej.created_by
FROM radar.ejecuciones ej
ORDER BY ej.started_at DESC;

-- Vista: señales activas por línea (para el dashboard)
CREATE OR REPLACE VIEW radar.v_senales_activas AS
SELECT
  s.id,
  s.empresa_nombre,
  s.empresa_pais,
  s.linea_negocio,
  s.tier,
  s.tipo_senal,
  s.descripcion,
  s.fuente,
  s.fuente_url,
  s.score_radar,
  s.ventana_compra,
  s.prioridad_comercial,
  s.fecha_escaneo
FROM radar.senales s
WHERE s.radar_activo = TRUE
ORDER BY s.score_radar DESC, s.fecha_escaneo DESC;

-- ============================================================
-- PERMISOS (para anon key de Supabase)
-- ============================================================
GRANT USAGE ON SCHEMA radar TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA radar TO anon, authenticated;
GRANT INSERT, UPDATE ON radar.empresas TO authenticated;
GRANT INSERT, UPDATE ON radar.ejecuciones TO authenticated;
GRANT INSERT ON radar.senales TO authenticated;
GRANT INSERT, UPDATE ON radar.actividad TO authenticated;
GRANT INSERT, UPDATE ON radar.contactos TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA radar TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA radar TO anon;

-- Para que la anon key pueda leer (panel público de resultados)
-- INSERT también para el script de importación inicial (import_empresas.js)
GRANT SELECT, INSERT, UPDATE ON radar.empresas TO anon;
GRANT SELECT ON radar.senales TO anon;
GRANT SELECT ON radar.ejecuciones TO anon;
GRANT SELECT ON radar.configuracion TO anon;
GRANT SELECT ON radar.lineas_negocio TO anon;
GRANT SELECT ON radar.fuentes TO anon;
GRANT SELECT ON radar.v_empresas_con_ultima_senal TO anon;
GRANT SELECT ON radar.v_ejecuciones_resumen TO anon;
GRANT SELECT ON radar.v_senales_activas TO anon;

-- ============================================================
-- FIN
-- ============================================================
