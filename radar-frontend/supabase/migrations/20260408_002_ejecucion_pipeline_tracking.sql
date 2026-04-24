-- Sprint 1 of the agent tracker — pipeline correlation fields on `ejecuciones`.
-- Mirror of the Prisma migration `20260408144551_ejecucion_pipeline_tracking`.
-- Idempotent: every column / index uses IF NOT EXISTS.

ALTER TABLE public.ejecuciones
  ADD COLUMN IF NOT EXISTS agent_type          text NOT NULL DEFAULT 'calificador',
  ADD COLUMN IF NOT EXISTS pipeline_id         text,
  ADD COLUMN IF NOT EXISTS parent_execution_id integer,
  ADD COLUMN IF NOT EXISTS current_step        text;

-- Self-FK so we can walk the cascade tree (WF01 → WF02 → WF03).
-- ON DELETE SET NULL keeps child rows alive if a root row is deleted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ejecuciones_parent_execution_id_fkey'
  ) THEN
    ALTER TABLE public.ejecuciones
      ADD CONSTRAINT ejecuciones_parent_execution_id_fkey
      FOREIGN KEY (parent_execution_id) REFERENCES public.ejecuciones(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ejecuciones_pipeline_id_idx ON public.ejecuciones(pipeline_id);
CREATE INDEX IF NOT EXISTS ejecuciones_agent_type_idx  ON public.ejecuciones(agent_type);
