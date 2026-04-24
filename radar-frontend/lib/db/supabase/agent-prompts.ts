// lib/db/supabase/agent-prompts.ts
// Queries for agent_prompts — admin-editable AI system prompts per provider
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';

const S = SCHEMA;

export type AgentProvider = 'claude' | 'openai' | 'gemini';

export interface AgentPromptRow {
  id:            number;
  provider:      AgentProvider;
  system_prompt: string;
  updated_at:    string;
  updated_by:    string | null;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the overridden system_prompt for a provider, or null if no DB record
 * exists. Callers should fall back to the hardcoded default when null is returned.
 */
export async function getAgentPrompt(provider: string): Promise<string | null> {
  const row = await pgFirst<Pick<AgentPromptRow, 'system_prompt'>>(`
    SELECT system_prompt
    FROM ${S}.agent_prompts
    WHERE provider = ${pgLit(provider)}
    LIMIT 1
  `);
  return row ? row.system_prompt : null;
}

/**
 * INSERT or UPDATE the system_prompt for a provider.
 * If a row already exists for that provider, its system_prompt, updated_at,
 * and updated_by are replaced.
 */
export async function upsertAgentPrompt(
  provider: string,
  systemPrompt: string,
  updatedBy?: string,
): Promise<void> {
  await pgQuery(`
    INSERT INTO ${S}.agent_prompts (provider, system_prompt, updated_at, updated_by)
    VALUES (
      ${pgLit(provider)},
      ${pgLit(systemPrompt)},
      NOW(),
      ${pgLit(updatedBy ?? null)}
    )
    ON CONFLICT (provider) DO UPDATE
      SET system_prompt = EXCLUDED.system_prompt,
          updated_at    = EXCLUDED.updated_at,
          updated_by    = EXCLUDED.updated_by
  `);
}
