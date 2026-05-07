-- =============================================================================
-- Migración: Apollo Prospector v2 (búsqueda de contactos nativa Next.js)
-- =============================================================================
-- Fecha:    2026-05-06
-- Propósito:
--   1. Extender matec_radar.contactos con campos del flujo SSE (phone_unlocked,
--      fase2_done, nivel_jerarquico, prospector_session_id, es_principal).
--   2. Crear matec_radar.prospector_v2_sessions — tabla de sesiones de búsqueda.
--   3. Crear índices y RLS adecuados.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extender matec_radar.contactos
-- ---------------------------------------------------------------------------
-- Estos campos no existían en 20260408_002_business_model.sql.
-- Se agregan IDEMPOTENTEMENTE para no romper despliegues parciales.

ALTER TABLE matec_radar.contactos
  ADD COLUMN IF NOT EXISTS phone_unlocked        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_unlocked_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fase2_done            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nivel_jerarquico      TEXT
    CHECK (nivel_jerarquico IS NULL OR nivel_jerarquico IN ('C-LEVEL','DIRECTOR','GERENTE','JEFE','ANALISTA')),
  ADD COLUMN IF NOT EXISTS prospector_session_id UUID,
  ADD COLUMN IF NOT EXISTS es_principal          BOOLEAN     NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS contactos_nivel_idx
  ON matec_radar.contactos (nivel_jerarquico);

CREATE INDEX IF NOT EXISTS contactos_session_idx
  ON matec_radar.contactos (prospector_session_id);

CREATE INDEX IF NOT EXISTS contactos_fase2_done_idx
  ON matec_radar.contactos (fase2_done) WHERE fase2_done = TRUE;

-- ---------------------------------------------------------------------------
-- 2. Tabla de sesiones del wizard
-- ---------------------------------------------------------------------------
-- Una sesión = una ejecución del wizard de Contactos, puede prospectar
-- N empresas (auto o manual). Sus contactos se referencian vía
-- contactos.prospector_session_id.

CREATE TABLE IF NOT EXISTS matec_radar.prospector_v2_sessions (
  id                 UUID        PRIMARY KEY,
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  modo               TEXT        NOT NULL CHECK (modo IN ('auto','manual')),
  sublineas          TEXT[]      NOT NULL DEFAULT '{}',
  tiers              TEXT[],     -- usado solo en modo auto

  empresas_count     INTEGER     NOT NULL DEFAULT 0,
  estimated_credits  INTEGER     NOT NULL DEFAULT 0,

  total_contacts     INTEGER     NOT NULL DEFAULT 0,
  total_with_email   INTEGER     NOT NULL DEFAULT 0,
  total_with_phone   INTEGER     NOT NULL DEFAULT 0,
  credits_used       INTEGER     NOT NULL DEFAULT 0,

  duration_ms        INTEGER,
  cancelled          BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS prospector_v2_sessions_user_idx
  ON matec_radar.prospector_v2_sessions (user_id);

CREATE INDEX IF NOT EXISTS prospector_v2_sessions_created_idx
  ON matec_radar.prospector_v2_sessions (created_at DESC);

-- Foreign key tardía hacia contactos (evita dependencia circular en orden de migración).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contactos_prospector_session_fk'
  ) THEN
    ALTER TABLE matec_radar.contactos
      ADD CONSTRAINT contactos_prospector_session_fk
      FOREIGN KEY (prospector_session_id)
      REFERENCES matec_radar.prospector_v2_sessions(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 3. Asegurar UNIQUE en apollo_id (idempotente — ya existe en business_model)
-- ---------------------------------------------------------------------------
-- En instalaciones donde la migración 002_business_model.sql no se aplicó,
-- garantizamos la unicidad para que ON CONFLICT (apollo_id) funcione.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'matec_radar'
      AND tablename  = 'contactos'
      AND indexdef LIKE '%UNIQUE%apollo_id%'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX contactos_apollo_id_uk
        ON matec_radar.contactos (apollo_id)
        WHERE apollo_id IS NOT NULL;
    EXCEPTION WHEN duplicate_table THEN
      -- otro proceso lo creó concurrentemente — ignorar
      NULL;
    END;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE matec_radar.prospector_v2_sessions ENABLE ROW LEVEL SECURITY;

-- service_role: acceso total (server-side writes)
DROP POLICY IF EXISTS prospector_v2_sessions_service_role_all
  ON matec_radar.prospector_v2_sessions;
CREATE POLICY prospector_v2_sessions_service_role_all
  ON matec_radar.prospector_v2_sessions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- authenticated: SELECT propias sesiones
DROP POLICY IF EXISTS prospector_v2_sessions_authenticated_read
  ON matec_radar.prospector_v2_sessions;
CREATE POLICY prospector_v2_sessions_authenticated_read
  ON matec_radar.prospector_v2_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

GRANT USAGE  ON SCHEMA matec_radar TO service_role;
GRANT ALL    ON matec_radar.prospector_v2_sessions TO service_role;
GRANT SELECT ON matec_radar.prospector_v2_sessions TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Comentarios documentales
-- ---------------------------------------------------------------------------
COMMENT ON TABLE  matec_radar.prospector_v2_sessions
  IS 'Sesiones del wizard Apollo Prospector v2 (búsqueda nativa Next.js, reemplaza WF03).';
COMMENT ON COLUMN matec_radar.contactos.phone_unlocked
  IS 'TRUE si el usuario gastó 9 créditos para revelar el teléfono móvil.';
COMMENT ON COLUMN matec_radar.contactos.fase2_done
  IS 'TRUE si el contacto ya tiene email verificado (skip enrich en futuras búsquedas).';
COMMENT ON COLUMN matec_radar.contactos.nivel_jerarquico
  IS 'Clasificación derivada de title: C-LEVEL > DIRECTOR > GERENTE > JEFE > ANALISTA.';
COMMENT ON COLUMN matec_radar.contactos.prospector_session_id
  IS 'FK a prospector_v2_sessions: sesión del wizard que originó este contacto.';

COMMIT;
