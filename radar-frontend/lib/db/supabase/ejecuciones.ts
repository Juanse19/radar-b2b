// lib/db/supabase/ejecuciones.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { EjecucionRow, WorkflowEnum, EstadoEjecucionEnum } from '../types';

const S = SCHEMA;

export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?:    string;
  workflow?:         WorkflowEnum;
  sub_linea_id?:     number;
  batch_size?:       number;
  trigger_type?:     string;
  parametros?:       Record<string, unknown>;
}): Promise<number> {
  const parametros = params.parametros ? JSON.stringify(params.parametros) : null;
  const [row] = await pgQuery<{ id: number }>(
    `INSERT INTO ${S}.ejecuciones
       (n8n_execution_id, workflow, sub_linea_id, batch_size, trigger_type, parametros, estado)
     VALUES (${pgLit(params.n8n_execution_id ?? null)}, ${pgLit(params.workflow ?? 'manual')},
             ${pgLit(params.sub_linea_id ?? null)}, ${pgLit(params.batch_size ?? null)},
             ${pgLit(params.trigger_type ?? 'manual')},
             ${parametros ? `'${parametros.replace(/'/g, "''")}'::jsonb` : 'NULL'},
             'running')
     RETURNING id`
  );
  if (!row) throw new Error('registrarEjecucion: no row returned');
  return row.id;
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado: EstadoEjecucionEnum | string;
    finished_at: string;
    error_msg: string;
    n8n_execution_id: string;
    total_empresas_procesadas: number;
    tokens_totales: number;
    costo_total_usd: number;
  }>,
): Promise<void> {
  const sets = Object.entries(updates).map(([k, v]) => `${k} = ${pgLit(v)}`);
  if (sets.length === 0) return;
  await pgQuery(
    `UPDATE ${S}.ejecuciones SET ${sets.join(', ')} WHERE id = ${pgLit(id)}`
  );
}

export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionRow[]> {
  return pgQuery<EjecucionRow>(
    `SELECT * FROM ${S}.ejecuciones ORDER BY started_at DESC LIMIT ${pgLit(limit)}`
  );
}
