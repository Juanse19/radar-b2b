/**
 * lib/radar/openaiWebSearchClient.ts — OpenAI Responses API web search runner.
 * Mirrors the interface of runClaudeWebSearch so scan-signals can use any provider.
 */
import 'server-only';
import type { RunResult, RunInput } from './claudeWebSearchClient';

const DEFAULT_MODEL      = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const PRICE_INPUT_PER_M  = 0.15;
const PRICE_OUTPUT_PER_M = 0.60;

type ResponsesOutputItem =
  | { type: 'web_search_call'; id: string; status: string; queries?: string[] }
  | { type: 'message'; role: 'assistant'; content: Array<{ type: string; text: string }> }
  | { type: string; [key: string]: unknown };

interface ResponsesApiResponse {
  output: ResponsesOutputItem[];
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status !== 429 || attempt === maxRetries) return resp;
    const retryAfterSec = Number(resp.headers?.get('retry-after') ?? '60');
    await new Promise((r) => setTimeout(r, Math.min(retryAfterSec * 1_000, 120_000)));
  }
  return fetch(url, options);
}

export async function runOpenAIWebSearch(input: RunInput): Promise<RunResult> {
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured — add it to .env.local');

  const model = input.model ?? DEFAULT_MODEL;

  const body = {
    model,
    tools: [{ type: 'web_search_preview' }],
    input: [
      { role: 'system', content: input.system },
      { role: 'user',   content: input.user },
    ],
    max_output_tokens: input.maxTokens ?? 4096,
    store: false,
  };

  const resp = await fetchWithRetry('https://api.openai.com/v1/responses', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as ResponsesApiResponse;
  let text = '';
  let searchCalls = 0;

  for (const item of data.output ?? []) {
    if (item.type === 'web_search_call') {
      searchCalls += 1;
    } else if (item.type === 'message') {
      const msgItem = item as Extract<ResponsesOutputItem, { type: 'message' }>;
      const textContent = msgItem.content.find((c) => c.type === 'output_text');
      if (textContent) text = textContent.text;
    }
  }

  if (!text) throw new Error('No content in OpenAI Responses API output');

  const tokensIn  = data.usage?.input_tokens  ?? 0;
  const tokensOut = data.usage?.output_tokens ?? 0;
  const cost      = (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

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
