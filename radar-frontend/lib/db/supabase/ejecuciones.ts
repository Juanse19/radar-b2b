// lib/db/supabase/ejecuciones.ts
import 'server-only';
import { adminDb } from './admin';
import type { EjecucionRow } from '../types';

export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?:    string;
  batch_size?:       number;
  trigger_type?:     string;
  parametros?:       Record<string, unknown>;
}): Promise<number> {
  const { data, error } = await adminDb.from('ejecuciones').insert({
    n8n_execution_id: params.n8n_execution_id,
    linea_negocio:    params.linea_negocio,
    batch_size:       params.batch_size,
    trigger_type:     params.trigger_type ?? 'manual',
    parametros:       params.parametros ?? null,
    estado:           'running',
  }).select('id').single();
  if (error) throw new Error(`Supabase registrarEjecucion: ${error.message}`);
  return (data as { id: number }).id;
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado:           string;
    finished_at:      string;
    error_msg:        string;
    n8n_execution_id: string;
  }>,
): Promise<void> {
  const { error } = await adminDb.from('ejecuciones').update(updates).eq('id', id);
  if (error) throw new Error(`Supabase actualizarEjecucion: ${error.message}`);
}

export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionRow[]> {
  const { data, error } = await adminDb.from('ejecuciones')
    .select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase getEjecucionesRecientes: ${error.message}`);
  return (data ?? []) as EjecucionRow[];
}
