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
import { buildSystemPrompt, resolveLineKeywords } from './shared-prompt';

const CALIFICACION_PRICE_PER_EMPRESA_IN  = 2500; // tokens estimated per empresa
const CALIFICACION_PRICE_PER_EMPRESA_OUT = 600;

const CLAUDE_MODEL       = 'claude-sonnet-4-6';
const PRICE_INPUT_PER_M  = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

// ---------------------------------------------------------------------------
// Internal scan implementation — mirrors the previous scanCompanyWithClaude
// ---------------------------------------------------------------------------

async function claudeFetchWithRetry(
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

  const keywords = params.keywords ?? resolveLineKeywords(line);

  const today = new Date();
  const cutoff = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const todayStr = today.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const cutoffStr = cutoff.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}${params.sublinea ? `\nSub-línea: ${params.sublinea}` : ''}
Palabras clave de búsqueda: ${keywords}

═══ VENTANA TEMPORAL — REGLA DURA ═══
Fecha de hoy: ${todayStr}
Fecha de corte de recencia: ${cutoffStr} (180 días atrás).
SOLO considera fuentes posteriores a ${cutoffStr}. Cualquier nota anterior, sin fase futura
verificable aún no iniciada, debe DESCARTARSE (radar_activo="No").
Si la fuente describe la obra como ya inaugurada / abierta / operando → DESCARTE.

TAREA: Busca señales de inversión FUTURA de esta empresa en LATAM para 2026-2028.
Ejecuta estas búsquedas en orden (incluye el operador after: para limitar recencia):
1. "${company.name}" ${keywords} 2026 2027 after:${cutoffISO}
2. "${company.name}" licitación contratación pública ${company.country} after:${cutoffISO}
3. "${company.name}" plan expansión CAPEX informe anual 2025 2026 prospectivo after:${cutoffISO}
4. "${company.name}" "nueva planta" OR "nueva sede" OR "ampliación" ${company.country} after:${cutoffISO}

Usa solo fuentes con proyectos confirmados POSTERIORES a ${cutoffStr}.
Ignora Wikipedia, redes sociales y ofertas de empleo. NO uses notas de 2024 o anteriores
salvo que mencionen explícitamente una fase futura aún no iniciada.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  // DB override: admin can edit the prompt from the UI; fall back to hardcoded if unavailable
  let systemPromptText = buildSystemPrompt(line, today);
  try {
    const { getAgentPrompt } = await import('@/lib/db/supabase/agent-prompts');
    const dbOverride = await getAgentPrompt('claude');
    if (dbOverride) systemPromptText = dbOverride;
  } catch { /* DB unavailable — use hardcoded */ }

  const baseBody = {
    model:      model,
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } }],
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
    const resp = await claudeFetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method:  'POST',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':    'web-search-2025-03-05,prompt-caching-2024-07-31',
          'content-type':      'application/json',
        },
        body: JSON.stringify({ ...baseBody, messages }),
      },
      emit,
      company.name,
    );

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

  const resultRaw = parseAgente1Response(rawText);
  const result = validateAgente1Result(resultRaw, today);
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
    result_raw:    resultRaw,
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

    async calificar(params: CalificacionInput, emit?: SSEEmitter): Promise<CalificacionOutput> {
      const apiKey = params.apiKey ?? process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('CLAUDE_API_KEY not set');
      const model = CLAUDE_MODEL;

      emit?.emit('thinking', { empresa: params.empresa, chunk: 'Iniciando calificación con Claude…' });

      const userMsg = buildCalificadorUserPrompt(params, params.ragContext);

      const body = {
        model,
        max_tokens: 2048,
        system: [
          { type: 'text', text: CALIFICADOR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }],
      };

      type Block = { type: string; text?: string; id?: string; name?: string; input?: { query?: string }; content?: Array<{ url?: string; title?: string }> };
      type TurnData = { content: Block[]; stop_reason: string; usage?: { input_tokens: number; output_tokens: number } };

      const messages: Array<{ role: string; content: unknown }> = [{ role: 'user', content: userMsg }];
      let lastData: TurnData = { content: [], stop_reason: '' };
      let totalInput = 0;
      let totalOutput = 0;

      for (let turn = 0; turn < 10; turn++) {
        const resp = await claudeFetchWithRetry(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'web-search-2025-03-05,prompt-caching-2024-07-31',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ ...body, messages }),
          },
          emit,
          params.empresa,
        );

        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Claude calificar ${resp.status}: ${err.slice(0, 300)}`);
        }

        lastData = await resp.json() as TurnData;
        totalInput  += lastData.usage?.input_tokens  ?? 0;
        totalOutput += lastData.usage?.output_tokens ?? 0;

        if (lastData.stop_reason === 'end_turn') break;

        if (lastData.stop_reason === 'tool_use') {
          for (const block of lastData.content) {
            if ((block.type === 'server_tool_use' || block.type === 'tool_use') && block.name === 'web_search') {
              const q = block.input?.query;
              if (q) emit?.emit('profiling_web', { empresa: params.empresa, query: q });
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

      const textBlock = [...(lastData.content ?? [])].reverse().find(b => b.type === 'text');
      if (!textBlock?.text) throw new Error(`No text in Claude calificar response for ${params.empresa}`);

      let rawJson: unknown;
      try {
        const cleaned = textBlock.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        rawJson = JSON.parse(cleaned);
      } catch {
        throw new Error(`Claude calificar returned non-JSON for ${params.empresa}`);
      }

      const cost = (totalInput * PRICE_INPUT_PER_M + totalOutput * PRICE_OUTPUT_PER_M) / 1_000_000;

      // Emit streaming chunks for thinking panel
      emit?.emit('thinking', { empresa: params.empresa, chunk: textBlock.text.slice(0, 100) });

      return {
        // V2: scores/dimensiones are recomputed by engine.ts from rawJson.dimensiones
        scores: {} as CalificacionOutput['scores'],
        dimensiones: (rawJson as { dimensiones?: CalificacionOutput['dimensiones'] }).dimensiones,
        scoreTotal: 0,    // calculated by engine.ts after validation
        tier: 'C',         // placeholder — engine.ts recalculates
        razonamiento: (rawJson as { razonamiento?: string }).razonamiento ?? '',
        perfilWeb: (rawJson as { perfilWeb?: CalificacionOutput['perfilWeb'] }).perfilWeb ?? { summary: '', sources: [] },
        rawJson,
        tokensInput: totalInput,
        tokensOutput: totalOutput,
        costUsd: cost,
        model,
      };
    },

    estimateCalificacion(empresas_count: number): CostEstimate {
      const tokens_in_est  = empresas_count * CALIFICACION_PRICE_PER_EMPRESA_IN;
      const tokens_out_est = empresas_count * CALIFICACION_PRICE_PER_EMPRESA_OUT;
      const cost_usd_est   = (tokens_in_est * PRICE_INPUT_PER_M + tokens_out_est * PRICE_OUTPUT_PER_M) / 1_000_000;
      return { tokens_in_est, tokens_out_est, cost_usd_est, cached_percentage: 0.3 };
    },
  };
}

export const claudeProvider: AIProvider = createClaudeProvider();
