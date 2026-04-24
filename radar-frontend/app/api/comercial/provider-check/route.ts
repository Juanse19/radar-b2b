/**
 * GET /api/comercial/provider-check?provider=openai|claude|gemini
 *
 * Diagnostic endpoint: resolves the configured API key for the given provider
 * and makes a lightweight "ping" call to verify it actually works.
 * Returns the provider name, masked key (last 4 chars), and test result.
 *
 * NEVER returns the full API key — only last 4 chars for identification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

function maskKey(key: string | undefined): string {
  if (!key) return '(no configurada)';
  if (key.length <= 4) return '••••••••';
  return `••••••••${key.slice(-4)}`;
}

function toDbName(provider: string): string {
  if (provider === 'claude')  return 'anthropic';
  if (provider === 'gemini')  return 'google';
  return provider;
}

async function resolveKey(provider: string): Promise<{ key: string | undefined; model: string | undefined; source: string }> {
  const dbName = toDbName(provider);
  try {
    const row = await pgFirst<{ api_key_enc: string; model: string }>(
      `SELECT api_key_enc, model FROM ${S}.ai_provider_configs
        WHERE provider = ${pgLit(dbName)} AND is_active = TRUE LIMIT 1`,
    );
    if (row?.api_key_enc?.trim()) {
      return { key: row.api_key_enc.trim(), model: row.model, source: 'database' };
    }
  } catch { /* fallback to env */ }

  // Env var fallback
  const envKey =
    provider === 'claude'  ? process.env.CLAUDE_API_KEY :
    provider === 'openai'  ? process.env.OPENAI_API_KEY :
    provider === 'gemini'  ? process.env.GOOGLE_API_KEY :
    undefined;
  return { key: envKey, model: undefined, source: 'env_var' };
}

async function pingOpenAI(apiKey: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pingClaude(apiKey: string, model?: string): Promise<{ ok: boolean; status: number; error?: string }> {
  // Use the configured model (e.g. claude-sonnet-4-6) falling back to a known-good one
  const pingModel = model ?? 'claude-3-5-sonnet-20241022';
  try {
    // Claude: a minimal messages call with 1 token to verify the key + credits
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      pingModel,
        max_tokens: 1,
        messages:   [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 200) };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pingGemini(apiKey: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pingProvider(
  provider: string,
  apiKey: string,
  model?: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (provider === 'openai')  return pingOpenAI(apiKey);
  if (provider === 'claude')  return pingClaude(apiKey, model);
  if (provider === 'gemini')  return pingGemini(apiKey);
  return { ok: false, status: 0, error: `Unknown provider: ${provider}` };
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = req.nextUrl.searchParams.get('provider')?.toLowerCase() ?? 'openai';

  if (!['openai', 'claude', 'gemini'].includes(provider)) {
    return NextResponse.json({ error: 'provider must be openai | claude | gemini' }, { status: 400 });
  }

  const { key, model, source } = await resolveKey(provider);

  if (!key) {
    return NextResponse.json({
      provider,
      key_masked: '(no configurada)',
      key_source: source,
      model:      null,
      ping:       { ok: false, status: 0, error: 'No API key found in DB or env vars' },
    });
  }

  const ping = await pingProvider(provider, key, model ?? undefined);

  return NextResponse.json({
    provider,
    key_masked: maskKey(key),
    key_source: source,
    model:      model ?? null,
    ping,
    diagnosis: ping.ok
      ? '✅ Key válida y funcional'
      : ping.status === 429
        ? `❌ 429 — cuota agotada en la cuenta de ${provider}. La key ES válida pero la cuenta no tiene saldo.`
        : ping.status === 401
          ? '❌ 401 — key inválida o revocada'
          : `❌ Error ${ping.status}: ${ping.error?.slice(0, 100)}`,
  });
}
