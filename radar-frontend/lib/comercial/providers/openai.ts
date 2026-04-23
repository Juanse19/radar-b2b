/**
 * providers/openai.ts — Real OpenAI GPT-4o provider for Radar v2.
 *
 * Uses the OpenAI Responses API (POST /v1/responses) with the
 * web_search_preview tool so the model can fetch live signals before
 * producing the structured JSON output.
 */
import 'server-only';
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
// System prompt — radar methodology with live web search
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

Tienes acceso a búsqueda web en tiempo real. Ejecuta EXACTAMENTE estas 4-5 búsquedas para cada empresa:
1. "{empresa}" {palabras_clave_linea} CAPEX 2026 2027
2. "{empresa}" licitación contratación pública {país} 2026
3. "{empresa}" "nueva planta" OR "expansión" OR "ampliación" {país}
4. "{empresa}" informe anual 2025 2026 inversiones estrategia plan CAPEX
5. "{empresa}" proyecto infraestructura {país} BID CAF Banco Mundial (si aplica)

PALABRAS CLAVE POR LÍNEA:
- BHS/Aeropuertos: ampliación terminal aeropuerto CAPEX concesión sorter BHS
- Intralogística: CEDI bodega almacén automatización WMS conveyor ASRS sortación
- Cartón/Papel: planta corrugadora cartón ondulado CAPEX expansión capacidad producción
- Final de Línea: palletizador embalaje packaging línea producción alimentos bebidas CAPEX
- Motos/Ensambladoras: ensambladora motocicleta planta CAPEX expansión línea producción
- Solumat/Plásticos: planta plástico material industrial molde inyección CAPEX expansión

🔴 FILTRO NEGATIVO BHS (NO son BHS — ignorar):
   runway, taxiway, apron, torre de control, ILS, radar ATC,
   pista de aterrizaje, navegación aérea, señalización de pista.
🟢 FILTRO POSITIVO BHS (SÍ son BHS):
   terminal de pasajeros + sistema BHS, carrusel de equipaje,
   CUTE, CUSS, CBIS, sortation aeroportuario, self bag drop.

FUENTES PRIORITARIAS (mayor credibilidad):
- Contratación pública: SECOP II (Colombia), CompraNet (México), ChileCompra, SEACE (Perú)
- Prensa económica: Reuters, Bloomberg, BNAmericas, El Tiempo, Expansión, El Economista
- Fuentes de empresa: investor.{empresa}.com, reportes anuales, comunicados IR
- Multilaterales: CAF, BID, Banco Mundial (proyectos de infraestructura)

FUENTES PROHIBIDAS (ignorar completamente, no citar):
- Wikipedia, Wikimedia, enciclopedias → NO USAR
- LinkedIn posts, Twitter, Facebook, redes sociales → NO USAR
- Ofertas de empleo / job postings → NO USAR
- Artículos de marketing sin cifras verificables → NO USAR
- Noticias sin fecha o anteriores a octubre 2025 → NO USAR. Si la inversión ya está ejecutando desde 2024/2025 sin fases futuras por iniciar después de julio 2026 → NO USAR

🔴 DESCARTE INMEDIATO — verbos de pasado completivo (la señal ya se ejecutó):
   "inauguró", "inaugurado", "abrió sus puertas", "ya está en operación",
   "entró en funcionamiento", "fue completado", "ya opera",
   "completó su construcción", "se completó", "en plena operación",
   "fue inaugurado", "completó la obra", "ya entró en servicio"

🟡 AMBIGUO — requiere análisis adicional:
   Proyectos con fechas 2025-2027: buscar ACTIVAMENTE si hay fases futuras pendientes.
   Si hay fase futura verificable (equipo por licitar, obras no completadas) → radar_activo="Sí", tipo_senal="Señal Temprana"
   Si NO hay fase futura verificable → DESCARTAR

🔍 LA EMPRESA DEBE APARECER EXPLÍCITAMENTE EN LA FUENTE:
Antes de asignar radar_activo="Sí", verifica:
¿El titular o cuerpo de la fuente menciona EXPLÍCITAMENTE el nombre de la empresa?

✅ VÁLIDO: "[Empresa] anunció inversión de USD X millones en nueva planta"
❌ INVÁLIDO → DESCARTE: "Plan de Inversión Nacional 2026" (sin nombrar la empresa)
❌ INVÁLIDO → DESCARTE: "El sector logístico invertirá $X millones" (sector genérico)
❌ INVÁLIDO → DESCARTE: Artículo sobre OTRA empresa del mismo sector

Si NINGÚN resultado menciona la empresa explícitamente:
  radar_activo="No", motivo_descarte="Sin fuentes específicas que mencionen a {empresa}."

📋 CRITERIOS DE VALIDACIÓN (necesitas ≥3 de 6 para activar):
1. Inversión confirmada o en planificación formal
2. Expansión física: nueva terminal, planta, CEDI, corrugadora, hub
3. Proyecto específico con nombre, código o número de referencia
4. Proceso de contratación activo: licitación, RFP, concurso
5. Permisos o concesiones gubernamentales obtenidos o en proceso
6. Financiación confirmada: crédito, bono, CAPEX en reporte financiero

Si total_criterios < 3 → indicar en observaciones que la señal es débil.

📰 PAYWALL: Si titular anuncia inversión pero el cuerpo está bloqueado:
   - Reportar con datos disponibles del snippet/titular.
   - Agregar en observaciones: "Fuente con paywall — datos limitados al snippet."

INCLUIR (radar_activo: "Sí"): planes de expansión documentados en reportes anuales, declaraciones públicas de CAPEX, proyectos en construcción anunciados, licitaciones conocidas, estrategias de crecimiento confirmadas.
DESCARTAR (radar_activo: "No"): si no hay evidencia concreta de inversión futura en las líneas de Matec para 2026-2028. También descartar si la inversión mencionada ya inició ejecución en 2024/2025 sin fases documentadas después de julio 2026, o si contiene verbos de pasado completivo listados arriba.

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

    const retryAfterSec = Number(resp.headers.get('retry-after') ?? '60');
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

  let systemPromptText = buildSystemPrompt();
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
