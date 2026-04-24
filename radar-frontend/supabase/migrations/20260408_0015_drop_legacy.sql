-- =============================================================================
-- Migration: 20260408_0015_drop_legacy.sql
-- Purpose:   Drop all legacy Prisma-replica tables in matec_radar schema.
--            These tables are empty — the real data lives in Excel files.
--            This clears the path for the full E-R model in 20260408_002.
-- =============================================================================

-- Drop tables in dependency order (children first, then parents)
DROP TABLE IF EXISTS matec_radar.prospeccion_logs   CASCADE;
DROP TABLE IF EXISTS matec_radar.senales            CASCADE;
DROP TABLE IF EXISTS matec_radar.contactos          CASCADE;
DROP TABLE IF EXISTS matec_radar.ejecuciones        CASCADE;
DROP TABLE IF EXISTS matec_radar.empresas           CASCADE;

-- Drop any leftover legacy types if they exist
DROP TYPE IF EXISTS matec_radar.tier_enum           CASCADE;
DROP TYPE IF EXISTS matec_radar.pipeline_enum       CASCADE;
DROP TYPE IF EXISTS matec_radar.estado_ejecucion_enum CASCADE;

-- Drop the public-schema duplicate tables from 20260408_001 (if applied)
DROP TABLE IF EXISTS public.prospeccion_logs   CASCADE;
DROP TABLE IF EXISTS public.senales            CASCADE;
DROP TABLE IF EXISTS public.contactos          CASCADE;
DROP TABLE IF EXISTS public.ejecuciones        CASCADE;
DROP TABLE IF EXISTS public.empresas           CASCADE;

-- Drop partial tables from prior incomplete migrations (matec_radar schema)
DROP TABLE IF EXISTS matec_radar.actividad             CASCADE;
DROP TABLE IF EXISTS matec_radar.configuracion         CASCADE;
DROP TABLE IF EXISTS matec_radar.fuentes               CASCADE;
DROP TABLE IF EXISTS matec_radar.lineas_negocio        CASCADE;
DROP TABLE IF EXISTS matec_radar.usuarios              CASCADE;

-- Drop any types that may have been created in earlier partial runs
DROP TYPE IF EXISTS matec_radar.prioridad_enum        CASCADE;
DROP TYPE IF EXISTS matec_radar.ventana_compra_enum   CASCADE;
DROP TYPE IF EXISTS matec_radar.impacto_enum          CASCADE;
DROP TYPE IF EXISTS matec_radar.recurrencia_enum      CASCADE;
DROP TYPE IF EXISTS matec_radar.multiplanta_enum      CASCADE;
DROP TYPE IF EXISTS matec_radar.referente_enum        CASCADE;
DROP TYPE IF EXISTS matec_radar.pipeline_enum         CASCADE;
DROP TYPE IF EXISTS matec_radar.radar_activo_enum     CASCADE;
DROP TYPE IF EXISTS matec_radar.pais_iso_enum         CASCADE;
DROP TYPE IF EXISTS matec_radar.estado_ejecucion_enum CASCADE;
DROP TYPE IF EXISTS matec_radar.estado_prospeccion_enum CASCADE;
DROP TYPE IF EXISTS matec_radar.hubspot_status_enum   CASCADE;
DROP TYPE IF EXISTS matec_radar.workflow_enum         CASCADE;
DROP TYPE IF EXISTS matec_radar.meta_schema_version_enum CASCADE;

-- Drop any leftover functions from the old schema
DROP FUNCTION IF EXISTS matec_radar.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS matec_radar.f_unaccent(text) CASCADE;
