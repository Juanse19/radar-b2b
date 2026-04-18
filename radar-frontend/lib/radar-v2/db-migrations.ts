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
