// lib/db/prisma/prospeccion.ts
import { prisma } from './client';
import type {
  ProspeccionLogRow,
  CrearProspeccionLogData,
  GetProspeccionLogsFilter,
  ActualizarProspeccionLogData,
} from '../types';

function toRow(r: {
  id: number; empresa_nombre: string; linea: string;
  n8n_execution_id: string | null; estado: string;
  contactos_encontrados: number; created_at: Date; finished_at: Date | null;
}): ProspeccionLogRow {
  return {
    ...r,
    created_at:  r.created_at.toISOString(),
    finished_at: r.finished_at?.toISOString() ?? null,
  };
}

export async function crearProspeccionLogs(
  entries: CrearProspeccionLogData[],
): Promise<{ id: number }[]> {
  const rows = await Promise.all(
    entries.map(e =>
      prisma.prospeccionLog.create({
        data: {
          empresa_nombre:   e.empresa_nombre,
          linea:            e.linea,
          n8n_execution_id: e.n8n_execution_id,
          estado:           'running',
        },
      }),
    ),
  );
  return rows.map(r => ({ id: r.id }));
}

export async function getProspeccionLogs(filter: GetProspeccionLogsFilter): Promise<ProspeccionLogRow[]> {
  const { linea, estado, limit = 100 } = filter;
  const rows = await prisma.prospeccionLog.findMany({
    where: {
      ...(linea && linea !== 'ALL' ? { linea } : {}),
      ...(estado ? { estado } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: Math.min(limit, 200),
  });
  return rows.map(toRow);
}

export async function actualizarProspeccionLog(
  id: number,
  data: ActualizarProspeccionLogData,
): Promise<{ id: number }> {
  const updated = await prisma.prospeccionLog.update({
    where: { id },
    data: {
      ...(data.estado                                          ? { estado: data.estado }                         : {}),
      ...(typeof data.contactos_encontrados === 'number'       ? { contactos_encontrados: data.contactos_encontrados } : {}),
      ...(data.finished_at                                     ? { finished_at: new Date(data.finished_at) }     : {}),
    },
  });
  return { id: updated.id };
}
