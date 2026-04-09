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

-- Drop any leftover functions from the old schema
DROP FUNCTION IF EXISTS matec_radar.set_updated_at() CASCADE;
