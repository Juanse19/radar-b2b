/**
 * calificador/engine.ts — Orchestrator for a single company qualification.
 *
 * Flow:
 *   1. Optionally retrieve RAG context (Pinecone).
 *   2. Call provider.calificar() — streams thinking events via emit.
 *   3. Validate LLM JSON with Zod schema (1 retry on failure).
 *   4. Calculate scoreTotal + tier (deterministic).
 *   5. Emit dim_scored + tier_assigned SSE events.
 *   6. Persist row to matec_radar.calificaciones.
 *   7. Return CalificacionOutput.
 */
import 'server-only';
import { retrieveContext, buildRagBlock } from '@/lib/comercial/rag';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { getProvider } from '@/lib/comercial/providers';
import { CalificacionLLMResponseSchema } from './schema';
import { calcularScore, asignarTier, categoricoToScore } from './scoring';
import type {
  CalificacionInput,
  CalificacionOutput,
  CalificacionRow,
  Dimension,
  DimScores,
  RagContext,
} from './types';
import type { SSEEmitter } from '@/lib/comercial/providers/types';

const S = SCHEMA;

// ---------------------------------------------------------------------------
// Empresa ID lookup
// ---------------------------------------------------------------------------

async function resolveEmpresaId(empresa: string): Promise<number | null> {
  try {
    const rows = await pgQuery<{ id: number }>(
      `SELECT id FROM ${S}.empresas
        WHERE LOWER(company_name) = LOWER(${pgLit(empresa)})
        LIMIT 1`,
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB persist
// ---------------------------------------------------------------------------

async function persistCalificacion(row: CalificacionRow): Promise<void> {
  await pgQuery(`
    INSERT INTO ${S}.calificaciones (
      empresa_id, session_id, sub_linea_id, linea_negocio, provider,
      score_impacto, score_multiplanta, score_recurrencia, score_referente,
      score_acceso_al_decisor,
      score_anio, score_ticket, score_prioridad,
      score_cuenta_estrategica,
      score_total, tier_calculado,
      razonamiento_agente, perfil_web_summary, perfil_web_sources,
      rag_context_used, raw_llm_json, dimensiones,
      modelo_llm, tokens_input, tokens_output, costo_usd,
      is_v2
    ) VALUES (
      ${row.empresa_id ?? 'NULL'},
      ${row.session_id ? pgLit(row.session_id) : 'NULL'},
      ${row.sub_linea_id ?? 'NULL'},
      ${row.linea_negocio ? pgLit(row.linea_negocio) : 'NULL'},
      ${row.provider ? pgLit(row.provider) : 'NULL'},
      ${row.score_impacto}, ${row.score_multiplanta}, ${row.score_recurrencia},
      ${row.score_referente}, ${row.score_acceso_al_decisor},
      ${row.score_anio}, ${row.score_ticket ?? 'NULL'}, ${row.score_prioridad},
      ${row.score_cuenta_estrategica},
      ${row.score_total}, ${pgLit(row.tier_calculado)}::${S}.tier_enum,
      ${row.razonamiento_agente ? pgLit(row.razonamiento_agente) : 'NULL'},
      ${row.perfil_web_summary ? pgLit(row.perfil_web_summary) : 'NULL'},
      ${row.perfil_web_sources ? pgLit(JSON.stringify(row.perfil_web_sources)) + '::jsonb' : 'NULL'},
      ${row.rag_context_used ? pgLit(JSON.stringify(row.rag_context_used)) + '::jsonb' : 'NULL'},
      ${row.raw_llm_json ? pgLit(JSON.stringify(row.raw_llm_json)) + '::jsonb' : 'NULL'},
      ${row.dimensiones ? pgLit(JSON.stringify(row.dimensiones)) + '::jsonb' : 'NULL'},
      ${row.modelo_llm ? pgLit(row.modelo_llm) : 'NULL'},
      ${row.tokens_input ?? 'NULL'}, ${row.tokens_output ?? 'NULL'},
      ${row.costo_usd ?? 'NULL'},
      TRUE
    )
  `);
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export interface CalificadorEngineOptions {
  ragEnabled?: boolean;
  providerName?: string;
  apiKey?: string;
  model?: string;
}

export async function calificarEmpresa(
  input: CalificacionInput,
  opts: CalificadorEngineOptions = {},
  emit?: SSEEmitter,
): Promise<CalificacionOutput> {
  const startMs = Date.now();

  emit?.emit('empresa_started', {
    empresa: input.empresa,
    sessionId: input.sessionId,
    startedAt: new Date().toISOString(),
  });

  // 1. RAG context ────────────────────────────────────────────────────────────
  let ragContext: RagContext | undefined;
  if (opts.ragEnabled !== false) {
    try {
      const ctx = await retrieveContext(input.empresa, input.lineaNombre);
      ragContext = {
        similares: [],
        criterios: [],
        rawBlock: buildRagBlock(ctx),
      };
      emit?.emit('rag_context', {
        empresa: input.empresa,
        block_preview: ragContext.rawBlock.slice(0, 200),
      });
    } catch {
      // RAG is best-effort; continue without it.
    }
  }

  const inputWithRag: CalificacionInput = { ...input, ragContext };

  // 2. Provider call ──────────────────────────────────────────────────────────
  const provider = getProvider(opts.providerName ?? 'claude');

  emit?.emit('profiling_web', { empresa: input.empresa });

  let providerOutput = await provider.calificar(inputWithRag, emit);

  // 3. Validate + 1 retry ────────────────────────────────────────────────────
  let parsed = CalificacionLLMResponseSchema.safeParse(providerOutput.rawJson);
  if (!parsed.success) {
    emit?.emit('thinking', { empresa: input.empresa, chunk: '[retrying validation…]' });
    providerOutput = await provider.calificar(inputWithRag, emit);
    parsed = CalificacionLLMResponseSchema.safeParse(providerOutput.rawJson);
    if (!parsed.success) {
      throw new Error(`LLM returned invalid JSON for ${input.empresa}: ${parsed.error.message}`);
    }
  }

  const llmData = parsed.data;

  // 4. Score + tier (deterministic) ──────────────────────────────────────────
  // Map each categorical valor → numeric score via the user's scoring table.
  const dimEntries = Object.entries(llmData.dimensiones) as [
    Dimension,
    { valor: string; justificacion: string },
  ][];

  const scores = dimEntries.reduce<DimScores>((acc, [dim, detail]) => {
    acc[dim] = categoricoToScore(dim, detail.valor);
    return acc;
  }, {} as DimScores);

  const scoreTotal = calcularScore(scores);
  const tier = asignarTier(scoreTotal);

  // Build a UI-friendly dimensiones array enriched with derived scores.
  const dimensionesEnriched = dimEntries.map(([dim, detail]) => ({
    dim,
    valor: detail.valor,
    score: scores[dim],
    justificacion: detail.justificacion,
  }));

  // 5. Emit per-dimension scores ─────────────────────────────────────────────
  for (const item of dimensionesEnriched) {
    emit?.emit('dim_scored', {
      empresa: input.empresa,
      dim:     item.dim,
      value:   item.score,
      valor:   item.valor,
      justificacion: item.justificacion,
    });
  }

  emit?.emit('tier_assigned', {
    empresa: input.empresa,
    scoreTotal,
    tier,
    razonamientoPreview: llmData.razonamiento.slice(0, 200),
  });

  // 6. Persist ───────────────────────────────────────────────────────────────
  const empresaId = await resolveEmpresaId(input.empresa);

  const row: CalificacionRow = {
    empresa_id:               empresaId,
    session_id:               input.sessionId,
    sub_linea_id:             input.subLineaId ?? null,
    linea_negocio:            input.lineaNombre,
    provider:                 provider.name,
    score_impacto:            scores.impacto_presupuesto,
    score_multiplanta:        scores.multiplanta,
    score_recurrencia:        scores.recurrencia,
    score_referente:          scores.referente_mercado,
    score_acceso_al_decisor:  scores.acceso_al_decisor,
    score_anio:               scores.anio_objetivo,
    score_prioridad:          scores.prioridad_comercial,
    score_cuenta_estrategica: scores.cuenta_estrategica,
    // V3 retired ticket_estimado as a dimension; kept column nullable for legacy.
    score_ticket:             null,
    score_total:              scoreTotal,
    tier_calculado:           tier,
    razonamiento_agente:      llmData.razonamiento,
    perfil_web_summary:       llmData.perfilWeb.summary,
    perfil_web_sources:       llmData.perfilWeb.sources,
    rag_context_used:         ragContext ? { rawBlock: ragContext.rawBlock } : null,
    raw_llm_json:             providerOutput.rawJson,
    dimensiones:              dimensionesEnriched,
    modelo_llm:               providerOutput.model,
    tokens_input:             providerOutput.tokensInput,
    tokens_output:            providerOutput.tokensOutput,
    costo_usd:                providerOutput.costUsd,
    is_v2:                    true,
  };

  await persistCalificacion(row);

  const durationMs = Date.now() - startMs;
  emit?.emit('empresa_done', {
    empresa: input.empresa,
    durationMs,
    scoreTotal,
    tier,
    tokensInput:  providerOutput.tokensInput,
    tokensOutput: providerOutput.tokensOutput,
    costUsd:      providerOutput.costUsd,
  });

  return {
    scores,
    dimensiones: llmData.dimensiones,
    scoreTotal,
    tier,
    razonamiento: llmData.razonamiento,
    perfilWeb:   llmData.perfilWeb,
    rawJson:     providerOutput.rawJson,
    tokensInput:  providerOutput.tokensInput,
    tokensOutput: providerOutput.tokensOutput,
    costUsd:      providerOutput.costUsd,
    model:        providerOutput.model,
  };
}
