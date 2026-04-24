/**
 * scanner.ts — Direct Claude API call for Agente 1 RADAR.
 * Used by the Next.js API route in dev (bypasses Supabase Edge Function).
 * server-only: never import this from client components.
 */
import 'server-only';
import { type Agente1Result } from '@/lib/comercial/schema';
import { getProvider } from './providers';
import type { SSEEmitter } from './providers/types';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScanResult {
  result:        Agente1Result;
  tokens_input:  number;
  tokens_output: number;
  cost_usd:      number;
}

// ---------------------------------------------------------------------------
// DB helpers — resolve API key, model, and budget from ai_provider_configs
// ---------------------------------------------------------------------------

/**
 * Maps the provider name used in code (claude|openai|gemini) to the value
 * stored in the `provider` column of ai_provider_configs.
 */
function toDbProviderName(providerName: string): string {
  if (providerName === 'claude')  return 'anthropic';
  if (providerName === 'gemini')  return 'google';
  return providerName; // 'openai' stays as 'openai'
}

interface ProviderConfig {
  apiKey: string | undefined;
  model:  string | undefined;
  budget: number | null;
}

/**
 * Looks up the active ai_provider_configs row for the given provider.
 * Returns undefined values when the table doesn't exist or has no active row —
 * callers fall back to environment variables in that case.
 */
async function resolveProviderConfig(
  providerName: string,
  overrideKey?:   string,
  overrideModel?: string,
): Promise<ProviderConfig> {
  // If both overrides are supplied, skip the DB entirely.
  if (overrideKey && overrideModel) {
    return { apiKey: overrideKey, model: overrideModel, budget: null };
  }

  const dbName = toDbProviderName(providerName);
  try {
    const row = await pgFirst<{ api_key_enc: string; model: string; monthly_budget_usd: string | null }>(
      `SELECT api_key_enc, model, monthly_budget_usd
         FROM ${SCHEMA}.ai_provider_configs
        WHERE provider = ${pgLit(dbName)} AND is_active = TRUE
        LIMIT 1`,
    );
    const apiKey = overrideKey  ?? (row?.api_key_enc?.trim() || undefined);
    const model  = overrideModel ?? (row?.model?.trim()      || undefined);
    const budget = row?.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : null;
    return { apiKey, model, budget };
  } catch {
    // Table may not exist yet or Supabase is unreachable.
    // Fall back to environment variables so scans still work.
    const normalizedName = toDbProviderName(providerName);
    const envKey =
      normalizedName === 'anthropic' ? process.env.CLAUDE_API_KEY :
      normalizedName === 'openai'    ? process.env.OPENAI_API_KEY :
      normalizedName === 'google'    ? process.env.GOOGLE_API_KEY :
      undefined;
    return { apiKey: overrideKey ?? envKey, model: overrideModel, budget: null };
  }
}

/**
 * Returns the monthly_budget_usd for the given provider, or null if unknown.
 * Used by the stream route for budget_warning events.
 */
export async function getActiveBudget(providerName: string): Promise<number | null> {
  const { budget } = await resolveProviderConfig(providerName);
  return budget;
}

// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Provider name (claude|openai|gemini). Defaults to RADAR_V2_DEFAULT_PROVIDER env, then 'claude'. */
  providerName?: string;
  /** Optional SSE emitter for live streaming (Fase G). */
  emit?:         SSEEmitter;
  /** Session id for RAG + token event linkage. */
  sessionId?:    string;
  /** API key override — from ai_provider_configs DB, takes precedence over env var. */
  apiKey?:       string;
  /** Model override — from ai_provider_configs DB, takes precedence over provider default. */
  model?:        string;
}

/**
 * v3 entry point — delegates to a provider while keeping RAG orthogonal.
 * Used by the wizard, SSE endpoint, and all new callers.
 */
export async function scanCompany(
  company: { id?: number; name: string; country: string },
  line: string,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const providerName = opts.providerName ?? process.env.RADAR_V2_DEFAULT_PROVIDER ?? 'claude';
  const provider = getProvider(providerName);

  // Resolve API key and model from DB, falling back to env vars inside each provider.
  const { apiKey, model } = await resolveProviderConfig(
    providerName,
    opts.apiKey,
    opts.model,
  );

  let scan: import('./providers/types').ScanResult;
  try {
    scan = await provider.scan(
      {
        company,
        line,
        sessionId: opts.sessionId,
        empresaId: company.id ?? null,
        apiKey,
        model,
      },
      opts.emit,
    );
  } catch (primaryErr) {
    const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

    // Detect quota / credit exhaustion errors (distinct from rate limits).
    const isQuotaExhausted =
      errMsg.includes('insufficient_quota') ||
      errMsg.includes('credit balance is too low') ||
      errMsg.includes('exceeded your current quota') ||
      (errMsg.includes('429') && errMsg.includes('quota'));

    const isRateLimit =
      errMsg.includes('rate_limit_exceeded') ||
      (errMsg.includes('429') && !isQuotaExhausted);

    if (isQuotaExhausted || isRateLimit) {
      // Surface the error clearly — do NOT auto-fallback to another provider.
      // Rationale: the user chose this provider explicitly. Silently switching
      // to a fallback provider (which may also have no credits) produces two
      // confusing errors instead of one actionable message.
      const label = providerName === 'openai'  ? 'OpenAI'
                  : providerName === 'claude'  ? 'Claude (Anthropic)'
                  : providerName === 'gemini'  ? 'Gemini (Google)'
                  : providerName;

      const hint = isQuotaExhausted
        ? `${label}: cuota agotada. Verifica que tu API key en Admin → Configuración de API sea válida y que tu cuenta tenga saldo.`
        : `${label}: límite de tasa alcanzado (429). Intenta de nuevo en unos minutos.`;

      throw new Error(`${hint}\nDetalle: ${errMsg.slice(0, 300)}`);
    }

    throw primaryErr;
  }

  // RAG upsert — non-fatal, orthogonal to provider.
  try {
    const { upsertSenal } = await import('./rag');
    await upsertSenal(scan.result, opts.sessionId ?? '');
  } catch (upsertErr) {
    console.warn('[RAG] upsertSenal falló — no crítico:', upsertErr instanceof Error ? upsertErr.message : upsertErr);
  }

  return {
    result:        scan.result,
    tokens_input:  scan.tokens_input,
    tokens_output: scan.tokens_output,
    cost_usd:      scan.cost_usd,
  };
}
