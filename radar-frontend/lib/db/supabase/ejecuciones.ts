// lib/db/supabase/ejecuciones.ts
import 'server-only';
import { adminDb } from './admin';
import type { EjecucionRow, AgentType, PipelineDTO } from '../types';

type SupabaseEjecucionRow = Omit<EjecucionRow, 'parametros'> & {
  parametros: Record<string, unknown> | string | null;
};

function toRow(r: SupabaseEjecucionRow): EjecucionRow {
  return {
    id:                  r.id,
    n8n_execution_id:    r.n8n_execution_id,
    linea_negocio:       r.linea_negocio,
    batch_size:          r.batch_size,
    estado:              r.estado,
    trigger_type:        r.trigger_type,
    parametros:          typeof r.parametros === 'string' ? JSON.parse(r.parametros) : r.parametros,
    error_msg:           r.error_msg,
    started_at:          r.started_at,
    finished_at:         r.finished_at,
    agent_type:          (r.agent_type as AgentType) ?? 'calificador',
    pipeline_id:         r.pipeline_id,
    parent_execution_id: r.parent_execution_id,
    current_step:        r.current_step,
  };
}

export async function registrarEjecucion(params: {
  n8n_execution_id?:    string;
  linea_negocio?:       string;
  batch_size?:          number;
  trigger_type?:        string;
  parametros?:          Record<string, unknown>;
  agent_type?:          AgentType;
  pipeline_id?:         string;
  parent_execution_id?: number;
}): Promise<{ id: number; pipeline_id: string }> {
  const pipelineId = params.pipeline_id ?? crypto.randomUUID();
  const { data, error } = await adminDb.from('ejecuciones').insert({
    n8n_execution_id:    params.n8n_execution_id,
    linea_negocio:       params.linea_negocio,
    batch_size:          params.batch_size,
    trigger_type:        params.trigger_type ?? 'manual',
    parametros:          params.parametros ?? null,
    estado:              'running',
    agent_type:          params.agent_type ?? 'calificador',
    pipeline_id:         pipelineId,
    parent_execution_id: params.parent_execution_id ?? null,
  }).select('id').single();
  if (error) throw new Error(`Supabase registrarEjecucion: ${error.message}`);
  return { id: (data as { id: number }).id, pipeline_id: pipelineId };
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado:           string;
    finished_at:      string;
    error_msg:        string;
    n8n_execution_id: string;
    current_step:     string;
  }>,
): Promise<void> {
  const { error } = await adminDb.from('ejecuciones').update(updates).eq('id', id);
  if (error) throw new Error(`Supabase actualizarEjecucion: ${error.message}`);
}

export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionRow[]> {
  const { data, error } = await adminDb.from('ejecuciones')
    .select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase getEjecucionesRecientes: ${error.message}`);
  return ((data ?? []) as SupabaseEjecucionRow[]).map(toRow);
}

export async function getEjecucionById(idOrN8nId: string | number): Promise<EjecucionRow | null> {
  const numericId = typeof idOrN8nId === 'number' ? idOrN8nId : Number(idOrN8nId);
  if (Number.isFinite(numericId)) {
    const { data } = await adminDb.from('ejecuciones').select('*').eq('id', numericId).maybeSingle();
    if (data) return toRow(data as SupabaseEjecucionRow);
  }
  const { data } = await adminDb.from('ejecuciones')
    .select('*').eq('n8n_execution_id', String(idOrN8nId))
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  return data ? toRow(data as SupabaseEjecucionRow) : null;
}

/** Executions running for longer than this are considered timed out (30 min). */
const EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;

export async function resolveEjecucion(
  id: number,
  estado: 'success' | 'error' | 'timeout',
  error_msg?: string,
): Promise<void> {
  const { error } = await adminDb.from('ejecuciones').update({
    estado,
    finished_at: new Date().toISOString(),
    error_msg: error_msg ?? null,
  }).eq('id', id);
  if (error) throw new Error(`Supabase resolveEjecucion: ${error.message}`);
}

export async function getPipelines(opts: {
  status?: 'running' | 'all';
  limit?:  number;
} = {}): Promise<PipelineDTO[]> {
  let query = adminDb.from('ejecuciones')
    .select('*')
    .order('started_at', { ascending: false })
    .limit((opts.limit ?? 20) * 3);
  if (opts.status === 'running') {
    query = query.eq('estado', 'running');
  }
  const { data, error } = await query;
  if (error) throw new Error(`Supabase getPipelines: ${error.message}`);

  const now = Date.now();

  // Auto-expire executions stuck in 'running' for > 30 minutes.
  // Fire-and-forget — non-blocking, doesn't affect the response.
  const stuckIds = (data ?? [])
    .filter(r => r.estado === 'running'
      && (now - Date.parse(r.started_at)) > EXECUTION_TIMEOUT_MS)
    .map(r => r.id);
  if (stuckIds.length > 0) {
    void adminDb.from('ejecuciones')
      .update({ estado: 'timeout', finished_at: new Date().toISOString(), error_msg: 'Sin respuesta del agente (timeout 30 min)' })
      .in('id', stuckIds);
  }

  const rows = (data ?? []) as SupabaseEjecucionRow[];

  const groups = new Map<string, EjecucionRow[]>();
  for (const raw of rows) {
    // Treat auto-expired rows as 'error' for UI purposes without waiting for DB update.
    const isStuck = stuckIds.includes(raw.id);
    const row = toRow({ ...raw, estado: isStuck ? 'error' : raw.estado });
    const key = row.pipeline_id ?? `solo-${row.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const pipelines: PipelineDTO[] = [];
  for (const [pipelineId, agents] of groups.entries()) {
    agents.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
    const root = agents[0]!;
    const allDone = agents.every(a => a.estado === 'success' || a.estado === 'error');
    const anyError = agents.some(a => a.estado === 'error');
    const anyRunning = agents.some(a => a.estado === 'running');
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
