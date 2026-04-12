-- Sprint 3.7 — Fix ejecuciones schema para alinear con el código de la app.
--
-- CONTEXTO:
--   La tabla matec_radar.ejecuciones fue creada por el script legacy (pre-RESTORE_ALL)
--   con un schema diferente al que espera registrarEjecucion() en lib/db/supabase/ejecuciones.ts.
--   Los cambios en 20260408_002_ejecucion_pipeline_tracking.sql aplican sobre public.ejecuciones,
--   pero en esta instancia la tabla está en matec_radar.ejecuciones.
--
-- PROBLEMAS RESUELTOS:
--   1. workflow NOT NULL → insertions fallaban porque registrarEjecucion() no envía ese campo
--   2. Faltan columnas agent_type, pipeline_id, parent_execution_id, current_step, linea_negocio
--
-- SEGURO: Todas las sentencias usan IF NOT EXISTS / DROP NOT NULL es idempotente.

-- ── 1. Columnas de tracking del pipeline (duplica 002 para el schema matec_radar) ──

ALTER TABLE matec_radar.ejecuciones
  ADD COLUMN IF NOT EXISTS agent_type          text NOT NULL DEFAULT 'calificador',
  ADD COLUMN IF NOT EXISTS pipeline_id         text,
  ADD COLUMN IF NOT EXISTS parent_execution_id integer,
  ADD COLUMN IF NOT EXISTS current_step        text,
  ADD COLUMN IF NOT EXISTS linea_negocio       text;

-- ── 2. Hacer workflow nullable (campo legacy — no usado por el nuevo código) ──────

ALTER TABLE matec_radar.ejecuciones
  ALTER COLUMN workflow DROP NOT NULL;

ALTER TABLE matec_radar.ejecuciones
  ALTER COLUMN workflow SET DEFAULT 'manual';

-- ── 3. Self-FK para cascade tree (WF01 → WF02 → WF03) ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matec_radar_ejecuciones_parent_fkey'
  ) THEN
    ALTER TABLE matec_radar.ejecuciones
      ADD CONSTRAINT matec_radar_ejecuciones_parent_fkey
      FOREIGN KEY (parent_execution_id) REFERENCES matec_radar.ejecuciones(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── 4. Índices para el polling del tracker ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS matec_radar_ejecuciones_pipeline_id_idx
  ON matec_radar.ejecuciones(pipeline_id);

CREATE INDEX IF NOT EXISTS matec_radar_ejecuciones_agent_type_idx
  ON matec_radar.ejecuciones(agent_type);

CREATE INDEX IF NOT EXISTS matec_radar_ejecuciones_linea_negocio_idx
  ON matec_radar.ejecuciones(linea_negocio);

-- ── 5. Notificar a PostgREST que recargue el schema cache ────────────────────────

NOTIFY pgrst, 'reload schema';
