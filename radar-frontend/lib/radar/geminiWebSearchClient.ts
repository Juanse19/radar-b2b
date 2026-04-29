/**
 * lib/radar/geminiWebSearchClient.ts — Gemini generateContent web search runner.
 * Mirrors the interface of runClaudeWebSearch so scan-signals can use any provider.
 */
import 'server-only';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { RunResult, RunInput } from './claudeWebSearchClient';

const DEFAULT_MODEL      = process.env.GOOGLE_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const PRICE_INPUT_PER_M  = 0.15;
const PRICE_OUTPUT_PER_M = 0.60;
const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';

async function resolveGeminiKey(override?: string): Promise<string | undefined> {
  if (override) return override;
  const env = (process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY)?.trim();
  if (env) return env;
  try {
    const row = await pgFirst<{ api_key_enc: string }>(
      `SELECT api_key_enc FROM ${SCHEMA}.ai_provider_configs
       WHERE provider = ${pgLit('google')} AND is_active = TRUE LIMIT 1`,
    );
    return row?.api_key_enc?.trim() || undefined;
  } catch {
    return undefined;
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: unknown[] };
  }>;
  usageMetadata?: {
    promptTokenCount?:     number;
    candidatesTokenCount?: number;
  };
};

export async function runGeminiWebSearch(input: RunInput): Promise<RunResult> {
  const apiKey = await resolveGeminiKey(input.apiKey);
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured — add it to .env.local or configure it in Admin → API Keys');

  const model = input.model ?? DEFAULT_MODEL;
  const url   = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: 'user', parts: [{ text: input.user }] }],
    generationConfig: {
      maxOutputTokens: input.maxTokens ?? 4096,
      temperature:     0.2,
    },
    tools: [{ googleSearch: {} }],
  };

  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('No content in Gemini response');

  const searchCalls = data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0;
  const tokensIn    = data.usageMetadata?.promptTokenCount     ?? 0;
  const tokensOut   = data.usageMetadata?.candidatesTokenCount ?? 0;
  const cost        = (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

  return {
    text,
    tokens_input:  tokensIn,
    tokens_output: tokensOut,
    cached_tokens: 0,
    search_calls:  searchCalls,
    cost_usd:      cost,
    model,
  };
}
