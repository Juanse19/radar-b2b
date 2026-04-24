/**
 * providers/gemini.ts — Real Google Gemini 2.0 Flash provider for Radar v2.
 *
 * Implemented using raw fetch to the Generative Language API
 * (no @google/generative-ai npm package needed).
 * Uses googleSearch grounding so the model performs live web searches
 * before responding — grounding metadata is emitted as SSE events.
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
import {
  CALIFICADOR_SYSTEM_PROMPT,
  buildCalificadorUserPrompt,
} from '@/lib/comercial/calificador/prompts';
import type { CalificacionInput, CalificacionOutput } from '@/lib/comercial/calificador/types';

const GEMINI_MODEL       = process.env.GOOGLE_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
// Gemini 2.0 Flash pricing (as of 2026-04): $0.075/1M input, $0.30/1M output
const PRICE_INPUT_PER_M  = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ---------------------------------------------------------------------------
// System prompt — radar methodology with live Google Search grounding
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

Tienes acceso a búsqueda web en tiempo real vía Google Search. Ejecuta las siguientes búsquedas en orden para cada empresa:
1. "{empresa}" {palabras_clave_linea} CAPEX 2026 2027 expansión
2. "{empresa}" licitación contratación pública {país} 2026
3. "{empresa}" "nueva planta" OR "expansión" OR "ampliación" {país}
4. "{empresa}" informe anual 2025 2026 inversión CAPEX estrategia plan
5. "{empresa}" proyecto {país} BID CAF infraestructura 2026 2027

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

FUENTES PRIORITARIAS (usar primero, mayor peso en evaluación):
- Portales contratación pública: SECOP II (Colombia), CompraNet (México), ChileCompra, SEACE (Perú), SISCO (Argentina)
- Prensa económica especializada: Reuters, Bloomberg, BNAmericas, El Tiempo, Expansión MX, El Economista MX, Diario Financiero CL, La República CO
- Sitios IR de empresa: investor.{empresa}.com, {empresa}.com/inversionistas, reportes anuales, comunicados de prensa oficiales
- Multilaterales: CAF, BID Invest, Banco Mundial proyectos, BNDES (Brasil), Findeter (Colombia)

FUENTES PROHIBIDAS — NO USAR, NO CITAR bajo ninguna circunstancia:
- Wikipedia, Wikimedia, enciclopedias online genéricas
- Redes sociales: LinkedIn posts, Twitter/X, Facebook, Instagram
- Portales de empleo: LinkedIn Jobs, Indeed, Computrabajo
- Artículos de marketing o "salud corporativa" sin cifras verificables
- Noticias sin fecha, anteriores a octubre 2025, o sin fuente identificable. Si la inversión ya está en ejecución desde 2024/2025 sin fases futuras documentadas → DESCARTAR

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
DESCARTAR (radar_activo: "No"): si no hay evidencia concreta de inversión futura en las líneas de Matec para 2026-2028. Descartar también si la inversión inició en 2024/2025 sin fases documentadas después de julio 2026, o si contiene verbos de pasado completivo listados arriba.

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

  let systemPromptText = buildSystemPrompt();
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

    async calificar(params: CalificacionInput, emit?: SSEEmitter): Promise<CalificacionOutput> {
      const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GOOGLE_API_KEY not set');
      const model = GEMINI_MODEL;

      emit?.emit('thinking', { empresa: params.empresa, chunk: 'Iniciando calificación con Gemini…' });
      emit?.emit('profiling_web', { empresa: params.empresa, query: `${params.empresa} ${params.pais} inversión 2026` });

      const userMsg = buildCalificadorUserPrompt(params, params.ragContext);
      const fullPrompt = `${CALIFICADOR_SYSTEM_PROMPT}\n\n${userMsg}`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
        tools: [{ googleSearch: {} }],
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gemini calificar ${resp.status}: ${err.slice(0, 300)}`);
      }

      type GeminiResp = {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const data = await resp.json() as GeminiResp;
      const text   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const tokensIn  = data.usageMetadata?.promptTokenCount     ?? 0;
      const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0;
      const cost = (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

      let rawJson: unknown;
      try {
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        rawJson = JSON.parse(cleaned);
      } catch {
        throw new Error(`Gemini calificar non-JSON for ${params.empresa}`);
      }

      return {
        scores: (rawJson as { scores: CalificacionOutput['scores'] }).scores,
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

export const geminiProvider: AIProvider = createGeminiProvider();
