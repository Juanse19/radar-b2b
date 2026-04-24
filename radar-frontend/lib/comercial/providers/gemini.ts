/**
 * providers/gemini.ts — Real Google Gemini 2.0 Flash provider for Radar v2.
 *
 * Implemented using raw fetch to the Generative Language API
 * (no @google/generative-ai npm package needed).
 * Uses googleSearch grounding so the model performs live web searches
 * before responding — grounding metadata is emitted as SSE events.
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

const GEMINI_MODEL       = process.env.GOOGLE_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
// Gemini 2.0 Flash pricing (as of 2026-04): $0.075/1M input, $0.30/1M output
const PRICE_INPUT_PER_M  = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ---------------------------------------------------------------------------
// Internal scan implementation
// ---------------------------------------------------------------------------

async function scanImpl(
  params: ScanParams,
  emit?: SSEEmitter,
): Promise<ScanResult> {
  const { company, line } = params;
  const startedAt = Date.now();

  const apiKey = params.apiKey ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured — add it to .env.local');
  }
  const model = params.model ?? process.env.GOOGLE_MODEL ?? 'gemini-2.0-flash';

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

TAREA: Busca señales de inversión FUTURA para esta empresa en LATAM 2026-2028 usando Google Search.
Ejecuta estas búsquedas en orden:
1. "${company.name}" ${keywords} 2026 2027
2. "${company.name}" licitación contratación pública ${company.country}
3. "${company.name}" plan expansión CAPEX informe anual 2025 2026 prospectivo
4. "${company.name}" "nueva planta" OR "nueva sede" OR "ampliación" ${company.country}

IMPORTANTE: Usa solo fuentes primarias con proyectos documentados (SECOP, Reuters, reportes anuales). NO cites Wikipedia, redes sociales ni portales de empleo.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  emit?.emit('thinking', { empresa: company.name, linea: line });

  let systemPromptText = buildMaoaSystemPrompt();
  try {
    const { getAgentPrompt } = await import('@/lib/db/supabase/agent-prompts');
    const dbOverride = await getAgentPrompt('gemini');
    if (dbOverride) systemPromptText = dbOverride;
  } catch { /* DB unavailable — use hardcoded */ }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemPromptText }],
    },
    contents: [
      {
        role:  'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
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

  const data = await resp.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        searchEntryPoint?: { renderedContent?: string };
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?:     number;
      candidatesTokenCount?: number;
    };
  };

  emit?.emit('thinking', { empresa: company.name, linea: line });

  const grounding = data.candidates?.[0]?.groundingMetadata;
  let searchCalls = 0;
  if (grounding) {
    // Emit search query from rendered content (may contain HTML)
    const searchContent = grounding.searchEntryPoint?.renderedContent;
    if (searchContent) {
      const query = searchContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      emit?.emit('search_query', { empresa: company.name, query: query || 'Google Search' });
    }
    // Emit each grounding source URL
    let sourceCount = 0;
    for (const chunk of grounding.groundingChunks ?? []) {
      if (chunk.web?.uri && sourceCount < 10) {
        emit?.emit('reading_source', {
          empresa: company.name,
          url:     chunk.web.uri,
          title:   chunk.web.title ?? chunk.web.uri,
        });
        sourceCount++;
      }
    }
    searchCalls = grounding.groundingChunks?.length ?? 0;
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) throw new Error('No content in Gemini response');

  const tokensIn  = data.usageMetadata?.promptTokenCount     ?? 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0;
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
    model:         model,
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

function createGeminiProvider(): AIProvider {
  return {
    name:  'gemini',
    model: GEMINI_MODEL,

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

export const geminiProvider: AIProvider = createGeminiProvider();
