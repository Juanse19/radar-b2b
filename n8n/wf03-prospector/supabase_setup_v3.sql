-- ============================================================
-- Supabase Setup para WF03 Prospector v3.0
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Asegurarse de que la tabla contactos tiene la columna apollo_id como UNIQUE
-- (Si ya existe, saltar este bloque)
ALTER TABLE matec_radar.contactos
  ADD COLUMN IF NOT EXISTS email_verificado  TEXT,
  ADD COLUMN IF NOT EXISTS estado_email      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url      TEXT,
  ADD COLUMN IF NOT EXISTS tel_empresa       TEXT,
  ADD COLUMN IF NOT EXISTS tel_movil         TEXT,
  ADD COLUMN IF NOT EXISTS linea_negocio     TEXT,
  ADD COLUMN IF NOT EXISTS score_calificacion NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_radar        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS composite_score    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_multinacional  TEXT DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS fecha_prospeccion TIMESTAMPTZ DEFAULT NOW();

-- Índice único por apollo_id (para ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS contactos_apollo_id_unique
  ON matec_radar.contactos (apollo_id)
  WHERE apollo_id IS NOT NULL AND apollo_id <> '';

-- 2. Tabla sin_contactos (si no existe)
CREATE TABLE IF NOT EXISTS matec_radar.sin_contactos (
  id            SERIAL PRIMARY KEY,
  empresa       TEXT NOT NULL,
  dominio       TEXT,
  sub_linea     TEXT,
  pais          TEXT,
  razon         TEXT,
  re_escanear   TEXT DEFAULT 'Si',
  fecha         DATE,
  tier          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa, pais)
);

-- 3. Función RPC: get_prospectos_recientes(minutes_ago int)
-- Usada por WF03 v3.0 para devolver contactos al frontend
CREATE OR REPLACE FUNCTION matec_radar.get_prospectos_recientes(minutes_ago INT DEFAULT 5)
RETURNS SETOF matec_radar.contactos
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM   matec_radar.contactos
  WHERE  fecha_prospeccion >= NOW() - (minutes_ago || ' minutes')::INTERVAL
  ORDER  BY
    CASE nivel
      WHEN 'C-LEVEL'  THEN 1
      WHEN 'DIRECTOR' THEN 2
      WHEN 'GERENTE'  THEN 3
      WHEN 'JEFE'     THEN 4
      ELSE 5
    END,
    empresa,
    nombre;
$$;

-- Exponer la función via PostgREST
COMMENT ON FUNCTION matec_radar.get_prospectos_recientes(INT) IS
  'Retorna contactos prospectados en los últimos N minutos — usada por WF03 v3.0';

-- 4. Variable n8n: SUPABASE_SERVICE_ROLE_KEY
-- Ir a n8n → Settings → Variables y crear:
--   Name: SUPABASE_SERVICE_ROLE_KEY
--   Value: <tu service role key de Supabase>

-- 5. Grant para la función (si se usa rol anon/authenticated)
GRANT EXECUTE ON FUNCTION matec_radar.get_prospectos_recientes(INT)
  TO authenticated, service_role;

-- Verificación
SELECT 'Setup completado ✅' AS status;
