/**
 * db-migrations.ts — Ensures required tables exist on first use.
 * Called from API routes to handle cold-start scenarios where migrations
 * have not been applied to the live Supabase instance.
 */
import 'server-only';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';

const CREATE_AI_PROVIDER_CONFIGS = `
  CREATE TABLE IF NOT EXISTS ${SCHEMA}.ai_provider_configs (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider           TEXT        NOT NULL CHECK (provider IN ('anthropic','openai','google')),
    label              TEXT        NOT NULL,
    model              TEXT        NOT NULL,
    api_key_enc        TEXT        NOT NULL DEFAULT '',
    is_active          BOOLEAN     NOT NULL DEFAULT FALSE,
    is_default         BOOLEAN     NOT NULL DEFAULT FALSE,
    monthly_budget_usd NUMERIC(10,2),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'ai_provider_configs_provider_key'
        AND conrelid = '${SCHEMA}.ai_provider_configs'::regclass
    ) THEN
      ALTER TABLE ${SCHEMA}.ai_provider_configs
        ADD CONSTRAINT ai_provider_configs_provider_key UNIQUE (provider);
    END IF;
  END $$;
`;

const SEED_AI_PROVIDER_CONFIGS = `
  INSERT INTO ${SCHEMA}.ai_provider_configs
    (provider, label, model, api_key_enc, is_active, is_default)
  VALUES
    ('anthropic', 'Claude Sonnet 4.6', 'claude-sonnet-4-6', '', FALSE, TRUE),
    ('openai',    'GPT-4o',            'gpt-4o',            '', FALSE, FALSE),
    ('google',    'Gemini 2.0 Flash',  'gemini-2.0-flash',  '', FALSE, FALSE)
  ON CONFLICT (provider) DO NOTHING;
`;

// Module-level flag — avoids re-running DDL on every request in the same
// Node.js process. Resets on cold start (deploy / serverless restart).
let migrationRan = false;

export async function ensureAiProviderConfigsTable(): Promise<void> {
  if (migrationRan) return;
  try {
    await pgQuery(CREATE_AI_PROVIDER_CONFIGS);
    await pgQuery(SEED_AI_PROVIDER_CONFIGS);
    migrationRan = true;
  } catch (err) {
    console.error('[db-migrations] ensureAiProviderConfigsTable failed:', err);
    throw err;
  }
}

/** Returns true if the error is a "relation does not exist" (42P01) error. */
export function isTableMissingError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  return msg.includes('42P01') || msg.includes('does not exist');
}

// ---------------------------------------------------------------------------
// Radar V2 tables guard
// ---------------------------------------------------------------------------

let radarV2TablesRan = false;

/**
 * Idempotently creates all radar_v2_* tables and adds migration-102 columns.
 * Safe to call on every request — skips after first successful run in the
 * current Node.js process (module-level flag).
 */
export async function ensureRadarV2Tables(): Promise<void> {
  if (radarV2TablesRan) return;
  try {
    // Step 1: radar_v2_sessions base table
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.radar_v2_sessions (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
        linea_negocio    TEXT        NOT NULL,
        empresas_count   INT         NOT NULL DEFAULT 1,
        total_cost_usd   NUMERIC(10,4),
        created_at       TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Step 2: Add columns from migration 102 (idempotent)
    await pgQuery(`
      ALTER TABLE ${SCHEMA}.radar_v2_sessions
        ADD COLUMN IF NOT EXISTS duration_ms        INT  NULL,
        ADD COLUMN IF NOT EXISTS activas_count      INT  DEFAULT 0,
        ADD COLUMN IF NOT EXISTS descartadas_count  INT  DEFAULT 0;
    `);

    // Step 3: radar_v2_results base table
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.radar_v2_results (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id          UUID        REFERENCES ${SCHEMA}.radar_v2_sessions(id) ON DELETE CASCADE,
        empresa_evaluada    TEXT        NOT NULL,
        empresa_id          INT,
        linea_negocio       TEXT,
        provider            TEXT,
        model               TEXT,
        radar_activo        TEXT        CHECK (radar_activo IN ('Sí','No')),
        score_radar         INT,
        criterios_cumplidos INT,
        descripcion_resumen TEXT,
        fuentes             TEXT[],
        motivo_descarte     TEXT,
        raw_json            JSONB       NOT NULL DEFAULT '{}',
        tokens_input        INT,
        tokens_output       INT,
        cost_usd            NUMERIC(10,6),
        created_at          TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Step 4: Add fuente_verificada from migration 102 (idempotent)
    await pgQuery(`
      ALTER TABLE ${SCHEMA}.radar_v2_results
        ADD COLUMN IF NOT EXISTS fuente_verificada TEXT;
    `);

    // Step 5: radar_v2_reports for scan report snapshots
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.radar_v2_reports (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id   UUID        NOT NULL UNIQUE
                                 REFERENCES ${SCHEMA}.radar_v2_sessions(id) ON DELETE CASCADE,
        linea        TEXT,
        empresas     JSONB       DEFAULT '[]',
        summary      TEXT,
        generated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    radarV2TablesRan = true;
  } catch (err) {
    console.error('[db-migrations] ensureRadarV2Tables failed:', err);
    throw err;
  }
}
