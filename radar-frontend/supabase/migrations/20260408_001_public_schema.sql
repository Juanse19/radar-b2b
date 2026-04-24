-- ============================================================
-- Matec Radar B2B — Tablas en schema PUBLIC
-- Usar este script en vez del 000 original cuando no es posible
-- exponer un schema custom (instancias self-hosted sin acceso admin).
--
-- Ejecutar en: supabase.valparaiso.cafe → SQL Editor
-- ============================================================

-- ── Función para updated_at automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.matec_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Tabla: empresas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresas (
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

CREATE INDEX IF NOT EXISTS empresas_linea_negocio_idx ON public.empresas (linea_negocio);
CREATE INDEX IF NOT EXISTS empresas_last_run_at_idx   ON public.empresas (last_run_at);
CREATE INDEX IF NOT EXISTS empresas_prioridad_idx     ON public.empresas (prioridad);
CREATE INDEX IF NOT EXISTS empresas_status_idx        ON public.empresas (status);

DROP TRIGGER IF EXISTS empresas_set_updated_at ON public.empresas;
CREATE TRIGGER empresas_set_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.matec_set_updated_at();

-- ── Tabla: ejecuciones ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ejecuciones (
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

CREATE INDEX IF NOT EXISTS ejecuciones_linea_negocio_idx ON public.ejecuciones (linea_negocio);
CREATE INDEX IF NOT EXISTS ejecuciones_estado_idx        ON public.ejecuciones (estado);
CREATE INDEX IF NOT EXISTS ejecuciones_started_at_idx    ON public.ejecuciones (started_at);

-- ── Tabla: senales ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.senales (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
  ejecucion_id        BIGINT REFERENCES public.ejecuciones(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS senales_empresa_id_idx    ON public.senales (empresa_id);
CREATE INDEX IF NOT EXISTS senales_linea_negocio_idx ON public.senales (linea_negocio);
CREATE INDEX IF NOT EXISTS senales_score_radar_idx   ON public.senales (score_radar);
CREATE INDEX IF NOT EXISTS senales_created_at_idx    ON public.senales (created_at);

-- ── Tabla: contactos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contactos (
  id             BIGSERIAL PRIMARY KEY,
  empresa_id     BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS contactos_empresa_id_idx     ON public.contactos (empresa_id);
CREATE INDEX IF NOT EXISTS contactos_hubspot_status_idx ON public.contactos (hubspot_status);
CREATE INDEX IF NOT EXISTS contactos_linea_negocio_idx  ON public.contactos (linea_negocio);

DROP TRIGGER IF EXISTS contactos_set_updated_at ON public.contactos;
CREATE TRIGGER contactos_set_updated_at
  BEFORE UPDATE ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.matec_set_updated_at();

-- ── Tabla: prospeccion_logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospeccion_logs (
  id                    BIGSERIAL PRIMARY KEY,
  empresa_nombre        TEXT        NOT NULL,
  linea                 TEXT        NOT NULL,
  n8n_execution_id      TEXT,
  estado                TEXT        NOT NULL DEFAULT 'running',
  contactos_encontrados INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS prospeccion_logs_linea_idx      ON public.prospeccion_logs (linea);
CREATE INDEX IF NOT EXISTS prospeccion_logs_estado_idx     ON public.prospeccion_logs (estado);
CREATE INDEX IF NOT EXISTS prospeccion_logs_created_at_idx ON public.prospeccion_logs (created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.empresas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejecuciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccion_logs ENABLE ROW LEVEL SECURITY;

-- Política: solo service_role tiene acceso total (anon bloqueado)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON public.empresas FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ejecuciones' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON public.ejecuciones FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='senales' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON public.senales FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contactos' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON public.contactos FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospeccion_logs' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON public.prospeccion_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
