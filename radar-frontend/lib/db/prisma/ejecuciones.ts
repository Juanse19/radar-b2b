// lib/db/prisma/ejecuciones.ts
import { prisma } from './client';
import type { EjecucionRow, AgentType, PipelineDTO } from '../types';

type PrismaEjecucionRow = {
  id: number;
  n8n_execution_id: string | null;
  linea_negocio: string | null;
  batch_size: number | null;
  estado: string;
  trigger_type: string;
  parametros: string | null;
  error_msg: string | null;
  started_at: Date;
  finished_at: Date | null;
  agent_type: string;
  pipeline_id: string | null;
  parent_execution_id: number | null;
  current_step: string | null;
};

function toRow(r: PrismaEjecucionRow): EjecucionRow {
  return {
    id:                  r.id,
    n8n_execution_id:    r.n8n_execution_id,
    linea_negocio:       r.linea_negocio,
    batch_size:          r.batch_size,
    estado:              r.estado,
    trigger_type:        r.trigger_type,
    parametros:          r.parametros ? (JSON.parse(r.parametros) as Record<string, unknown>) : null,
    error_msg:           r.error_msg,
    started_at:          r.started_at.toISOString(),
    finished_at:         r.finished_at?.toISOString() ?? null,
    agent_type:          (r.agent_type as AgentType) ?? 'calificador',
    pipeline_id:         r.pipeline_id,
    parent_execution_id: r.parent_execution_id,
    current_step:        r.current_step,
  };
}

export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?: string;
  batch_size?: number;
  trigger_type?: string;
  parametros?: Record<string, unknown>;
  agent_type?: AgentType;
  pipeline_id?: string;
  parent_execution_id?: number;
}): Promise<{ id: number; pipeline_id: string }> {
  // Always have a pipeline_id — if the caller didn't provide one (e.g. manual
  // single-agent fire), generate a fresh uuid v4 so the tracker can group it.
  const pipelineId = params.pipeline_id ?? crypto.randomUUID();
  const row = await prisma.ejecucion.create({
    data: {
      n8n_execution_id:    params.n8n_execution_id,
      linea_negocio:       params.linea_negocio,
      batch_size:          params.batch_size,
      trigger_type:        params.trigger_type ?? 'manual',
      parametros:          params.parametros ? JSON.stringify(params.parametros) : null,
      estado:              'running',
      agent_type:          params.agent_type ?? 'calificador',
      pipeline_id:         pipelineId,
      parent_execution_id: params.parent_execution_id,
    },
  });
  return { id: row.id, pipeline_id: pipelineId };
}

export async function resolveEjecucion(
  id: number,
  estado: 'success' | 'error' | 'timeout',
  error_msg?: string,
): Promise<void> {
  await prisma.ejecucion.update({
    where: { id },
    data: { estado, finished_at: new Date(), error_msg: error_msg ?? null },
  });
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado:            string;
    finished_at:       string;
    error_msg:         string;
    n8n_execution_id:  string;
    current_step:      string;
  }>,
): Promise<void> {
  await prisma.ejecucion.update({
    where: { id },
    data: {
      ...updates,
      ...(updates.finished_at ? { finished_at: new Date(updates.finished_at) } : {}),
    },
  });
}

export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionRow[]> {
  const rows = await prisma.ejecucion.findMany({
    orderBy: { started_at: 'desc' },
    take: limit,
  });
  return rows.map(toRow);
}

/** Returns the local row matching either numeric id or n8n_execution_id. */
export async function getEjecucionById(idOrN8nId: string | number): Promise<EjecucionRow | null> {
  const numericId = typeof idOrN8nId === 'number' ? idOrN8nId : Number(idOrN8nId);
  if (Number.isFinite(numericId)) {
    const r = await prisma.ejecucion.findUnique({ where: { id: numericId } });
    if (r) return toRow(r);
  }
  const r = await prisma.ejecucion.findFirst({
    where: { n8n_execution_id: String(idOrN8nId) },
    orderBy: { started_at: 'desc' },
  });
  return r ? toRow(r) : null;
}

/** Returns ejecuciones grouped by pipeline_id, newest pipelines first.
 *  Used by GET /api/executions to feed the tracker tray. */
export async function getPipelines(opts: {
  status?: 'running' | 'all';
  limit?: number;
} = {}): Promise<PipelineDTO[]> {
  const where = opts.status === 'running'
    ? { estado: { in: ['running', 'waiting'] } }
    : {};
  // Find the most recent rows (limit ~3x because each pipeline can have up to
  // 3 rows when WF01→02→03 cascade — we group then trim).
  const rows = await prisma.ejecucion.findMany({
    where,
    orderBy: { started_at: 'desc' },
    take: (opts.limit ?? 20) * 3,
  });

  // Group by pipeline_id (rows without one go to a synthetic group keyed by id).
  const groups = new Map<string, EjecucionRow[]>();
  for (const r of rows) {
    const row = toRow(r);
    const key = row.pipeline_id ?? `solo-${row.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const now = Date.now();
  const pipelines: PipelineDTO[] = [];
  for (const [pipelineId, agents] of groups.entries()) {
    agents.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
    const root = agents[0]!;
    const allDone = agents.every(a => a.estado === 'success' || a.estado === 'error');
    const anyError = agents.some(a => a.estado === 'error');
    const anyRunning = agents.some(a => a.estado === 'running' || a.estado === 'waiting');
    const status: PipelineDTO['status'] =
      anyError && allDone ? 'error'
      : allDone ? 'success'
      : anyRunning ? 'running'
      : 'partial';
    pipelines.push({
      pipeline_id: pipelineId,
      started_at:  root.started_at,
      status,
      agents: agents.map(a => ({
        ...a,
        elapsed_seconds: Math.max(0, Math.floor(
          ((a.finished_at ? Date.parse(a.finished_at) : now) - Date.parse(a.started_at)) / 1000,
        )),
      })),
    });
  }
  pipelines.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  return pipelines.slice(0, opts.limit ?? 20);
}
