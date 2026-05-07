/**
 * provider-config.ts — Shared API-key + model resolution.
 *
 * Reads the active row from `matec_radar.ai_provider_configs` (managed via
 * the admin UI). Falls back to environment variables when the table is
 * unreachable or empty so dev environments without DB still work.
 *
 * Used by:
 *   - lib/comercial/scanner.ts        (Radar V2)
 *   - lib/comercial/calificador/engine.ts (Calificador V2)
 */
import 'server-only';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

export interface ProviderConfig {
  apiKey: string | undefined;
  model:  string | undefined;
  budget: number | null;
}

/**
 * Maps the provider name used in code (claude|openai|gemini) to the value
 * stored in the `provider` column of ai_provider_configs.
 */
export function toDbProviderName(providerName: string): string {
  if (providerName === 'claude') return 'anthropic';
  if (providerName === 'gemini') return 'google';
  return providerName; // 'openai' stays as 'openai'
}

/**
 * Looks up the active ai_provider_configs row for the given provider.
 * Returns undefined values when the table doesn't exist or has no active row —
 * callers fall back to environment variables in that case.
 */
export async function resolveProviderConfig(
  providerName:   string,
  overrideKey?:   string,
  overrideModel?: string,
): Promise<ProviderConfig> {
  if (overrideKey && overrideModel) {
    return { apiKey: overrideKey, model: overrideModel, budget: null };
  }

  const dbName = toDbProviderName(providerName);
  try {
    const row = await pgFirst<{
      api_key_enc:        string;
      model:              string;
      monthly_budget_usd: string | null;
    }>(
      `SELECT api_key_enc, model, monthly_budget_usd
         FROM ${SCHEMA}.ai_provider_configs
        WHERE provider = ${pgLit(dbName)} AND is_active = TRUE
        LIMIT 1`,
    );
    const apiKey = overrideKey   ?? (row?.api_key_enc?.trim() || undefined);
    const model  = overrideModel ?? (row?.model?.trim()       || undefined);
    const budget = row?.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : null;
    return { apiKey, model, budget };
  } catch {
    const envKey =
      dbName === 'anthropic' ? process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY :
      dbName === 'openai'    ? process.env.OPENAI_API_KEY :
      dbName === 'google'    ? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY :
      undefined;
    return { apiKey: overrideKey ?? envKey, model: overrideModel, budget: null };
  }
}
