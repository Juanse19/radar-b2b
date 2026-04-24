-- Sprint 3.6 Phase 4: Dynamic roles & permissions tables
-- Schema: matec_radar (applied globally via SUPABASE_DB_SCHEMA env var in the client)
-- Run via: docker exec -i supabase-db psql -U postgres -d postgres < this_file.sql

-- Roles del sistema
CREATE TABLE IF NOT EXISTS matec_radar.system_roles (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug        text NOT NULL UNIQUE,
  label       text NOT NULL,
  descripcion text,
  color       text DEFAULT '#6366f1',
  es_sistema  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Permisos granulares
CREATE TABLE IF NOT EXISTS matec_radar.system_permisos (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  clave       text NOT NULL UNIQUE,
  label       text NOT NULL,
  descripcion text,
  modulo      text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Relación N:M roles ↔ permisos
CREATE TABLE IF NOT EXISTS matec_radar.roles_permisos (
  role_id    smallint REFERENCES matec_radar.system_roles(id) ON DELETE CASCADE,
  permiso_id smallint REFERENCES matec_radar.system_permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permiso_id)
);

-- Seed: roles base
INSERT INTO matec_radar.system_roles (slug, label, descripcion, color, es_sistema) VALUES
  ('admin',     'Administrador', 'Acceso total al sistema', '#8b5cf6', true),
  ('comercial', 'Comercial', 'Acceso operacional (sin admin)', '#3b82f6', true),
  ('auxiliar',  'Auxiliar', 'Solo lectura de resultados y contactos', '#6b7280', true)
ON CONFLICT (slug) DO NOTHING;

-- Seed: permisos base
INSERT INTO matec_radar.system_permisos (clave, label, modulo) VALUES
  ('scan.trigger',    'Disparar escaneo',        'scan'),
  ('scan.rescan',     'Re-escanear empresa',      'scan'),
  ('schedule.create', 'Crear programación',       'schedule'),
  ('schedule.delete', 'Eliminar programación',    'schedule'),
  ('empresas.create', 'Crear empresa',            'empresas'),
  ('empresas.delete', 'Eliminar empresa',         'empresas'),
  ('contactos.export','Exportar contactos',       'contactos'),
  ('contactos.sync',  'Sincronizar HubSpot',      'contactos'),
  ('admin.usuarios',  'Gestionar usuarios',        'admin'),
  ('admin.roles',     'Gestionar roles',           'admin'),
  ('admin.lineas',    'Gestionar líneas',          'admin'),
  ('admin.config',    'Configuración sistema',     'admin'),
  ('admin.actividad', 'Ver log actividad',         'admin')
ON CONFLICT (clave) DO NOTHING;

-- ADMIN tiene todos los permisos
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id FROM matec_radar.system_roles r, matec_radar.system_permisos p WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- COMERCIAL tiene permisos operacionales
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id FROM matec_radar.system_roles r, matec_radar.system_permisos p
WHERE r.slug = 'comercial'
  AND p.clave IN ('scan.trigger','scan.rescan','schedule.create','schedule.delete',
                  'empresas.create','empresas.delete','contactos.export','contactos.sync')
ON CONFLICT DO NOTHING;

-- AUXILIAR solo puede exportar contactos
INSERT INTO matec_radar.roles_permisos (role_id, permiso_id)
SELECT r.id, p.id FROM matec_radar.system_roles r, matec_radar.system_permisos p
WHERE r.slug = 'auxiliar' AND p.clave = 'contactos.export'
ON CONFLICT DO NOTHING;

-- Grants (consistent with existing schema setup)
GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.system_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.system_permisos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON matec_radar.roles_permisos TO service_role;
GRANT SELECT ON matec_radar.system_roles TO anon, authenticated;
GRANT SELECT ON matec_radar.system_permisos TO anon, authenticated;
GRANT SELECT ON matec_radar.roles_permisos TO anon, authenticated;
