/**
 * lib/radar/claudeWebSearchClient.ts — Reusable multi-turn web_search caller
 * for arbitrary system+user prompts. Extracted from providers/claude.ts so
 * the Modo Señales route can run the same agentic loop without anchoring on
 * a single empresa.
 */
import 'server-only';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

/**
 * Resuelve la API key de Anthropic. Prioridad:
 *   1. Override explícito en input.apiKey
 *   2. process.env.CLAUDE_API_KEY (dev local)
 *   3. ai_provider_configs.api_key_enc WHERE provider='anthropic' AND is_active=TRUE (prod)
 */
async function resolveAnthropicKey(override?: string): Promise<string | undefined> {
  if (override) return override;
  const env = process.env.CLAUDE_API_KEY?.trim();
  if (env) return env;
  try {
    const row = await pgFirst<{ api_key_enc: string }>(
      `SELECT api_key_enc FROM ${SCHEMA}.ai_provider_configs
       WHERE provider = ${pgLit('anthropic')} AND is_active = TRUE LIMIT 1`,
    );
    return row?.api_key_enc?.trim() || undefined;
  } catch {
    return undefined;
  }
}

const CLAUDE_DEFAULT_MODEL  = 'claude-sonnet-4-6';
const PRICE_INPUT_PER_M  = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

export interface RunResult {
  text:           string;
  tokens_input:   number;
  tokens_output:  number;
  cached_tokens:  number;
  search_calls:   number;
  cost_usd:       number;
  model:          string;
}

export interface RunInput {
  system:    string;
  user:      string;
  apiKey?:   string;
  model?:    string;
  maxTurns?: number;
  maxTokens?: number;
}

interface ContentBlock {
  type:    string;
  text?:   string;
  id?:     string;
  name?:   string;
  input?:  { query?: string };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status !== 429 || attempt === maxRetries) return resp;
    const retryAfterSec = Number(resp.headers.get('retry-after') ?? '60');
    await new Promise((r) => setTimeout(r, Math.min(retryAfterSec * 1000, 120_000)));
  }
  return fetch(url, options);
}

/**
 * Runs the multi-turn web_search loop against Claude with arbitrary system/user
 * prompts and returns the final text + token usage.
 */
export async function runClaudeWebSearch(input: RunInput): Promise<RunResult> {
  const apiKey = await resolveAnthropicKey(input.apiKey);
  if (!apiKey) throw new Error('Anthropic API key not configured (env CLAUDE_API_KEY or ai_provider_configs)');

  const model = input.model ?? CLAUDE_DEFAULT_MODEL;
  const maxTurns = input.maxTurns ?? 10;

  const baseBody = {
    model,
    max_tokens: input.maxTokens ?? 4096,
    system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }],
    tools:  [{ type: 'web_search_20250305', name: 'web_search' }],
  };

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: input.user },
  ];

  let lastData: {
    content:     ContentBlock[];
    stop_reason: string;
    usage?:      { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  } = { content: [], stop_reason: '' };

  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let searchCalls = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'web-search-2025-03-05,prompt-caching-2024-07-31',
        'content-type':      'application/json',
      },
      body: JSON.stringify({ ...baseBody, messages }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 300)}`);
    }

    lastData = (await resp.json()) as typeof lastData;
    totalInput  += lastData.usage?.input_tokens  ?? 0;
    totalOutput += lastData.usage?.output_tokens ?? 0;
    totalCached += lastData.usage?.cache_read_input_tokens ?? 0;

    if (lastData.stop_reason === 'end_turn') break;

    if (lastData.stop_reason === 'tool_use') {
      for (const block of lastData.content) {
        if ((block.type === 'server_tool_use' || block.type === 'tool_use') && block.name === 'web_search') {
          searchCalls += 1;
        }
      }
      messages.push({ role: 'assistant', content: lastData.content });
      const toolResults = lastData.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: [] }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  const textBlocks = (lastData.content ?? []).filter((b) => b.type === 'text');
  const text = textBlocks[textBlocks.length - 1]?.text ?? '';
  if (!text) throw new Error('No text block in Claude response');

  const cost =
    (totalInput * PRICE_INPUT_PER_M) / 1_000_000 +
    (totalOutput * PRICE_OUTPUT_PER_M) / 1_000_000;

  return {
    text,
    tokens_input:  totalInput,
    tokens_output: totalOutput,
    cached_tokens: totalCached,
    search_calls:  searchCalls,
    cost_usd:      cost,
    model,
  };
}
