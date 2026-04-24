-- Sprint 3.4: Auth + Admin tables
-- Schema: matec_radar (custom, not public)
-- Run via: docker exec -i supabase-db psql -U postgres -d postgres < this_file.sql

-- 0. Create schema
CREATE SCHEMA IF NOT EXISTS matec_radar;

-- Grant usage to service_role and anon
GRANT USAGE ON SCHEMA matec_radar TO service_role, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA matec_radar
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA matec_radar
  GRANT SELECT ON TABLES TO anon, authenticated;

-- 1. Usuarios (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS matec_radar.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text UNIQUE NOT NULL,
  rol text NOT NULL DEFAULT 'AUXILIAR'
        CHECK (rol IN ('ADMIN','COMERCIAL','AUXILIAR')),
  estado_acceso text NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado_acceso IN ('ACTIVO','PENDIENTE','INACTIVO')),
  aprobado_por uuid REFERENCES matec_radar.usuarios(id),
  aprobado_en timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Líneas de negocio (replaces hardcoded lib/lineas.ts)
CREATE TABLE IF NOT EXISTS matec_radar.lineas_negocio (
  id smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL UNIQUE,
  descripcion text,
  color_hex text DEFAULT '#6366f1',
  icono text DEFAULT 'Layers',
  activo boolean DEFAULT true,
  orden smallint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Fuentes de búsqueda
CREATE TABLE IF NOT EXISTS matec_radar.fuentes (
  id smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  url_base text,
  tipo text CHECK (tipo IN ('tavily','rss','scraping','api','manual')),
  lineas text[],
  priority_score smallint DEFAULT 5,
  activa boolean DEFAULT true,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- 4. Configuración clave-valor
CREATE TABLE IF NOT EXISTS matec_radar.configuracion (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descripcion text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Log de actividad / auditoría
CREATE TABLE IF NOT EXISTS matec_radar.actividad (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id uuid REFERENCES matec_radar.usuarios(id),
  usuario_email text,
  tipo text NOT NULL,
  descripcion text,
  resultado text CHECK (resultado IN ('ok','error','warn')),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Seed initial lines
INSERT INTO matec_radar.lineas_negocio (nombre, descripcion, color_hex, icono, orden) VALUES
  ('BHS', 'Aeropuertos, carruseles, sorters', '#3b82f6', 'Plane', 1),
  ('Cartón', 'Corrugadoras, empaque', '#f59e0b', 'Package', 2),
  ('Intralogística', 'CEDI, WMS, ASRS, conveyor', '#10b981', 'Warehouse', 3),
  ('Final de Línea', 'Alimentos, bebidas, palletizado', '#f97316', 'Factory', 4),
  ('Motos', 'Ensambladoras, motocicletas', '#f43f5e', 'Bike', 5),
  ('SOLUMAT', 'Plásticos, materiales industriales', '#8b5cf6', 'Truck', 6)
ON CONFLICT (nombre) DO NOTHING;

-- Seed config defaults
INSERT INTO matec_radar.configuracion (clave, valor, descripcion) VALUES
  ('batch_size_default', '10'::jsonb, 'Tamaño de batch por defecto para agentes'),
  ('lineas_activas', '["BHS","Cartón","Intralogística"]'::jsonb, 'Líneas actualmente activas'),
  ('prospector_contactos_por_empresa', '3'::jsonb, 'Contactos por empresa para WF03'),
  ('schedule_hora_default', '"07:00"'::jsonb, 'Hora por defecto del escaneo automático')
ON CONFLICT (clave) DO NOTHING;

-- Helper: update updated_at on usuarios
CREATE OR REPLACE FUNCTION matec_radar.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER usuarios_updated_at
  BEFORE UPDATE ON matec_radar.usuarios
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

CREATE OR REPLACE TRIGGER configuracion_updated_at
  BEFORE UPDATE ON matec_radar.configuracion
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();
