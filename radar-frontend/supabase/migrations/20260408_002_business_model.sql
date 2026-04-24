-- =============================================================================
-- Migration: 20260408_002_business_model.sql
-- Purpose:   Full E-R model for Matec Radar B2B (schema matec_radar).
--            16 tables, 13 Postgres enums, triggers, RLS policies.
--            Run AFTER 20260408_0015_drop_legacy.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable unaccent wrapper (unaccent() is STABLE by default, which blocks
-- GENERATED ALWAYS columns; specifying the dictionary makes it IMMUTABLE)
CREATE OR REPLACE FUNCTION matec_radar.f_unaccent(text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

-- ---------------------------------------------------------------------------
-- 1. Helper: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION matec_radar.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE matec_radar.tier_enum AS ENUM ('A','B','C','D','sin_calificar');

CREATE TYPE matec_radar.prioridad_enum AS ENUM (
  'muy_alta','alta','media','baja','muy_baja','descartada'
);

CREATE TYPE matec_radar.ventana_compra_enum AS ENUM (
  '0_6m','6_12m','12_18m','18_24m','mas_24m','desconocida'
);

CREATE TYPE matec_radar.impacto_enum AS ENUM (
  'muy_alto','alto','medio','bajo','muy_bajo'
);

CREATE TYPE matec_radar.recurrencia_enum AS ENUM (
  'muy_alta','alta','media','baja','muy_baja'
);

CREATE TYPE matec_radar.multiplanta_enum AS ENUM (
  'unica_sede','varias_sedes_regionales','presencia_internacional','desconocido'
);

CREATE TYPE matec_radar.referente_enum AS ENUM (
  'internacional','pais','baja','desconocido'
);

CREATE TYPE matec_radar.pipeline_enum AS ENUM (
  'core','en_observacion','descartar',
  'no_iniciado','investigacion','contacto_inicial',
  'calificado','propuesta','negociacion',
  'cerrado_ganado','cerrado_perdido'
);

CREATE TYPE matec_radar.radar_activo_enum AS ENUM ('activo','pausado','inactivo');

CREATE TYPE matec_radar.pais_iso_enum AS ENUM (
  'MX','CO','BR','AR','CL','PE','EC','UY','PY','BO','VE',
  'CR','PA','GT','SV','HN','NI','DO','JM','BS',
  'US','CA','ES','Otro'
);

CREATE TYPE matec_radar.estado_ejecucion_enum AS ENUM (
  'pending','running','completed','failed','cancelled','timeout'
);

CREATE TYPE matec_radar.estado_prospeccion_enum AS ENUM (
  'pendiente','ejecutando','encontrado','sin_contactos','error'
);

CREATE TYPE matec_radar.hubspot_status_enum AS ENUM (
  'pendiente','sincronizado','error','omitido'
);

CREATE TYPE matec_radar.workflow_enum AS ENUM (
  'wf01_calificador','wf02_radar','wf03_prospector','manual','import'
);

CREATE TYPE matec_radar.meta_schema_version_enum AS ENUM (
  'v1_compacto','v2_amplio'
);

-- ---------------------------------------------------------------------------
-- 3. Catálogos administrables
-- ---------------------------------------------------------------------------

-- 3.1 Líneas de negocio primarias
CREATE TABLE matec_radar.lineas_negocio (
  id          SMALLSERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,   -- 'bhs', 'carton_papel', 'intralogistica'
  nombre      TEXT NOT NULL,          -- 'BHS (Baggage Handling Systems)'
  descripcion TEXT,
  color_hex   TEXT,
  icono       TEXT,                   -- lucide-react icon id
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_lineas_negocio_updated_at
  BEFORE UPDATE ON matec_radar.lineas_negocio
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- 3.2 Sub-líneas de negocio
CREATE TABLE matec_radar.sub_lineas_negocio (
  id                  SMALLSERIAL PRIMARY KEY,
  linea_id            SMALLINT NOT NULL
                        REFERENCES matec_radar.lineas_negocio(id) ON DELETE RESTRICT,
  codigo              TEXT NOT NULL,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  excel_sheet_name    TEXT,           -- hoja del Excel para ingest
  excel_file_pattern  TEXT,           -- glob del archivo para ingest
  meta_schema_version matec_radar.meta_schema_version_enum NOT NULL DEFAULT 'v2_amplio',
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  orden               SMALLINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (linea_id, codigo)
);

CREATE INDEX sub_lineas_linea_idx ON matec_radar.sub_lineas_negocio (linea_id);

CREATE TRIGGER trg_sub_lineas_updated_at
  BEFORE UPDATE ON matec_radar.sub_lineas_negocio
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- 3.3 Sectores / industrias (catálogo maestro)
CREATE TABLE matec_radar.sectores (
  id         SMALLSERIAL PRIMARY KEY,
  codigo     TEXT UNIQUE,
  nombre     TEXT NOT NULL,
  nombre_en  TEXT,
  parent_id  SMALLINT REFERENCES matec_radar.sectores(id) ON DELETE SET NULL,
  nivel      SMALLINT NOT NULL DEFAULT 1,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sectores_parent_idx ON matec_radar.sectores (parent_id);

-- 3.4 Job titles por línea
CREATE TABLE matec_radar.job_titles_por_linea (
  id           BIGSERIAL PRIMARY KEY,
  sub_linea_id SMALLINT NOT NULL
                 REFERENCES matec_radar.sub_lineas_negocio(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  nivel        SMALLINT NOT NULL,        -- 1=C-level, 2=VP/Dir, 3=Gerente, 4=Jefe, 5=Analista
  idioma       CHAR(2) NOT NULL DEFAULT 'es',
  prioridad    SMALLINT NOT NULL DEFAULT 2, -- 1=alta, 2=media, 3=baja
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_linea_id, titulo, idioma)
);

CREATE INDEX jt_sub_linea_prioridad_idx
  ON matec_radar.job_titles_por_linea (sub_linea_id, prioridad);

-- 3.5 Palabras clave por línea
CREATE TABLE matec_radar.palabras_clave_por_linea (
  id           BIGSERIAL PRIMARY KEY,
  sub_linea_id SMALLINT NOT NULL
                 REFERENCES matec_radar.sub_lineas_negocio(id) ON DELETE CASCADE,
  palabra      TEXT NOT NULL,
  idioma       CHAR(2) NOT NULL DEFAULT 'es',
  tipo         TEXT NOT NULL,   -- 'sector','producto','senal','exclusion'
  peso         SMALLINT NOT NULL DEFAULT 1,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_linea_id, palabra, idioma, tipo)
);

-- 3.6 Configuración de scoring
CREATE TABLE matec_radar.configuracion_scoring (
  id            SERIAL PRIMARY KEY,
  sub_linea_id  SMALLINT REFERENCES matec_radar.sub_lineas_negocio(id), -- NULL = global
  dimension     TEXT NOT NULL,  -- 'impacto','multiplanta','recurrencia','referente','anio','ticket','prioridad'
  peso          NUMERIC(5,2) NOT NULL,
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_linea_id, dimension, vigente_desde)
);

-- ---------------------------------------------------------------------------
-- 4. Core: empresas
-- ---------------------------------------------------------------------------
CREATE TABLE matec_radar.empresas (
  id                     BIGSERIAL PRIMARY KEY,
  owner_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identidad
  company_name           TEXT NOT NULL,
  company_name_norm      TEXT GENERATED ALWAYS AS (lower(matec_radar.f_unaccent(company_name))) STORED,
  company_domain         TEXT,
  company_url            TEXT,
  grupo_empresarial      TEXT,
  marca                  TEXT,              -- usado en V1 (Cargo/Motos)

  -- Ubicación
  pais                   matec_radar.pais_iso_enum,
  pais_nombre            TEXT,              -- fallback texto libre
  estado_region          TEXT,
  ciudad                 TEXT,

  -- Clasificación
  sector_id              SMALLINT REFERENCES matec_radar.sectores(id) ON DELETE SET NULL,
  industria_cliente      TEXT,
  sub_linea_principal_id SMALLINT
                           REFERENCES matec_radar.sub_lineas_negocio(id) ON DELETE SET NULL,

  -- Cache de últimos valores (mantenidos por triggers)
  tier_actual            matec_radar.tier_enum NOT NULL DEFAULT 'sin_calificar',
  score_total_ultimo     NUMERIC(5,2),
  score_radar_ultimo     NUMERIC(5,2),
  composite_score_ultimo NUMERIC(5,2),
  prioridad              matec_radar.prioridad_enum NOT NULL DEFAULT 'media',
  radar_activo           matec_radar.radar_activo_enum NOT NULL DEFAULT 'inactivo',
  pipeline               matec_radar.pipeline_enum NOT NULL DEFAULT 'no_iniciado',

  ultima_calificacion_id BIGINT,
  ultimo_radar_scan_id   BIGINT,
  ultima_prospeccion_id  BIGINT,
  ultimo_scan_at         TIMESTAMPTZ,
  ultima_calificacion_at TIMESTAMPTZ,

  -- Pipeline comercial
  responsable_comercial  TEXT,
  cuenta_estrategica     BOOLEAN NOT NULL DEFAULT FALSE,
  semaforo               TEXT,
  ultimo_contacto_at     TIMESTAMPTZ,
  proximo_contacto_at    TIMESTAMPTZ,
  observaciones          TEXT,

  -- Meta flexible por sub-línea (40+ campos V2 en JSONB)
  meta                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords               TEXT[],

  -- Trazabilidad de ingest
  source_file            TEXT,
  source_sheet           TEXT,
  imported_at            TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT empresas_company_name_not_empty CHECK (char_length(company_name) > 0)
);

-- Índices
CREATE UNIQUE INDEX empresas_name_norm_uk
  ON matec_radar.empresas (company_name_norm)
  WHERE owner_id IS NULL;

CREATE INDEX empresas_sub_linea_idx    ON matec_radar.empresas (sub_linea_principal_id);
CREATE INDEX empresas_tier_idx         ON matec_radar.empresas (tier_actual);
CREATE INDEX empresas_score_desc_idx   ON matec_radar.empresas (score_total_ultimo DESC NULLS LAST);
CREATE INDEX empresas_pais_idx         ON matec_radar.empresas (pais);
CREATE INDEX empresas_ultimo_scan_idx  ON matec_radar.empresas (ultimo_scan_at DESC NULLS LAST);
CREATE INDEX empresas_meta_gin         ON matec_radar.empresas USING gin (meta jsonb_path_ops);
CREATE INDEX empresas_owner_idx        ON matec_radar.empresas (owner_id);

CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON matec_radar.empresas
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- 4.1 Pivot N:M empresa ↔ sub-línea
CREATE TABLE matec_radar.empresa_sub_lineas (
  empresa_id   BIGINT  NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  sub_linea_id SMALLINT NOT NULL REFERENCES matec_radar.sub_lineas_negocio(id) ON DELETE RESTRICT,
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, sub_linea_id)
);

CREATE INDEX esl_sub_linea_idx ON matec_radar.empresa_sub_lineas (sub_linea_id);

-- 4.2 Terminales (satélite para sub-línea Aeropuertos)
CREATE TABLE matec_radar.empresa_terminales (
  id         BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  iata_code  CHAR(3) NOT NULL,
  icao_code  CHAR(4),
  nombre     TEXT,
  pais       matec_radar.pais_iso_enum,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, iata_code)
);

-- ---------------------------------------------------------------------------
-- 5. Historial de ejecuciones (append-only)
-- ---------------------------------------------------------------------------

-- 5.1 Ejecuciones (wrapper de cada run de workflow)
CREATE TABLE matec_radar.ejecuciones (
  id                        BIGSERIAL PRIMARY KEY,
  n8n_execution_id          TEXT,
  workflow                  matec_radar.workflow_enum NOT NULL,
  sub_linea_id              SMALLINT REFERENCES matec_radar.sub_lineas_negocio(id),
  batch_size                INTEGER,
  estado                    matec_radar.estado_ejecucion_enum NOT NULL DEFAULT 'running',
  trigger_type              TEXT NOT NULL DEFAULT 'manual',
  parametros                JSONB,
  error_msg                 TEXT,
  total_empresas_procesadas INTEGER DEFAULT 0,
  tokens_totales            INTEGER,
  costo_total_usd           NUMERIC(10,4),
  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at               TIMESTAMPTZ
);

CREATE INDEX ejec_workflow_started_idx ON matec_radar.ejecuciones (workflow, started_at DESC);
CREATE INDEX ejec_estado_idx           ON matec_radar.ejecuciones (estado);

-- 5.2 Calificaciones (WF01 output)
CREATE TABLE matec_radar.calificaciones (
  id               BIGSERIAL PRIMARY KEY,
  empresa_id       BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  ejecucion_id     BIGINT REFERENCES matec_radar.ejecuciones(id) ON DELETE SET NULL,
  n8n_execution_id TEXT,

  -- 7 sub-scores (0–10 cada uno)
  score_impacto    NUMERIC(4,2),
  score_multiplanta NUMERIC(4,2),
  score_recurrencia NUMERIC(4,2),
  score_referente  NUMERIC(4,2),
  score_anio       NUMERIC(4,2),
  score_ticket     NUMERIC(4,2),
  score_prioridad  NUMERIC(4,2),

  -- Dimensiones cualitativas
  impacto          matec_radar.impacto_enum,
  multiplanta      matec_radar.multiplanta_enum,
  recurrencia      matec_radar.recurrencia_enum,
  referente        matec_radar.referente_enum,

  -- Resultados
  score_total      NUMERIC(5,2) NOT NULL,
  tier_calculado   matec_radar.tier_enum NOT NULL,
  anio_objetivo    SMALLINT,
  ticket_estimado_usd NUMERIC(14,2),
  rango_ticket     TEXT,

  -- Trazabilidad
  razonamiento_agente     TEXT,
  prompt_version          TEXT,
  modelo_llm              TEXT,
  tokens_input            INTEGER,
  tokens_output           INTEGER,
  costo_usd               NUMERIC(10,6),
  config_scoring_snapshot JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX calif_empresa_created_idx ON matec_radar.calificaciones (empresa_id, created_at DESC);
CREATE INDEX calif_tier_idx            ON matec_radar.calificaciones (tier_calculado);
CREATE INDEX calif_score_desc_idx      ON matec_radar.calificaciones (score_total DESC);

-- 5.3 Radar scans (WF02 output)
CREATE TABLE matec_radar.radar_scans (
  id               BIGSERIAL PRIMARY KEY,
  empresa_id       BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  ejecucion_id     BIGINT REFERENCES matec_radar.ejecuciones(id) ON DELETE SET NULL,
  n8n_execution_id TEXT,

  tipo_senal         TEXT,
  descripcion_senal  TEXT,
  fecha_senal        DATE,

  -- 5 criterios del score radar (puntos, no porcentaje)
  criterio_fuente        NUMERIC(5,2),
  criterio_capex         NUMERIC(5,2),
  criterio_horizonte     NUMERIC(5,2),
  criterio_monto         NUMERIC(5,2),
  criterio_multi_fuentes NUMERIC(5,2),

  score_radar         NUMERIC(5,2) NOT NULL,
  composite_score     NUMERIC(5,2),
  tier_compuesto      matec_radar.tier_enum,
  ventana_compra      matec_radar.ventana_compra_enum NOT NULL DEFAULT 'desconocida',
  prioridad_comercial matec_radar.prioridad_enum,
  radar_activo        BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_descarte     TEXT,

  razonamiento_agente TEXT,
  prompt_version      TEXT,
  modelo_llm          TEXT,
  tokens_input        INTEGER,
  tokens_output       INTEGER,
  tavily_queries      INTEGER,
  costo_usd           NUMERIC(10,6),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX radar_empresa_created_idx  ON matec_radar.radar_scans (empresa_id, created_at DESC);
CREATE INDEX radar_score_desc_idx       ON matec_radar.radar_scans (score_radar DESC);
CREATE INDEX radar_composite_desc_idx   ON matec_radar.radar_scans (composite_score DESC NULLS LAST);
CREATE INDEX radar_activo_ventana_idx   ON matec_radar.radar_scans (radar_activo, ventana_compra);

-- 5.4 Fuentes Tavily (satélite de radar_scans)
CREATE TABLE matec_radar.radar_fuentes (
  id            BIGSERIAL PRIMARY KEY,
  radar_scan_id BIGINT NOT NULL REFERENCES matec_radar.radar_scans(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  titulo        TEXT,
  snippet       TEXT,
  dominio       TEXT,
  publicado_en  DATE,
  tavily_score  NUMERIC(5,4),
  es_oficial    BOOLEAN DEFAULT FALSE,
  es_premium    BOOLEAN DEFAULT FALSE,  -- bnamericas, ijglobal, secop, etc.
  validado      BOOLEAN DEFAULT FALSE,
  motivo_validacion TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX radar_fuentes_scan_idx    ON matec_radar.radar_fuentes (radar_scan_id);
CREATE INDEX radar_fuentes_dominio_idx ON matec_radar.radar_fuentes (dominio);

-- 5.5 Prospecciones (WF03 output)
CREATE TABLE matec_radar.prospecciones (
  id                    BIGSERIAL PRIMARY KEY,
  empresa_id            BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  ejecucion_id          BIGINT REFERENCES matec_radar.ejecuciones(id) ON DELETE SET NULL,
  n8n_execution_id      TEXT,
  sub_linea_id          SMALLINT REFERENCES matec_radar.sub_lineas_negocio(id),

  estado                matec_radar.estado_prospeccion_enum NOT NULL DEFAULT 'pendiente',
  apollo_search_body    JSONB,
  apollo_search_url     TEXT,
  job_titles_usados     TEXT[],
  paises_buscados       TEXT[],
  max_contacts          SMALLINT,
  contactos_encontrados SMALLINT NOT NULL DEFAULT 0,
  motivo_sin_contactos  TEXT,

  tokens_input          INTEGER,
  tokens_output         INTEGER,
  apollo_credits_usados SMALLINT,
  costo_usd             NUMERIC(10,6),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX prosp_empresa_created_idx ON matec_radar.prospecciones (empresa_id, created_at DESC);
CREATE INDEX prosp_estado_idx          ON matec_radar.prospecciones (estado);

-- 5.6 Contactos (schema Apollo completo)
CREATE TABLE matec_radar.contactos (
  id             BIGSERIAL PRIMARY KEY,
  empresa_id     BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  prospeccion_id BIGINT REFERENCES matec_radar.prospecciones(id) ON DELETE SET NULL,

  first_name  TEXT,
  last_name   TEXT,
  full_name   TEXT GENERATED ALWAYS AS (
                trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
              ) STORED,
  title       TEXT,
  seniority   TEXT,         -- c_suite/vp/director/manager/contributor
  departamento TEXT,

  email             TEXT,
  email_status      TEXT,
  email_confidence  NUMERIC(3,2),
  phone_work_direct TEXT,
  phone_mobile      TEXT,
  corporate_phone   TEXT,
  linkedin_url      TEXT,

  city    TEXT,
  state   TEXT,
  country matec_radar.pais_iso_enum,

  apollo_id         TEXT UNIQUE,
  apollo_person_raw JSONB,
  hubspot_id        TEXT,
  hubspot_status    matec_radar.hubspot_status_enum NOT NULL DEFAULT 'pendiente',
  hubspot_synced_at TIMESTAMPTZ,

  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contactos_empresa_idx ON matec_radar.contactos (empresa_id);
CREATE INDEX contactos_email_idx   ON matec_radar.contactos (lower(email));
CREATE INDEX contactos_hubspot_idx ON matec_radar.contactos (hubspot_status);
CREATE UNIQUE INDEX contactos_email_empresa_uk
  ON matec_radar.contactos (empresa_id, lower(email))
  WHERE email IS NOT NULL;

CREATE TRIGGER trg_contactos_updated_at
  BEFORE UPDATE ON matec_radar.contactos
  FOR EACH ROW EXECUTE FUNCTION matec_radar.set_updated_at();

-- 5.7 Contactos sin encontrar
CREATE TABLE matec_radar.contactos_sin_encontrar (
  id                    BIGSERIAL PRIMARY KEY,
  empresa_id            BIGINT NOT NULL REFERENCES matec_radar.empresas(id) ON DELETE CASCADE,
  prospeccion_id        BIGINT REFERENCES matec_radar.prospecciones(id) ON DELETE CASCADE,
  motivo                TEXT NOT NULL,
  job_titles_intentados TEXT[],
  paises_intentados     TEXT[],
  re_escanear           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX csi_empresa_idx ON matec_radar.contactos_sin_encontrar (empresa_id);

-- ---------------------------------------------------------------------------
-- 6. Triggers de cache (mantenimiento automático de campos calculados)
-- ---------------------------------------------------------------------------

-- 6.1 Actualizar cache empresa tras calificación
CREATE OR REPLACE FUNCTION matec_radar.fn_sync_empresa_tras_calificacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE matec_radar.empresas
     SET tier_actual            = NEW.tier_calculado,
         score_total_ultimo     = NEW.score_total,
         ultima_calificacion_id = NEW.id,
         ultima_calificacion_at = NEW.created_at,
         updated_at             = NOW()
   WHERE id = NEW.empresa_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_calif_sync
  AFTER INSERT ON matec_radar.calificaciones
  FOR EACH ROW EXECUTE FUNCTION matec_radar.fn_sync_empresa_tras_calificacion();

-- 6.2 Actualizar cache empresa tras radar scan
CREATE OR REPLACE FUNCTION matec_radar.fn_sync_empresa_tras_radar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE matec_radar.empresas
     SET score_radar_ultimo     = NEW.score_radar,
         composite_score_ultimo = NEW.composite_score,
         ultimo_radar_scan_id   = NEW.id,
         ultimo_scan_at         = NEW.created_at,
         radar_activo           = CASE
                                    WHEN NEW.radar_activo
                                      THEN 'activo'::matec_radar.radar_activo_enum
                                    ELSE radar_activo
                                  END,
         updated_at             = NOW()
   WHERE id = NEW.empresa_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_radar_sync
  AFTER INSERT ON matec_radar.radar_scans
  FOR EACH ROW EXECUTE FUNCTION matec_radar.fn_sync_empresa_tras_radar();

-- 6.3 Garantizar única sub-línea principal por empresa
CREATE OR REPLACE FUNCTION matec_radar.fn_enforce_unique_principal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.es_principal THEN
    -- Quitar es_principal de las otras sub-líneas de esta empresa
    UPDATE matec_radar.empresa_sub_lineas
       SET es_principal = FALSE
     WHERE empresa_id = NEW.empresa_id
       AND sub_linea_id <> NEW.sub_linea_id;
    -- Actualizar el campo denormalizado en empresas
    UPDATE matec_radar.empresas
       SET sub_linea_principal_id = NEW.sub_linea_id
     WHERE id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_esl_principal
  AFTER INSERT OR UPDATE ON matec_radar.empresa_sub_lineas
  FOR EACH ROW EXECUTE FUNCTION matec_radar.fn_enforce_unique_principal();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE matec_radar.lineas_negocio            ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.sub_lineas_negocio        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.sectores                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.job_titles_por_linea      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.palabras_clave_por_linea  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.configuracion_scoring     ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.empresas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.empresa_sub_lineas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.empresa_terminales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.ejecuciones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.calificaciones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.radar_scans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.radar_fuentes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.prospecciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.contactos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.contactos_sin_encontrar   ENABLE ROW LEVEL SECURITY;

-- service_role: acceso total (N8N + scripts de admin)
CREATE POLICY p_lineas_service          ON matec_radar.lineas_negocio           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_sub_lineas_service      ON matec_radar.sub_lineas_negocio       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_sectores_service        ON matec_radar.sectores                 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_jt_service             ON matec_radar.job_titles_por_linea     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_pc_service             ON matec_radar.palabras_clave_por_linea FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_scoring_service        ON matec_radar.configuracion_scoring     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_empresas_service       ON matec_radar.empresas                  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_esl_service            ON matec_radar.empresa_sub_lineas        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_terminales_service     ON matec_radar.empresa_terminales        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_ejec_service           ON matec_radar.ejecuciones               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_calif_service          ON matec_radar.calificaciones            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_radar_service          ON matec_radar.radar_scans               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_fuentes_service        ON matec_radar.radar_fuentes             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_prosp_service          ON matec_radar.prospecciones             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_contactos_service      ON matec_radar.contactos                 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY p_csi_service            ON matec_radar.contactos_sin_encontrar   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated: lectura de catálogos (escritura solo via service_role / API admin)
CREATE POLICY p_lineas_auth_read       ON matec_radar.lineas_negocio           FOR SELECT TO authenticated USING (true);
CREATE POLICY p_sub_lineas_auth_read   ON matec_radar.sub_lineas_negocio       FOR SELECT TO authenticated USING (true);
CREATE POLICY p_sectores_auth_read     ON matec_radar.sectores                 FOR SELECT TO authenticated USING (true);
CREATE POLICY p_jt_auth_read           ON matec_radar.job_titles_por_linea     FOR SELECT TO authenticated USING (true);
CREATE POLICY p_pc_auth_read           ON matec_radar.palabras_clave_por_linea FOR SELECT TO authenticated USING (true);
CREATE POLICY p_scoring_auth_read      ON matec_radar.configuracion_scoring     FOR SELECT TO authenticated USING (true);

-- authenticated: CRUD sobre empresas propias + compartidas (owner_id IS NULL)
CREATE POLICY p_empresas_auth ON matec_radar.empresas
  FOR ALL TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid())
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

-- authenticated: lectura de empresa_sub_lineas / terminales según acceso a empresa
CREATE POLICY p_esl_auth_read ON matec_radar.empresa_sub_lineas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = empresa_sub_lineas.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_terminales_auth_read ON matec_radar.empresa_terminales
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = empresa_terminales.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

-- authenticated: lectura de historiales según acceso a empresa
CREATE POLICY p_ejec_auth_read ON matec_radar.ejecuciones
  FOR SELECT TO authenticated USING (true);  -- ejecuciones son globales (no por owner)

CREATE POLICY p_calif_auth_read ON matec_radar.calificaciones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = calificaciones.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_radar_auth_read ON matec_radar.radar_scans
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = radar_scans.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_fuentes_auth_read ON matec_radar.radar_fuentes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.radar_scans rs
    JOIN matec_radar.empresas e ON e.id = rs.empresa_id
    WHERE rs.id = radar_fuentes.radar_scan_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_prosp_auth_read ON matec_radar.prospecciones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = prospecciones.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_contactos_auth ON matec_radar.contactos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = contactos.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = contactos.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

CREATE POLICY p_csi_auth_read ON matec_radar.contactos_sin_encontrar
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matec_radar.empresas e
    WHERE e.id = contactos_sin_encontrar.empresa_id
      AND (e.owner_id IS NULL OR e.owner_id = auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 8. Grants explícitos al rol anon (para que PostgREST funcione con RLS)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA matec_radar TO authenticated, service_role;

GRANT SELECT ON matec_radar.lineas_negocio            TO authenticated;
GRANT SELECT ON matec_radar.sub_lineas_negocio        TO authenticated;
GRANT SELECT ON matec_radar.sectores                  TO authenticated;
GRANT SELECT ON matec_radar.job_titles_por_linea      TO authenticated;
GRANT SELECT ON matec_radar.palabras_clave_por_linea  TO authenticated;
GRANT SELECT ON matec_radar.configuracion_scoring     TO authenticated;
GRANT ALL    ON matec_radar.empresas                  TO authenticated;
GRANT SELECT ON matec_radar.empresa_sub_lineas        TO authenticated;
GRANT SELECT ON matec_radar.empresa_terminales        TO authenticated;
GRANT SELECT ON matec_radar.ejecuciones               TO authenticated;
GRANT SELECT ON matec_radar.calificaciones            TO authenticated;
GRANT SELECT ON matec_radar.radar_scans               TO authenticated;
GRANT SELECT ON matec_radar.radar_fuentes             TO authenticated;
GRANT SELECT ON matec_radar.prospecciones             TO authenticated;
GRANT ALL    ON matec_radar.contactos                 TO authenticated;
GRANT SELECT ON matec_radar.contactos_sin_encontrar   TO authenticated;

GRANT ALL ON ALL TABLES    IN SCHEMA matec_radar TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA matec_radar TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA matec_radar TO authenticated;
