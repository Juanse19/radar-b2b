// lib/db/supabase/prospeccion.ts
import 'server-only';
import { adminDb } from './admin';
import type {
  ProspeccionLogRow,
  CrearProspeccionLogData,
  GetProspeccionLogsFilter,
  ActualizarProspeccionLogData,
} from '../types';

export async function crearProspeccionLogs(
  entries: CrearProspeccionLogData[],
): Promise<{ id: number }[]> {
  const rows = entries.map(e => ({
    empresa_nombre:   e.empresa_nombre,
    linea:            e.linea,
    n8n_execution_id: e.n8n_execution_id ?? null,
    estado:           'running',
  }));
  const { data, error } = await adminDb.from('prospeccion_logs').insert(rows).select('id');
  if (error) throw new Error(`Supabase crearProspeccionLogs: ${error.message}`);
  return (data ?? []) as { id: number }[];
}

export async function getProspeccionLogs(filter: GetProspeccionLogsFilter): Promise<ProspeccionLogRow[]> {
  const { linea, estado, limit = 100 } = filter;

  let q = adminDb.from('prospeccion_logs').select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));

  if (linea && linea !== 'ALL') q = q.eq('linea', linea);
  if (estado)                   q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) throw new Error(`Supabase getProspeccionLogs: ${error.message}`);
  return (data ?? []) as ProspeccionLogRow[];
}

export async function actualizarProspeccionLog(
  id: number,
  data: ActualizarProspeccionLogData,
): Promise<{ id: number }> {
  const payload: Record<string, unknown> = {};
  if (data.estado                                          ) payload.estado                = data.estado;
  if (typeof data.contactos_encontrados === 'number'       ) payload.contactos_encontrados = data.contactos_encontrados;
  if (data.finished_at                                     ) payload.finished_at           = data.finished_at;

  const { data: row, error } = await adminDb.from('prospeccion_logs').update(payload).eq('id', id).select('id').single();
  if (error) throw new Error(`Supabase actualizarProspeccionLog: ${error.message}`);
  return row as { id: number };
}
