-- ============================================================
-- Matec Radar B2B — Schema inicial: matec_radar
-- Ejecutar en: supabase.valparaiso.cafe → SQL Editor
--
-- PASO MANUAL REQUERIDO después de ejecutar este script:
--   Settings → API → Exposed schemas → agregar "matec_radar"
-- ============================================================

CREATE SCHEMA IF NOT EXISTS matec_radar;

-- ── Función para updated_at automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION matec_radar.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Tabla: empresas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.empresas (
  id             BIGSERIAL PRIMARY KEY,
  company_name   TEXT      NOT NULL,
  company_domain TEXT,
  company_url    TEXT,
  pais           TEXT,
  ciudad         TEXT,
  linea_negocio  TEXT      NOT NULL,
  linea_raw      TEXT,
  tier           TEXT      NOT NULL DEFAULT 'Tier B',
  status         TEXT      NOT NULL DEFAULT 'pending',
  prioridad      INTEGER   NOT NULL DEFAULT 0,
  keywords       TEXT,
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT empresas_company_linea_key UNIQUE (company_name, linea_negocio)
);

CREATE INDEX IF NOT EXISTS empresas_linea_negocio_idx ON matec_radar.empresas (linea_negocio);
CREATE INDEX IF NOT EXISTS empresas_last_run_at_idx   ON matec_radar.empresas (last_run_at);
CREATE INDEX IF NOT EXISTS empresas_prioridad_idx     ON matec_radar.empresas (prioridad);
CREATE INDEX IF NOT EXISTS empresas_status_idx        ON matec_radar.empresas (status);

CREATE OR REPLACE TRIGGER empresas_set_updated_at
  BEFORE UPDATE ON matec_radar.empresas
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- ── Tabla: ejecuciones ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.ejecuciones (
  id               BIGSERIAL PRIMARY KEY,
  n8n_execution_id TEXT,
  linea_negocio    TEXT,
  batch_size       INTEGER,
  estado           TEXT        NOT NULL DEFAULT 'running',
  trigger_type     TEXT        NOT NULL DEFAULT 'manual',
  parametros       JSONB,
  error_msg        TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ejecuciones_linea_negocio_idx ON matec_radar.ejecuciones (linea_negocio);
CREATE INDEX IF NOT EXISTS ejecuciones_estado_idx        ON matec_radar.ejecuciones (estado);
CREATE INDEX IF NOT EXISTS ejecuciones_started_at_idx    ON matec_radar.ejecuciones (started_at);

-- ── Tabla: senales ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.senales (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          BIGINT REFERENCES matec_radar.empresas(id) ON DELETE SET NULL,
  ejecucion_id        BIGINT REFERENCES matec_radar.ejecuciones(id) ON DELETE SET NULL,
  empresa_nombre      TEXT        NOT NULL,
  empresa_pais        TEXT,
  linea_negocio       TEXT        NOT NULL,
  tier                TEXT,
  radar_activo        BOOLEAN     NOT NULL DEFAULT FALSE,
  tipo_senal          TEXT,
  descripcion         TEXT,
  fuente              TEXT,
  fuente_url          TEXT,
  score_radar         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ventana_compra      TEXT,
  prioridad_comercial TEXT,
  motivo_descarte     TEXT,
  ticket_estimado     TEXT,
  razonamiento_agente TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS senales_empresa_id_idx    ON matec_radar.senales (empresa_id);
CREATE INDEX IF NOT EXISTS senales_linea_negocio_idx ON matec_radar.senales (linea_negocio);
CREATE INDEX IF NOT EXISTS senales_score_radar_idx   ON matec_radar.senales (score_radar);
CREATE INDEX IF NOT EXISTS senales_created_at_idx    ON matec_radar.senales (created_at);

-- ── Tabla: contactos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.contactos (
  id             BIGSERIAL PRIMARY KEY,
  empresa_id     BIGINT REFERENCES matec_radar.empresas(id) ON DELETE SET NULL,
  nombre         TEXT        NOT NULL,
  cargo          TEXT,
  email          TEXT,
  telefono       TEXT,
  linkedin_url   TEXT,
  empresa_nombre TEXT,
  linea_negocio  TEXT,
  fuente         TEXT        NOT NULL DEFAULT 'apollo',
  hubspot_status TEXT        NOT NULL DEFAULT 'pendiente',
  hubspot_id     TEXT,
  apollo_id      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contactos_empresa_id_idx    ON matec_radar.contactos (empresa_id);
CREATE INDEX IF NOT EXISTS contactos_hubspot_status_idx ON matec_radar.contactos (hubspot_status);
CREATE INDEX IF NOT EXISTS contactos_linea_negocio_idx ON matec_radar.contactos (linea_negocio);

CREATE OR REPLACE TRIGGER contactos_set_updated_at
  BEFORE UPDATE ON matec_radar.contactos
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- ── Tabla: prospeccion_logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matec_radar.prospeccion_logs (
  id                    BIGSERIAL PRIMARY KEY,
  empresa_nombre        TEXT        NOT NULL,
  linea                 TEXT        NOT NULL,
  n8n_execution_id      TEXT,
  estado                TEXT        NOT NULL DEFAULT 'running',
  contactos_encontrados INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS prospeccion_logs_linea_idx      ON matec_radar.prospeccion_logs (linea);
CREATE INDEX IF NOT EXISTS prospeccion_logs_estado_idx     ON matec_radar.prospeccion_logs (estado);
CREATE INDEX IF NOT EXISTS prospeccion_logs_created_at_idx ON matec_radar.prospeccion_logs (created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE matec_radar.empresas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.ejecuciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.senales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.contactos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.prospeccion_logs ENABLE ROW LEVEL SECURITY;

-- Política: solo service_role tiene acceso total (anon bloqueado)
CREATE POLICY service_role_all ON matec_radar.empresas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all ON matec_radar.ejecuciones
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all ON matec_radar.senales
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all ON matec_radar.contactos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all ON matec_radar.prospeccion_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA matec_radar TO service_role;

GRANT ALL ON matec_radar.empresas         TO service_role;
GRANT ALL ON matec_radar.ejecuciones      TO service_role;
GRANT ALL ON matec_radar.senales          TO service_role;
GRANT ALL ON matec_radar.contactos        TO service_role;
GRANT ALL ON matec_radar.prospeccion_logs TO service_role;

GRANT USAGE, SELECT ON SEQUENCE matec_radar.empresas_id_seq         TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.ejecuciones_id_seq      TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.senales_id_seq          TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.contactos_id_seq        TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.prospeccion_logs_id_seq TO service_role;
