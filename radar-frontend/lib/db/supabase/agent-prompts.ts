// lib/db/supabase/agent-prompts.ts
// Queries for agent_prompts — admin-editable AI system prompts per provider
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import { fechaHoyES } from '@/lib/utils/parseFechaRadar';

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
 * Runtime variable substitution for prompts stored in agent_prompts.
 *
 * Supported placeholders (extend here, never hardcode in DB rows):
 *   {{FECHA_HOY}}  — DD/MM/AAAA en es-ES (today)
 *   {{SECCION_0}}  — bloque de contexto inyectado por el caller (modo, línea, países, fuentes, keywords)
 *   {{LINEA}}      — línea de negocio
 *   {{PAISES}}     — lista de países separada por coma
 *   {{KEYWORDS}}   — lista de keywords separada por coma
 */
export interface PromptVariables {
  seccion0?: string;
  linea?: string;
  paises?: string[];
  keywords?: string[];
  /** Override fecha_hoy if needed (testing). Defaults to today in es-ES. */
  fechaHoy?: string;
}

export function applyPromptVariables(
  template: string,
  vars: PromptVariables = {},
): string {
  const fecha = vars.fechaHoy ?? fechaHoyES();
  const paises = (vars.paises ?? []).join(', ');
  const keywords = (vars.keywords ?? []).join(', ');

  return template
    .replaceAll('{{FECHA_HOY}}', fecha)
    .replaceAll('{{SECCION_0}}', vars.seccion0 ?? '')
    .replaceAll('{{LINEA}}', vars.linea ?? '')
    .replaceAll('{{PAISES}}', paises)
    .replaceAll('{{KEYWORDS}}', keywords);
}

/**
 * Convenience: load prompt from DB and apply variables in one call.
 * Returns null if no DB row exists (caller should use hardcoded fallback).
 */
export async function getAgentPromptWithVars(
  provider: string,
  vars: PromptVariables = {},
): Promise<string | null> {
  const template = await getAgentPrompt(provider);
  if (!template) return null;
  return applyPromptVariables(template, vars);
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
