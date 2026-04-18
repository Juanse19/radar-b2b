/**
 * providers/openai.ts — Real OpenAI GPT-4o provider for Radar v2.
 *
 * Implemented using raw fetch (no `openai` npm package needed).
 * Web search is NOT available here; the system prompt includes enough
 * structured context for the model to reason from its training data and
 * the company information provided.
 */
import 'server-only';
import { parseAgente1Response } from '@/lib/radar-v2/schema';
import type {
  AIProvider,
  CostEstimate,
  EstimateParams,
  ScanParams,
  ScanResult,
  SSEEmitter,
  SupportedFeature,
} from './types';

const OPENAI_MODEL       = process.env.OPENAI_MODEL ?? 'gpt-4o';
// GPT-4o pricing (as of 2026-04): $2.50/1M input, $10.00/1M output
const PRICE_INPUT_PER_M  = 2.5;
const PRICE_OUTPUT_PER_M = 10.0;

// ---------------------------------------------------------------------------
// System prompt — same radar methodology, adapted for a non-search model
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

IMPORTANTE: No tienes acceso a búsqueda web en tiempo real. Debes razonar a partir de:
1. Tu conocimiento de la empresa y el sector hasta tu fecha de corte.
2. La información de contexto proporcionada en el mensaje del usuario.
3. Patrones de expansión documentados de la empresa.

INCLUIR (radar_activo: "Sí"): planes de expansión documentados en reportes anuales, declaraciones públicas de CAPEX, proyectos en construcción anunciados, licitaciones conocidas, estrategias de crecimiento confirmadas.
DESCARTAR (radar_activo: "No"): si no hay evidencia concreta de inversión futura en las líneas de Matec para 2026-2028.

VENTANA DE COMPRA:
- Q2-Q4 2026 → "0-6 Meses"
- Q1-Q2 2027 → "6-12 Meses"
- Q3 2027-Q2 2028 → "12-18 Meses"
- Q3 2028-Q2 2029 → "18-24 Meses"
- 2029+ → "> 24 Meses"
- Sin señal → "Sin señal"

REGLAS CRÍTICAS DE DATOS (anti-alucinación):

1. descripcion_resumen:
   - Si radar_activo="Sí": MÍNIMO 80 palabras describiendo el proyecto, origen de la señal, fuente o reporte donde se documentó, monto si aplica, y ventana temporal estimada. NUNCA dejar vacío.
   - Si radar_activo="No": MÍNIMO 60 palabras explicando qué se analizó y por qué no hay señal activa. NUNCA dejar vacío.

2. fecha_senal: formato DD/MM/AAAA OBLIGATORIO. NUNCA posterior a hoy (${today}). Si solo se conoce el año → "No disponible".

3. monto_inversion: SOLO si el valor aparece en reportes públicos o declaraciones oficiales de la empresa. Estimaciones no confirmadas → "No reportado". Nunca inventar cifras.

4. fuente_link: Si conoces la URL del reporte anual o noticia, incluirla. Si no la conoces con certeza → "No disponible". NUNCA inventar URLs.

5. motivo_descarte: 1 frase concisa, máximo 160 caracteres. Solo si radar_activo="No".

RESPONDE SOLO con JSON válido sin markdown. Schema exacto:
{"empresa_evaluada":"string","radar_activo":"Sí"|"No","linea_negocio":"string|null","tipo_senal":"CAPEX Confirmado|Expansión / Nueva Planta|Expansión / Nuevo Centro de Distribución|Expansión / Nuevo Aeropuerto o Terminal|Licitación|Ampliación Capacidad|Modernización / Retrofit|Señal Temprana|Sin Señal","pais":"string","empresa_o_proyecto":"string","descripcion_resumen":"mín 80 palabras si Sí, mín 60 si No","criterios_cumplidos":["array","de","strings"],"total_criterios":0,"ventana_compra":"string","monto_inversion":"string","fuente_link":"string","fuente_nombre":"string","fecha_senal":"DD/MM/AAAA o No disponible","evaluacion_temporal":"🔴 Descarte|🟡 Ambiguo|🟢 Válido","observaciones":null,"motivo_descarte":""}`;
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

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}

Analiza si esta empresa tiene señales de inversión futura relevantes para las líneas de negocio de Matec en LATAM para el período 2026-2028. Usa tu conocimiento de la empresa, su sector y sus planes declarados de expansión.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  emit?.emit('thinking', { empresa: company.name, linea: line });

  const body = {
    model:      model,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: userMessage },
    ],
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const rawText   = data.choices?.[0]?.message?.content ?? '';
  if (!rawText) throw new Error('No content in OpenAI response');

  const tokensIn  = data.usage?.prompt_tokens     ?? 0;
  const tokensOut = data.usage?.completion_tokens  ?? 0;
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
    search_calls: 0,
  });

  return {
    result,
    tokens_input:  tokensIn,
    tokens_output: tokensOut,
    cached_tokens: 0,
    search_calls:  0,
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
      // OpenAI chat completions: streaming yes, no native web search or prompt caching
      return feature === 'streaming';
    },
  };
}

export const openaiProvider: AIProvider = createOpenAIProvider();
