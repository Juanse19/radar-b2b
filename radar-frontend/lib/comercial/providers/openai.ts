/**
 * providers/openai.ts — Real OpenAI GPT-4o provider for Radar v2.
 *
 * Uses the OpenAI Responses API (POST /v1/responses) with the
 * web_search_preview tool so the model can fetch live signals before
 * producing the structured JSON output.
 */
import 'server-only';
import { buildMaoaSystemPrompt } from './shared-prompt';
import { parseAgente1Response } from '@/lib/comercial/schema';
import type {
  AIProvider,
  CostEstimate,
  EstimateParams,
  ScanParams,
  ScanResult,
  SSEEmitter,
  SupportedFeature,
} from './types';

// Default to gpt-4o-mini: supports web_search_preview, $0.15/1M in, $0.60/1M out
// (gpt-4o fallback available via OPENAI_MODEL env var if needed)
const OPENAI_MODEL       = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
// GPT-4o-mini pricing (as of 2026-04): $0.15/1M input, $0.60/1M output
const PRICE_INPUT_PER_M  = 0.15;
const PRICE_OUTPUT_PER_M = 0.60;

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

  const lineKeywords: Record<string, string> = {
    bhs:            'aeropuerto terminal CAPEX sorter BHS concesión licitación',
    aeropuerto:     'aeropuerto terminal CAPEX sorter BHS concesión licitación',
    cargo:          'bodega aerocarga CAPEX expansión logística aérea licitación',
    cartón:         'planta corrugadora cartón CAPEX expansión capacidad producción',
    carton:         'planta corrugadora cartón CAPEX expansión capacidad producción',
    papel:          'planta corrugadora cartón CAPEX expansión capacidad producción',
    intralogística: 'CEDI bodega almacén automatización WMS conveyor ASRS CAPEX licitación',
    intralogistica: 'CEDI bodega almacén automatización WMS conveyor ASRS CAPEX licitación',
    'final de línea': 'palletizador embalaje packaging línea producción alimentos bebidas CAPEX',
    'final de linea': 'palletizador embalaje packaging línea producción alimentos bebidas CAPEX',
    motos:          'ensambladora motocicleta planta CAPEX expansión línea producción',
    solumat:        'planta plástico material industrial molde inyección CAPEX expansión',
    plástico:       'planta plástico material industrial molde inyección CAPEX expansión',
  };
  const lineKey = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const keywords = Object.entries(lineKeywords).find(([k]) =>
    lineKey.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  )?.[1] ?? 'CAPEX inversión expansión planta nueva 2026 2027';

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}
Palabras clave del sector: ${keywords}

TAREA: Busca señales de inversión FUTURA en LATAM 2026-2028 para esta empresa.
Ejecuta estas búsquedas exactas:
1. "${company.name}" ${keywords} 2026 2027
2. "${company.name}" licitación contratación pública ${company.country}
3. "${company.name}" plan expansión CAPEX informe anual 2025 2026 prospectivo
4. "${company.name}" "nueva planta" OR "nueva sede" OR "ampliación" ${company.country}

IMPORTANTE: Usa solo fuentes con proyectos documentados. NO cites Wikipedia, redes sociales ni ofertas de empleo.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  emit?.emit('thinking', { empresa: company.name, linea: line });

  let systemPromptText = buildMaoaSystemPrompt();
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

  const result = parseAgente1Response(rawText);

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
  };
}

export const openaiProvider: AIProvider = createOpenAIProvider();
