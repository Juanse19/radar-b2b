/**
 * providers/claude.ts — Real Claude Sonnet 4.6 provider.
 *
 * Moved (as-is) from lib/comercial/scanner.ts. System prompt, multi-turn loop,
 * and API call semantics are preserved byte-for-byte. Only the public surface
 * changes: the logic now lives behind the AIProvider contract, and optional
 * SSE emission hooks have been added at key points in the turn loop.
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

const CLAUDE_MODEL       = 'claude-sonnet-4-6';
const PRICE_INPUT_PER_M  = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

// ---------------------------------------------------------------------------
// Hardened system prompt v2 — anti-hallucination rules + few-shot examples
// ---------------------------------------------------------------------------
// NOTE: The date injected at build-time prevents the model from inventing
// future dates. The few-shot examples are JSON comments at the bottom and
// are trimmed from the live prompt but serve as strong in-context examples.

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }); // e.g. "16/04/2026"

  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

METODOLOGÍA: Ejecuta 3-5 búsquedas web con sub-preguntas específicas: expansión física, licitaciones públicas, CAPEX declarado, proyectos nuevos, contratos adjudicados. Lee las fuentes completas antes de concluir.

INCLUIR (radar_activo: "Sí"): inversión futura 6-36 meses, proyecto específico identificado, licitación/RFP abierto, CAPEX sin ejecutar, construcción en curso con fases futuras por iniciar.
DESCARTAR (radar_activo: "No"): obra inaugurada/terminada, noticia pre-2025 sin actualización, nota genérica sin proyecto concreto, evento ya realizado, expansión ya ejecutada.

VENTANA DE COMPRA:
- Q2-Q4 2026 → "0-6 Meses"
- Q1-Q2 2027 → "6-12 Meses"
- Q3 2027-Q2 2028 → "12-18 Meses"
- Q3 2028-Q2 2029 → "18-24 Meses"
- 2029+ → "> 24 Meses"
- Sin señal → "Sin señal"

REGLAS CRÍTICAS DE DATOS (anti-alucinación):

1. descripcion_resumen:
   - Si radar_activo="Sí": MÍNIMO 80 palabras describiendo el proyecto, origen de la señal, fuente consultada, monto si aplica, y ventana temporal estimada. NUNCA dejar vacío.
   - Si radar_activo="No": MÍNIMO 60 palabras explicando qué se buscó, qué fuentes se revisaron y por qué no hay señal activa. NUNCA dejar vacío.

2. fecha_senal: formato DD/MM/AAAA OBLIGATORIO. NUNCA posterior a hoy (${today}). Si solo se conoce el año → "No disponible". Ejemplos válidos: "15/03/2026", "01/01/2026". Inválido: "2026", "marzo 2026".

3. monto_inversion: SOLO si el valor aparece textualmente en la fuente consultada. Estimaciones de analistas sin cita directa de la empresa o entidad → "No reportado". Nunca inventar cifras.

4. fuente_link: URL absoluta pública (http:// o https://). Si la fuente es paywall total, intranet corporativa, o PDF no indexado → radar_activo="No" (no se puede verificar). No inventar URLs.

5. motivo_descarte: 1 frase concisa, máximo 160 caracteres, sin JSON ni bullets. Solo si radar_activo="No". Ejemplo: "Proyecto inaugurado en diciembre 2024, no hay fases futuras documentadas."

RESPONDE SOLO con JSON válido sin markdown. Schema exacto:
{"empresa_evaluada":"string","radar_activo":"Sí"|"No","linea_negocio":"string|null","tipo_senal":"CAPEX Confirmado|Expansión / Nueva Planta|Expansión / Nuevo Centro de Distribución|Expansión / Nuevo Aeropuerto o Terminal|Licitación|Ampliación Capacidad|Modernización / Retrofit|Señal Temprana|Sin Señal","pais":"string","empresa_o_proyecto":"string","descripcion_resumen":"mín 80 palabras si Sí, mín 60 si No","criterios_cumplidos":["array","de","strings"],"total_criterios":0,"ventana_compra":"string","monto_inversion":"string","fuente_link":"string","fuente_nombre":"string","fecha_senal":"DD/MM/AAAA o No disponible","evaluacion_temporal":"🔴 Descarte|🟡 Ambiguo|🟢 Válido","observaciones":null,"motivo_descarte":""}

/* FEW-SHOT EXAMPLE — ACTIVO:
{"empresa_evaluada":"Aeropuerto Internacional El Dorado","radar_activo":"Sí","linea_negocio":"BHS","tipo_senal":"Licitación","pais":"Colombia","empresa_o_proyecto":"Fase 2 Expansión Terminal Norte","descripcion_resumen":"La Aerocivil publicó en marzo 2026 la licitación pública LP-0042-2026 para la instalación de sistemas de manejo de equipajes (BHS) en la nueva ala norte del aeropuerto El Dorado. El contrato contempla 8 cintas de embarque, 4 sistemas de recirculación y un sortador central de alta capacidad. La inversión estimada declarada por la entidad es de COP 180.000 millones. El plazo de ejecución es de 18 meses a partir de la adjudicación prevista para julio 2026. Fuente: SECOP II, proceso LP-0042-2026, publicado el 12/03/2026.","criterios_cumplidos":["Fuente oficial","CAPEX declarado","Horizonte ≤18 meses","Licitación abierta"],"total_criterios":4,"ventana_compra":"0-6 Meses","monto_inversion":"COP 180.000 millones","fuente_link":"https://www.secop.gov.co/licitacion/LP-0042-2026","fuente_nombre":"SECOP II","fecha_senal":"12/03/2026","evaluacion_temporal":"🟢 Válido","observaciones":null,"motivo_descarte":""}

FEW-SHOT EXAMPLE — DESCARTE:
{"empresa_evaluada":"Copa Airlines","radar_activo":"No","linea_negocio":"BHS","tipo_senal":"Sin Señal","pais":"Panama","empresa_o_proyecto":"Copa Airlines","descripcion_resumen":"Se realizaron búsquedas en fuentes de noticias de aviación (ch-aviation, aviacionline, el propio sitio de Copa Airlines), SECOP Panama y reportes anuales 2024-2025. No se encontró ninguna licitación activa ni proyecto de expansión de infraestructura BHS documentado. El último proyecto BHS de Copa fue la ampliación del hub de Tocumen, inaugurada en octubre 2023 y completamente operativa. No existen anuncios de nuevas fases ni CAPEX de infraestructura para 2026-2028.","criterios_cumplidos":[],"total_criterios":0,"ventana_compra":"Sin señal","monto_inversion":"No reportado","fuente_link":"No disponible","fuente_nombre":"","fecha_senal":"No disponible","evaluacion_temporal":"🔴 Descarte","observaciones":null,"motivo_descarte":"No se detectaron señales de inversión BHS activas; último proyecto inaugurado en 2023."}
*/`;
}

const RADAR_SYSTEM_PROMPT = buildSystemPrompt();

// ---------------------------------------------------------------------------
// Internal scan implementation — mirrors the previous scanCompanyWithClaude
// ---------------------------------------------------------------------------

async function scanImpl(
  params: ScanParams,
  emit?: SSEEmitter,
): Promise<ScanResult> {
  const { company, line, sessionId } = params;
  const startedAt = Date.now();

  const apiKey = params.apiKey ?? process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set');
  const model = params.model ?? CLAUDE_MODEL;

  // RAG context — optional, non-fatal
  let ragBlock = '';
  try {
    const { retrieveContext, buildRagBlock } = await import('../rag');
    const ragCtx = await retrieveContext(company.name, line);
    ragBlock = buildRagBlock(ragCtx);
  } catch { /* RAG is optional — scan continues without context */ }

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}

Ejecuta 3-5 búsquedas web para encontrar señales de inversión futura de esta empresa en LATAM.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  const baseBody = {
    model:      model,
    max_tokens: 2048,
    system: [{ type: 'text', text: RADAR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools:  [{ type: 'web_search_20250305', name: 'web_search' }],
  };

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: userMessage },
  ];
  type WebSearchResult = { type: string; url?: string; title?: string };
  type ContentBlock = {
    type:     string;
    text?:    string;
    id?:      string;
    name?:    string;
    input?:   { query?: string };
    url?:     string;
    content?: WebSearchResult[];
  };
  let lastData: {
    content:     ContentBlock[];
    stop_reason: string;
    usage?:      { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  } = { content: [], stop_reason: '' };
  let totalInput  = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let searchCalls = 0;

  emit?.emit('thinking', { empresa: company.name, linea: line });

  for (let turn = 0; turn < 10; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
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

    lastData     = await resp.json() as typeof lastData;
    const turnIn  = lastData.usage?.input_tokens  ?? 0;
    const turnOut = lastData.usage?.output_tokens ?? 0;
    totalInput  += turnIn;
    totalOutput += turnOut;
    totalCached += lastData.usage?.cache_read_input_tokens ?? 0;

    // Emit per-turn token tick so the UI can update the budget badge live.
    const turnCost  = (turnIn * PRICE_INPUT_PER_M + turnOut * PRICE_OUTPUT_PER_M) / 1_000_000;
    const totalCost = (totalInput * PRICE_INPUT_PER_M + totalOutput * PRICE_OUTPUT_PER_M) / 1_000_000;
    emit?.emit('token_tick', {
      empresa:        company.name,
      tokens_in:      totalInput,
      tokens_out:     totalOutput,
      cost_usd_delta: turnCost,
      cost_usd_total: totalCost,
    });

    if (lastData.stop_reason === 'end_turn') break;

    if (lastData.stop_reason === 'tool_use') {
      // Emit per-search SSE events so the UI can show live queries and sources
      for (const block of lastData.content) {
        if (
          (block.type === 'server_tool_use' || block.type === 'tool_use') &&
          block.name === 'web_search'
        ) {
          searchCalls += 1;
          const q = block.input?.query;
          if (q) emit?.emit('search_query', { empresa: company.name, query: q });
        }
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const res of block.content) {
            if (res.url) {
              emit?.emit('reading_source', {
                empresa: company.name,
                url:     res.url,
                title:   res.title,
              });
            }
          }
        }
      }

      messages.push({ role: 'assistant', content: lastData.content });
      const toolResults = lastData.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: [] }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  const textBlocks = (lastData.content ?? []).filter(b => b.type === 'text');
  const rawText    = textBlocks[textBlocks.length - 1]?.text ?? '';
  if (!rawText) throw new Error('No text block in Claude response');

  const result = parseAgente1Response(rawText);
  const cost   = (totalInput * PRICE_INPUT_PER_M / 1_000_000)
               + (totalOutput * PRICE_OUTPUT_PER_M / 1_000_000);

  // Emit per-criterion evaluation events so the UI can show the checklist grow.
  for (const crit of result.criterios_cumplidos ?? []) {
    emit?.emit('criteria_eval', {
      empresa:  company.name,
      criterio: crit,
      cumplido: true,
    });
  }

  // Emit detected or discarded signal with key metadata.
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

  emit?.emit('company_done', {
    empresa:      company.name,
    radar_activo: result.radar_activo,
    duration_ms:  Date.now() - startedAt,
    tokens_in:    totalInput,
    tokens_out:   totalOutput,
    cost_usd:     cost,
    search_calls: searchCalls,
  });

  // Persist to Pinecone for future RAG context — non-fatal
  try {
    const { upsertSenal } = await import('../rag');
    await upsertSenal(result, sessionId ?? '');
  } catch { /* non-fatal */ }

  return {
    result,
    tokens_input:  totalInput,
    tokens_output: totalOutput,
    cached_tokens: totalCached,
    search_calls:  searchCalls,
    cost_usd:      cost,
    model:         model,
  };
}

// ---------------------------------------------------------------------------
// Cost estimate — matches the pricing matrix in the Radar v2 master plan
// ---------------------------------------------------------------------------

function estimateImpl(params: EstimateParams): CostEstimate {
  const tokens_in_est  = params.empresas_count * 6500;
  const tokens_out_est = params.empresas_count * 800;
  const cached_percentage = params.empresas_count >= 2 ? 0.3 : 0;

  // Effective input billed accounts for ~10% rate for cache reads (90% discount)
  const cached_tokens   = tokens_in_est * cached_percentage;
  const uncached_tokens = tokens_in_est - cached_tokens;
  const cost_input  = (uncached_tokens * PRICE_INPUT_PER_M + cached_tokens * PRICE_INPUT_PER_M * 0.1) / 1_000_000;
  const cost_output = (tokens_out_est * PRICE_OUTPUT_PER_M) / 1_000_000;

  return {
    tokens_in_est,
    tokens_out_est,
    cost_usd_est: cost_input + cost_output,
    cached_percentage,
  };
}

// ---------------------------------------------------------------------------
// Factory + singleton
// ---------------------------------------------------------------------------

function createClaudeProvider(): AIProvider {
  return {
    name:  'claude',
    model: CLAUDE_MODEL,

    async scan(params, emit) {
      return scanImpl(params, emit);
    },

    estimate(params) {
      return estimateImpl(params);
    },

    supports(feature: SupportedFeature): boolean {
      switch (feature) {
        case 'web_search':
        case 'streaming':
        case 'batch':
        case 'prompt_caching':
          return true;
        default:
          return false;
      }
    },
  };
}

export const claudeProvider: AIProvider = createClaudeProvider();
