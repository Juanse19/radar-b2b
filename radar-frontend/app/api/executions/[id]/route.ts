// app/api/executions/[id]/route.ts
//
// GET /api/executions/[id]
//   Returns the merged DTO of one ejecución:
//     1. Look up the local DB row by numeric id OR by n8n_execution_id.
//     2. Call n8n REST API for the live status / runData.
//     3. Persist any state transition (running → success/error/waiting +
//        latest current_step) so refreshes work without polling n8n again.
//     4. Return the merged shape.
//
// This endpoint is what `useExecutionPolling()` hits every 3-4s while a card
// is on screen. It HAS to tolerate n8n being down — in that case we return
// whatever we have locally so the UI never crashes.

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionStatus } from '@/lib/n8n';
import { getEjecucionById, actualizarEjecucion, resolveEjecucion } from '@/lib/db';
import type { EjecucionRow } from '@/lib/db/types';

/** PATCH /api/executions/[id] — manually resolve (dismiss) a stuck execution. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'id debe ser numérico' }, { status: 400 });
  }
  try {
    const body = await req.json() as { estado?: string; error_msg?: string };
    const estado = (['success', 'error', 'timeout'].includes(body.estado ?? '') ? body.estado : 'error') as 'success' | 'error' | 'timeout';
    await resolveEjecucion(numericId, estado, body.error_msg ?? 'Descartado manualmente');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
  }

  // ── 1. Read the local row ────────────────────────────────────────────────
  // We accept either:
  //   - the numeric id of the local `ejecuciones` row, or
  //   - the n8n execution id (string) — we look it up via the helper.
  let local: EjecucionRow | null = null;
  try {
    local = await getEjecucionById(id);
  } catch {
    // Tolerate DB errors — we'll still try to fetch from n8n.
  }

  // The id we send to n8n is the n8n_execution_id if we have a local row,
  // otherwise we trust the caller passed us an n8n id directly.
  const n8nId = local?.n8n_execution_id ?? id;

  // ── 2. Ask n8n for the live status (best-effort) ─────────────────────────
  let live: Awaited<ReturnType<typeof getExecutionStatus>> | null = null;
  try {
    live = await getExecutionStatus(n8nId);
  } catch {
    // n8n unreachable — fall through with whatever we have locally.
  }

  // ── 3. Persist any state transition ──────────────────────────────────────
  if (local && live) {
    const updates: Partial<{
      estado: string;
      finished_at: string;
      error_msg: string;
      n8n_execution_id: string;
      current_step: string;
    }> = {};
    if (live.status && live.status !== local.estado) {
      updates.estado = live.status;
    }
    if (live.currentStep && live.currentStep !== local.current_step) {
      updates.current_step = live.currentStep;
    }
    if (live.finishedAt && !local.finished_at) {
      updates.finished_at = live.finishedAt;
    }
    if (Object.keys(updates).length > 0) {
      try { await actualizarEjecucion(local.id, updates); } catch { /* swallow */ }
    }
  }

  // ── 4. Return the merged DTO ─────────────────────────────────────────────
  // Fields prefer LIVE values when present, otherwise fall back to local.
  return NextResponse.json({
    id:               local?.id ?? null,
    n8n_execution_id: n8nId,
    pipeline_id:      local?.pipeline_id ?? null,
    agent_type:       local?.agent_type ?? null,
    linea_negocio:    local?.linea_negocio ?? null,
    trigger_type:     local?.trigger_type ?? null,
    started_at:       local?.started_at ?? live?.startedAt ?? null,
    finished_at:      live?.finishedAt ?? local?.finished_at ?? null,
    status:           live?.status ?? local?.estado ?? 'running',
    current_step:     live?.currentStep ?? local?.current_step ?? null,
    empresas_procesadas: live?.empresasProcesadas ?? local?.batch_size ?? null,
    error_msg:        local?.error_msg ?? null,
  });
}
