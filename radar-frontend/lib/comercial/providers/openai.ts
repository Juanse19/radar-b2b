/**
 * providers/openai.ts — Real OpenAI GPT-4o provider for Radar v2.
 *
 * Uses the OpenAI Responses API (POST /v1/responses) with the
 * web_search_preview tool so the model can fetch live signals before
 * producing the structured JSON output.
 */
import 'server-only';
import { parseAgente1Response } from '@/lib/comercial/schema';
import { validateAgente1Result } from '@/lib/comercial/validation';
import type {
  AIProvider,
  CostEstimate,
  EstimateParams,
  ScanParams,
  ScanResult,
  SSEEmitter,
  SupportedFeature,
} from './types';
import {
  CALIFICADOR_SYSTEM_PROMPT,
  buildCalificadorUserPrompt,
} from '@/lib/comercial/calificador/prompts';
import { CALIFICACION_JSON_SCHEMA } from '@/lib/comercial/calificador/schema';
import type { CalificacionInput, CalificacionOutput } from '@/lib/comercial/calificador/types';

// Default to gpt-4o-mini: supports web_search_preview, $0.15/1M in, $0.60/1M out
// (gpt-4o fallback available via OPENAI_MODEL env var if needed)
const OPENAI_MODEL       = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
// GPT-4o-mini pricing (as of 2026-04): $0.15/1M input, $0.60/1M output
// GPT-4o pricing (Oct 2026)
const PRICE_INPUT_PER_M  = 2.50;
const PRICE_OUTPUT_PER_M = 10.00;

// ---------------------------------------------------------------------------
// Responses API types
// ---------------------------------------------------------------------------

type ResponsesOutputItem =
  | {
      type: 'web_search_call';
      id: string;
      status: string;
      queries?: string[];
    }
  | {
      type: 'message';
      role: 'assistant';
      content: Array<{ type: string; text: string }>;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

interface ResponsesApiResponse {
  output: ResponsesOutputItem[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// System prompt — radar methodology with live web search
// ---------------------------------------------------------------------------

import { buildSystemPrompt, resolveLineKeywords } from './shared-prompt';


// ---------------------------------------------------------------------------
// 429 retry helper — mirrors claudeFetchWithRetry pattern
// ---------------------------------------------------------------------------

async function openAIFetchWithRetry(
  url: string,
  options: RequestInit,
  emit: SSEEmitter | undefined,
  empresa: string,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status !== 429 || attempt === maxRetries) return resp;

    const retryAfterSec = Number(resp.headers?.get('retry-after') ?? '60');
    const waitMs = Math.min(retryAfterSec * 1_000, 120_000);
    emit?.emit('thinking', { empresa, linea: '', text: `Límite de tasa alcanzado. Reintentando en ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})…` });
    await new Promise(r => setTimeout(r, waitMs));
  }
  return fetch(url, options);
}

// ---------------------------------------------------------------------------
// Internal scan implementation
// ---------------------------------------------------------------------------

async function scanImpl(
  params: ScanParams,
  emit?: SSEEmitter,
): Promise<ScanResult> {
  const { company, line } = params;
  const startedAt = Date.now();

  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured — add it to .env.local');
  }
  const model = params.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o';

  // RAG context — optional, non-fatal
  let ragBlock = '';
  try {
    const { retrieveContext, buildRagBlock } = await import('../rag');
    const ragCtx = await retrieveContext(company.name, line);
    ragBlock = buildRagBlock(ragCtx);
  } catch { /* RAG optional */ }

  const keywords = params.keywords ?? resolveLineKeywords(line);

  const today = new Date();
  const cutoff = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const todayStr = today.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const cutoffStr = cutoff.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}${params.sublinea ? `\nSub-línea: ${params.sublinea}` : ''}
Palabras clave del sector: ${keywords}

═══ VENTANA TEMPORAL — REGLA DURA ═══
Fecha de hoy: ${todayStr}
Fecha de corte de recencia: ${cutoffStr} (180 días atrás).
SOLO considera fuentes posteriores a ${cutoffStr}. Cualquier nota anterior, sin fase futura
verificable que esté aún por iniciar, debe DESCARTARSE (radar_activo="No").
Si la fuente describe la obra como ya inaugurada / abierta / operando → DESCARTE.

TAREA: Busca señales de inversión FUTURA en LATAM 2026-2028 para esta empresa.
Ejecuta estas búsquedas exactas (incluyendo el operador after: para acotar recencia):
1. "${company.name}" ${keywords} 2026 2027 after:${cutoffISO}
2. "${company.name}" licitación contratación pública ${company.country} after:${cutoffISO}
3. "${company.name}" plan expansión CAPEX informe anual 2025 2026 prospectivo after:${cutoffISO}
4. "${company.name}" "nueva planta" OR "nueva sede" OR "ampliación" ${company.country} after:${cutoffISO}

IMPORTANTE: Usa solo fuentes con proyectos documentados POSTERIORES a ${cutoffStr}.
NO cites Wikipedia, redes sociales ni ofertas de empleo. NO uses notas de 2024 o anteriores
salvo que mencionen explícitamente una fase futura aún no iniciada.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  emit?.emit('thinking', { empresa: company.name, linea: line });

  let systemPromptText = buildSystemPrompt(line, today);
  try {
    const { getAgentPrompt } = await import('@/lib/db/supabase/agent-prompts');
    const dbOverride = await getAgentPrompt('openai');
    if (dbOverride) systemPromptText = dbOverride;
  } catch { /* DB unavailable — use hardcoded */ }

  const body = {
    model,
    tools: [{ type: 'web_search_preview' }],
    input: [
      { role: 'system', content: systemPromptText },
      { role: 'user',   content: userMessage },
    ],
    max_output_tokens: 2048,
    store: false,
  };

  const resp = await openAIFetchWithRetry(
    'https://api.openai.com/v1/responses',
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    },
    emit,
    company.name,
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as ResponsesApiResponse;

  let rawText = '';
  let searchCalls = 0;

  for (const item of data.output ?? []) {
    if (item.type === 'web_search_call') {
      searchCalls += 1;
      const searchItem = item as Extract<ResponsesOutputItem, { type: 'web_search_call' }>;
      emit?.emit('search_query', {
        empresa: company.name,
        query: searchItem.queries?.[0] ?? 'búsqueda web',
      });
    } else if (item.type === 'message') {
      const msgItem = item as Extract<ResponsesOutputItem, { type: 'message' }>;
      const textContent = msgItem.content.find(c => c.type === 'output_text');
      if (textContent) {
        rawText = textContent.text;
      }
    }
  }

  if (!rawText) throw new Error('No content in OpenAI Responses API output');

  const tokensIn  = data.usage?.input_tokens  ?? 0;
  const tokensOut = data.usage?.output_tokens ?? 0;
  const cost      = (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

  emit?.emit('token_tick', {
    empresa:        company.name,
    tokens_in:      tokensIn,
    tokens_out:     tokensOut,
    cost_usd_delta: cost,
    cost_usd_total: cost,
  });

  const resultRaw = parseAgente1Response(rawText);
  const result = validateAgente1Result(resultRaw, today);

  if (result.radar_activo === 'Sí') {
    emit?.emit('signal_detected', {
      empresa:         company.name,
      tipo_senal:      result.tipo_senal,
      monto_inversion: result.monto_inversion,
      ventana_compra:  result.ventana_compra,
      fuente_link:     result.fuente_link,
    });
  } else {
    emit?.emit('signal_discarded', {
      empresa:         company.name,
      motivo_descarte: result.motivo_descarte,
    });
  }

  for (const crit of result.criterios_cumplidos ?? []) {
    emit?.emit('criteria_eval', { empresa: company.name, criterio: crit, cumplido: true });
  }

  emit?.emit('company_done', {
    empresa:      company.name,
    radar_activo: result.radar_activo,
    duration_ms:  Date.now() - startedAt,
    tokens_in:    tokensIn,
    tokens_out:   tokensOut,
    cost_usd:     cost,
    search_calls: searchCalls,
  });

  return {
    result,
    result_raw:    resultRaw,
    tokens_input:  tokensIn,
    tokens_output: tokensOut,
    cached_tokens: 0,
    search_calls:  searchCalls,
    cost_usd:      cost,
    model,
  };
}

// ---------------------------------------------------------------------------
// Cost estimate
// ---------------------------------------------------------------------------

function estimateImpl(params: EstimateParams): CostEstimate {
  const tokens_in_est  = params.empresas_count * 6500;
  const tokens_out_est = params.empresas_count * 800;
  const cost_usd_est =
    (tokens_in_est  * PRICE_INPUT_PER_M  / 1_000_000) +
    (tokens_out_est * PRICE_OUTPUT_PER_M / 1_000_000);
  return { tokens_in_est, tokens_out_est, cost_usd_est, cached_percentage: 0 };
}

// ---------------------------------------------------------------------------
// Factory + singleton
// ---------------------------------------------------------------------------

function createOpenAIProvider(): AIProvider {
  return {
    name:  'openai',
    model: OPENAI_MODEL,

    async scan(params, emit) {
      return scanImpl(params, emit);
    },

    estimate(params) {
      return estimateImpl(params);
    },

    supports(feature: SupportedFeature): boolean {
      return feature === 'web_search' || feature === 'streaming';
    },

    async calificar(params: CalificacionInput, emit?: SSEEmitter): Promise<CalificacionOutput> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      const model = process.env.OPENAI_CALIFICADOR_MODEL ?? 'gpt-4o-mini';

      emit?.emit('thinking', { empresa: params.empresa, chunk: 'Iniciando calificación con OpenAI…' });
      emit?.emit('profiling_web', { empresa: params.empresa, query: `${params.empresa} ${params.pais} inversión 2026` });

      const userMsg = buildCalificadorUserPrompt(params, params.ragContext);

      const body = {
        model,
        max_tokens: 2048,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'calificacion', strict: true, schema: CALIFICACION_JSON_SCHEMA },
        },
        messages: [
          { role: 'system', content: CALIFICADOR_SYSTEM_PROMPT },
          { role: 'user',   content: userMsg },
        ],
      };

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenAI calificar ${resp.status}: ${err.slice(0, 300)}`);
      }

      type OAIResp = { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };
      const data = await resp.json() as OAIResp;
      const content = data.choices[0]?.message?.content ?? '';
      const tokensIn  = data.usage?.prompt_tokens     ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;
      const cost = (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

      let rawJson: unknown;
      try {
        rawJson = JSON.parse(content);
      } catch {
        throw new Error(`OpenAI calificar non-JSON for ${params.empresa}`);
      }

      return {
        scores: (rawJson as { scores: CalificacionOutput['scores'] }).scores,
        dimensiones: (rawJson as { dimensiones?: CalificacionOutput['dimensiones'] }).dimensiones,
        scoreTotal: 0,
        tier: 'C',
        razonamiento: (rawJson as { razonamiento?: string }).razonamiento ?? '',
        perfilWeb: (rawJson as { perfilWeb?: CalificacionOutput['perfilWeb'] }).perfilWeb ?? { summary: '', sources: [] },
        rawJson,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        costUsd: cost,
        model,
      };
    },

    estimateCalificacion(empresas_count: number): CostEstimate {
      const tokens_in_est  = empresas_count * 2500;
      const tokens_out_est = empresas_count * 600;
      const cost_usd_est   = (tokens_in_est * PRICE_INPUT_PER_M + tokens_out_est * PRICE_OUTPUT_PER_M) / 1_000_000;
      return { tokens_in_est, tokens_out_est, cost_usd_est, cached_percentage: 0 };
    },
  };
}

export const openaiProvider: AIProvider = createOpenAIProvider();
