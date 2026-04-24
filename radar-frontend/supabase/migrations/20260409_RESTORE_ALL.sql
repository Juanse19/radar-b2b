-- ============================================================
-- Matec Radar B2B — RESTORE ALL (Script maestro de restauración)
-- Fecha: 2026-04-09
--
-- DIAGNÓSTICO: El schema matec_radar existe pero le faltan todas
-- las tablas de auth/admin (usuarios, roles, permisos, lineas_negocio,
-- fuentes, configuracion, actividad). Las tablas de agentes ya existen
-- en matec_radar (calificaciones, empresas, ejecuciones, etc.)
--
-- CÓMO EJECUTAR:
--   Opción A (recomendada) — via Docker:
--     docker exec -i supabase-db psql -U postgres -d postgres < 20260409_RESTORE_ALL.sql
--
--   Opción B — via API REST (pg/query endpoint):
--     POST http://localhost:8000/pg/query
--     { "query": "<contenido_del_script>" }
--     Header: apikey + Authorization Bearer (service_role_key)
--
--   Opción C — via Supabase Dashboard → SQL Editor
--
-- SEGURO: Todas las sentencias usan IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ============================================================

-- ── 0. Asegurar schema matec_radar ────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS matec_radar;

-- Grants de schema
GRANT USAGE ON SCHEMA matec_radar TO service_role, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA matec_radar
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA matec_radar
  GRANT SELECT ON TABLES TO anon, authenticated;

-- ── 1. Función updated_at (idempotente con OR REPLACE) ────────────────────────

CREATE OR REPLACE FUNCTION matec_radar.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. Tabla: usuarios (vinculada a Supabase Auth) ────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.usuarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  email            text UNIQUE NOT NULL,
  rol              text NOT NULL DEFAULT 'AUXILIAR'
                     CHECK (rol IN ('ADMIN','COMERCIAL','AUXILIAR')),
  estado_acceso    text NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado_acceso IN ('ACTIVO','PENDIENTE','INACTIVO')),
  aprobado_por     uuid REFERENCES matec_radar.usuarios(id),
  aprobado_en      timestamptz,
  avatar_url       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Columna avatar_url (idempotente para instancias que ya tienen la tabla)
ALTER TABLE matec_radar.usuarios
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Trigger updated_at
DROP TRIGGER IF EXISTS usuarios_updated_at ON matec_radar.usuarios;
CREATE TRIGGER usuarios_updated_at
  BEFORE UPDATE ON matec_radar.usuarios
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- RLS
ALTER TABLE matec_radar.usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='usuarios' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.usuarios
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='usuarios' AND policyname='usuarios_own_row'
  ) THEN
    CREATE POLICY usuarios_own_row ON matec_radar.usuarios
      FOR SELECT TO authenticated
      USING (auth_user_id = auth.uid());
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE ON matec_radar.usuarios TO service_role;
GRANT SELECT ON matec_radar.usuarios TO authenticated;

-- ── 3. Tabla: lineas_negocio ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.lineas_negocio (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  color_hex   text DEFAULT '#6366f1',
  icono       text DEFAULT 'Layers',
  activo      boolean DEFAULT true,
  orden       smallint DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Seed: 6 líneas de negocio Matec
INSERT INTO matec_radar.lineas_negocio (nombre, descripcion, color_hex, icono, orden) VALUES
  ('BHS',           'Aeropuertos, carruseles, sorters',          '#3b82f6', 'Plane',     1),
  ('Cartón',        'Corrugadoras, empaque',                     '#f59e0b', 'Package',   2),
  ('Intralogística','CEDI, WMS, ASRS, conveyor',                 '#10b981', 'Warehouse', 3),
  ('Final de Línea','Alimentos, bebidas, palletizado',           '#f97316', 'Factory',   4),
  ('Motos',         'Ensambladoras, motocicletas',               '#f43f5e', 'Bike',      5),
  ('SOLUMAT',       'Plásticos, materiales industriales',        '#8b5cf6', 'Truck',     6)
ON CONFLICT (nombre) DO NOTHING;

-- RLS
ALTER TABLE matec_radar.lineas_negocio ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='lineas_negocio' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.lineas_negocio
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='lineas_negocio' AND policyname='public_read'
  ) THEN
    CREATE POLICY public_read ON matec_radar.lineas_negocio
      FOR SELECT TO anon, authenticated USING (activo = true);
  END IF;
END $$;

GRANT SELECT ON matec_radar.lineas_negocio TO service_role, anon, authenticated;

-- ── 4. Tabla: fuentes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.fuentes (
  id             smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre         text NOT NULL,
  url_base       text,
  tipo           text CHECK (tipo IN ('tavily','rss','scraping','api','manual')),
  lineas         text[],
  priority_score smallint DEFAULT 5,
  activa         boolean DEFAULT true,
  notas          text,
  created_at     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE matec_radar.fuentes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='fuentes' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.fuentes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.fuentes TO service_role;
GRANT SELECT ON matec_radar.fuentes TO authenticated;

-- ── 5. Tabla: configuracion (clave-valor) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.configuracion (
  clave       text PRIMARY KEY,
  valor       jsonb NOT NULL,
  descripcion text,
  updated_at  timestamptz DEFAULT now()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS configuracion_updated_at ON matec_radar.configuracion;
CREATE TRIGGER configuracion_updated_at
  BEFORE UPDATE ON matec_radar.configuracion
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- Seed: valores por defecto
INSERT INTO matec_radar.configuracion (clave, valor, descripcion) VALUES
  ('batch_size_default',                 '10'::jsonb,                                        'Tamaño de batch por defecto para agentes'),
  ('lineas_activas',                     '["BHS","Cartón","Intralogística"]'::jsonb,          'Líneas actualmente activas'),
  ('prospector_contactos_por_empresa',   '3'::jsonb,                                         'Contactos por empresa para WF03'),
  ('schedule_hora_default',              '"07:00"'::jsonb,                                    'Hora por defecto del escaneo automático'),
  ('composite_score_oro_threshold',      '70'::jsonb,                                         'Threshold composite score para tier ORO'),
  ('composite_score_monitoreo_threshold','40'::jsonb,                                         'Threshold composite score para tier MONITOREO')
ON CONFLICT (clave) DO NOTHING;

-- RLS
ALTER TABLE matec_radar.configuracion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='configuracion' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.configuracion
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='configuracion' AND policyname='authenticated_read'
  ) THEN
    CREATE POLICY authenticated_read ON matec_radar.configuracion
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.configuracion TO service_role;
GRANT SELECT ON matec_radar.configuracion TO authenticated;

-- ── 6. Tabla: actividad (log de auditoría) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.actividad (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id   uuid REFERENCES matec_radar.usuarios(id),
  usuario_email text,
  tipo         text NOT NULL,
  descripcion  text,
  resultado    text CHECK (resultado IN ('ok','error','warn')),
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actividad_usuario_id_idx ON matec_radar.actividad (usuario_id);
CREATE INDEX IF NOT EXISTS actividad_tipo_idx       ON matec_radar.actividad (tipo);
CREATE INDEX IF NOT EXISTS actividad_created_at_idx ON matec_radar.actividad (created_at);

-- RLS
ALTER TABLE matec_radar.actividad ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='actividad' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.actividad
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.actividad TO service_role;

-- ── 7. Tabla: system_roles ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.system_roles (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug        text NOT NULL UNIQUE,
  label       text NOT NULL,
  descripcion text,
  color       text DEFAULT '#6366f1',
  es_sistema  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Seed: 3 roles base
INSERT INTO matec_radar.system_roles (slug, label, descripcion, color, es_sistema) VALUES
  ('admin',     'Administrador', 'Acceso total al sistema',                   '#8b5cf6', true),
  ('comercial', 'Comercial',     'Acceso operacional (sin admin)',             '#3b82f6', true),
  ('auxiliar',  'Auxiliar',      'Solo lectura de resultados y contactos',    '#6b7280', true)
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE matec_radar.system_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='system_roles' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.system_roles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='system_roles' AND policyname='public_read'
  ) THEN
    CREATE POLICY public_read ON matec_radar.system_roles
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.system_roles TO service_role;
GRANT SELECT ON matec_radar.system_roles TO anon, authenticated;

-- ── 8. Tabla: system_permisos ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.system_permisos (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  clave       text NOT NULL UNIQUE,
  label       text NOT NULL,
  descripcion text,
  modulo      text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Seed: permisos granulares por módulo
INSERT INTO matec_radar.system_permisos (clave, label, modulo) VALUES
  ('scan.trigger',    'Disparar escaneo',         'scan'),
  ('scan.rescan',     'Re-escanear empresa',       'scan'),
  ('schedule.create', 'Crear programación',        'schedule'),
  ('schedule.delete', 'Eliminar programación',     'schedule'),
  ('empresas.create', 'Crear empresa',             'empresas'),
  ('empresas.delete', 'Eliminar empresa',          'empresas'),
  ('contactos.export','Exportar contactos',        'contactos'),
  ('contactos.sync',  'Sincronizar HubSpot',       'contactos'),
  ('admin.usuarios',  'Gestionar usuarios',         'admin'),
  ('admin.roles',     'Gestionar roles',            'admin'),
  ('admin.lineas',    'Gestionar líneas',           'admin'),
  ('admin.config',    'Configuración sistema',      'admin'),
  ('admin.actividad', 'Ver log actividad',          'admin')
ON CONFLICT (clave) DO NOTHING;

-- RLS
ALTER TABLE matec_radar.system_permisos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='system_permisos' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.system_permisos
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='system_permisos' AND policyname='public_read'
  ) THEN
    CREATE POLICY public_read ON matec_radar.system_permisos
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.system_permisos TO service_role;
GRANT SELECT ON matec_radar.system_permisos TO anon, authenticated;

-- ── 9. Tabla: roles_permisos (N:M roles ↔ permisos) ──────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.roles_permisos (
  role_id    smallint REFERENCES matec_radar.system_roles(id) ON DELETE CASCADE,
  permiso_id smallint REFERENCES matec_radar.system_permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permiso_id)
);

-- Seed: ADMIN tiene todos los permisos
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id
FROM matec_radar.system_roles r, matec_radar.system_permisos p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- Seed: COMERCIAL tiene permisos operacionales
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id
FROM matec_radar.system_roles r, matec_radar.system_permisos p
WHERE r.slug = 'comercial'
  AND p.clave IN (
    'scan.trigger','scan.rescan',
    'schedule.create','schedule.delete',
    'empresas.create','empresas.delete',
    'contactos.export','contactos.sync'
  )
ON CONFLICT DO NOTHING;

-- Seed: AUXILIAR solo puede exportar contactos
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id
FROM matec_radar.system_roles r, matec_radar.system_permisos p
WHERE r.slug = 'auxiliar'
  AND p.clave = 'contactos.export'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE matec_radar.roles_permisos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='roles_permisos' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.roles_permisos
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='roles_permisos' AND policyname='public_read'
  ) THEN
    CREATE POLICY public_read ON matec_radar.roles_permisos
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.roles_permisos TO service_role;
GRANT SELECT ON matec_radar.roles_permisos TO anon, authenticated;

-- ── 10. Tabla: empresas (en matec_radar — si no existe ya) ────────────────────
-- NOTA: ya existe en este Supabase (verificado 2026-04-09).
-- Esta sección es solo para instancias vacías.

CREATE TABLE IF NOT EXISTS matec_radar.empresas (
  id             BIGSERIAL PRIMARY KEY,
  company_name   TEXT NOT NULL,
  company_domain TEXT,
  company_url    TEXT,
  pais           TEXT,
  ciudad         TEXT,
  linea_negocio  TEXT NOT NULL,
  linea_raw      TEXT,
  tier           TEXT NOT NULL DEFAULT 'Tier B',
  status         TEXT NOT NULL DEFAULT 'pending',
  prioridad      INTEGER NOT NULL DEFAULT 0,
  keywords       TEXT,
  owner_id       uuid REFERENCES auth.users(id),
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT empresas_company_linea_key UNIQUE (company_name, linea_negocio)
);

CREATE INDEX IF NOT EXISTS empresas_linea_negocio_idx ON matec_radar.empresas (linea_negocio);
CREATE INDEX IF NOT EXISTS empresas_last_run_at_idx   ON matec_radar.empresas (last_run_at);
CREATE INDEX IF NOT EXISTS empresas_prioridad_idx     ON matec_radar.empresas (prioridad);
CREATE INDEX IF NOT EXISTS empresas_status_idx        ON matec_radar.empresas (status);

DROP TRIGGER IF EXISTS empresas_set_updated_at ON matec_radar.empresas;
CREATE TRIGGER empresas_set_updated_at
  BEFORE UPDATE ON matec_radar.empresas
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

ALTER TABLE matec_radar.empresas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='empresas' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.empresas
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON matec_radar.empresas TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.empresas_id_seq TO service_role;

-- ── 11. Tabla: ejecuciones ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.ejecuciones (
  id               BIGSERIAL PRIMARY KEY,
  n8n_execution_id TEXT,
  linea_negocio    TEXT,
  batch_size       INTEGER,
  estado           TEXT NOT NULL DEFAULT 'running',
  trigger_type     TEXT NOT NULL DEFAULT 'manual',
  agent_type       TEXT NOT NULL DEFAULT 'calificador',
  pipeline_id      TEXT,
  parent_execution_id INTEGER,
  current_step     TEXT,
  parametros       JSONB,
  error_msg        TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ejecuciones_linea_negocio_idx ON matec_radar.ejecuciones (linea_negocio);
CREATE INDEX IF NOT EXISTS ejecuciones_estado_idx        ON matec_radar.ejecuciones (estado);
CREATE INDEX IF NOT EXISTS ejecuciones_started_at_idx    ON matec_radar.ejecuciones (started_at);
CREATE INDEX IF NOT EXISTS ejecuciones_pipeline_id_idx   ON matec_radar.ejecuciones (pipeline_id);
CREATE INDEX IF NOT EXISTS ejecuciones_agent_type_idx    ON matec_radar.ejecuciones (agent_type);

ALTER TABLE matec_radar.ejecuciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='matec_radar' AND tablename='ejecuciones' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON matec_radar.ejecuciones
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON matec_radar.ejecuciones TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.ejecuciones_id_seq TO service_role;

-- ── 12. Exposición del schema en PostgREST ────────────────────────────────────
-- IMPORTANTE: PostgREST solo sirve schemas que estén en su config.
-- Para que /rest/v1/ reconozca matec_radar, debes agregar el schema
-- en la config de PostgREST (supabase/config.toml o variable PGRST_DB_SCHEMAS).
--
-- En Supabase self-hosted con Docker, editar docker-compose.yml o .env:
--   PGRST_DB_SCHEMAS=public,matec_radar
-- Luego reiniciar el contenedor de PostgREST:
--   docker restart supabase-rest
--
-- En Supabase Cloud: Settings → API → Exposed schemas → agregar matec_radar

-- ============================================================
-- CREAR EL PRIMER USUARIO ADMIN
-- ============================================================
--
-- Prerrequisito: el usuario debe existir primero en auth.users
-- (que se crea al registrarse vía la UI o crear en Supabase Auth Dashboard)
--
-- Paso 1: Verificar que el auth_user_id existe:
--   SELECT id, email FROM auth.users WHERE email = 'tu@email.com';
--
-- Paso 2: Crear el registro en matec_radar.usuarios:
--   INSERT INTO matec_radar.usuarios (
--     auth_user_id,
--     nombre,
--     email,
--     rol,
--     estado_acceso,
--     aprobado_en
--   ) VALUES (
--     '<uuid-de-auth.users>',  -- reemplazar con el ID del paso 1
--     'Juan Camilo Vélez',
--     'juancamilo@matec.com.co',
--     'ADMIN',
--     'ACTIVO',
--     now()
--   )
--   ON CONFLICT (email) DO UPDATE
--     SET rol = 'ADMIN', estado_acceso = 'ACTIVO', aprobado_en = now();
--
-- Paso 3 (opcional): Registrar en system_roles si el sistema usa esa tabla:
--   -- El rol 'ADMIN' de usuarios es diferente al slug 'admin' de system_roles.
--   -- La columna usuarios.rol usa los valores 'ADMIN'|'COMERCIAL'|'AUXILIAR'.
--
-- Ejemplo completo para los 6 usuarios de auth.users ya existentes:
--
-- INSERT INTO matec_radar.usuarios (auth_user_id, nombre, email, rol, estado_acceso, aprobado_en)
-- SELECT
--   id as auth_user_id,
--   split_part(email, '@', 1) as nombre,
--   email,
--   CASE
--     WHEN email IN ('juancamilo@matec.com.co', 'felipe.gaviria@matec.com.co') THEN 'ADMIN'
--     WHEN email IN ('paola.vaquero@matec.com.co') THEN 'COMERCIAL'
--     ELSE 'AUXILIAR'
--   END as rol,
--   'ACTIVO' as estado_acceso,
--   now() as aprobado_en
-- FROM auth.users
-- ON CONFLICT (email) DO NOTHING;
-- ============================================================
