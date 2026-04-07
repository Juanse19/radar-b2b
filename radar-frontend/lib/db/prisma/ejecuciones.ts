// lib/db/prisma/ejecuciones.ts
import { prisma } from './client';
import type { EjecucionRow } from '../types';

function toRow(r: {
  id: number; n8n_execution_id: string | null; linea_negocio: string | null;
  batch_size: number | null; estado: string; trigger_type: string;
  parametros: string | null; error_msg: string | null;
  started_at: Date; finished_at: Date | null;
}): EjecucionRow {
  return {
    id:               r.id,
    n8n_execution_id: r.n8n_execution_id,
    linea_negocio:    r.linea_negocio,
    batch_size:       r.batch_size,
    estado:           r.estado,
    trigger_type:     r.trigger_type,
    parametros:       r.parametros ? (JSON.parse(r.parametros) as Record<string, unknown>) : null,
    error_msg:        r.error_msg,
    started_at:       r.started_at.toISOString(),
    finished_at:      r.finished_at?.toISOString() ?? null,
  };
}

export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?: string;
  batch_size?: number;
  trigger_type?: string;
  parametros?: Record<string, unknown>;
}): Promise<number> {
  const row = await prisma.ejecucion.create({
    data: {
      n8n_execution_id: params.n8n_execution_id,
      linea_negocio:    params.linea_negocio,
      batch_size:       params.batch_size,
      trigger_type:     params.trigger_type ?? 'manual',
      parametros:       params.parametros ? JSON.stringify(params.parametros) : null,
      estado:           'running',
    },
  });
  return row.id;
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado:            string;
    finished_at:       string;
    error_msg:         string;
    n8n_execution_id:  string;
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
