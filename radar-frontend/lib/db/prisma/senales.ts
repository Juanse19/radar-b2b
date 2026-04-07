// lib/db/prisma/senales.ts
import { prisma } from './client';
import type { SenalRow, GetSenalesFilter } from '../types';

function toRow(r: {
  id: number; empresa_id: number | null; ejecucion_id: number | null;
  empresa_nombre: string; empresa_pais: string | null; linea_negocio: string;
  tier: string | null; radar_activo: boolean; tipo_senal: string | null;
  descripcion: string | null; fuente: string | null; fuente_url: string | null;
  score_radar: number; ventana_compra: string | null; prioridad_comercial: string | null;
  motivo_descarte: string | null; ticket_estimado: string | null;
  razonamiento_agente: string | null; created_at: Date;
}): SenalRow {
  return { ...r, created_at: r.created_at.toISOString() };
}

const ALLOWED_SORT = new Set([
  'score_radar', 'created_at', 'empresa_nombre', 'linea_negocio',
]);

export async function getSenales(filter: GetSenalesFilter): Promise<SenalRow[]> {
  const {
    linea, pais, activos,
    scoreGte, scoreLt, from, to,
    sort = 'score_radar', order = 'desc',
    limit = 100, offset = 0,
  } = filter;

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'score_radar';

  const scoreFilter: { gte?: number; lt?: number } = {};
  if (scoreGte !== undefined) scoreFilter.gte = scoreGte;
  if (scoreLt  !== undefined) scoreFilter.lt  = scoreLt;

  const rows = await prisma.senal.findMany({
    where: {
      ...(linea && linea !== 'ALL' ? { linea_negocio: linea }           : {}),
      ...(pais                     ? { empresa_pais: { contains: pais } } : {}),
      ...(activos                  ? { radar_activo: true }               : {}),
      ...(Object.keys(scoreFilter).length ? { score_radar: scoreFilter } : {}),
      ...(from || to ? {
        created_at: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    },
    orderBy: { [safeSort]: order },
    take: limit,
    skip: offset,
  });
  return rows.map(toRow);
}

export async function crearSenal(data: {
  empresa_nombre:       string;
  empresa_pais?:        string | null;
  linea_negocio:        string;
  tier?:                string | null;
  radar_activo?:        boolean;
  tipo_senal?:          string | null;
  descripcion?:         string | null;
  fuente?:              string | null;
  fuente_url?:          string | null;
  score_radar?:         number;
  ventana_compra?:      string | null;
  prioridad_comercial?: string | null;
  motivo_descarte?:     string | null;
  ticket_estimado?:     string | null;
  razonamiento_agente?: string | null;
  empresa_id?:          number | null;
  ejecucion_id?:        number | null;
}): Promise<SenalRow> {
  const row = await prisma.senal.create({
    data: {
      empresa_nombre:      data.empresa_nombre,
      empresa_pais:        data.empresa_pais        ?? null,
      linea_negocio:       data.linea_negocio,
      tier:                data.tier                ?? null,
      radar_activo:        data.radar_activo        ?? false,
      tipo_senal:          data.tipo_senal          ?? null,
      descripcion:         data.descripcion         ?? null,
      fuente:              data.fuente              ?? null,
      fuente_url:          data.fuente_url          ?? null,
      score_radar:         Number(data.score_radar  ?? 0),
      ventana_compra:      data.ventana_compra      ?? null,
      prioridad_comercial: data.prioridad_comercial ?? null,
      motivo_descarte:     data.motivo_descarte     ?? null,
      ticket_estimado:     data.ticket_estimado     ?? null,
      razonamiento_agente: data.razonamiento_agente ?? null,
      empresa_id:          data.empresa_id          ?? null,
      ejecucion_id:        data.ejecucion_id        ?? null,
    },
  });
  return toRow(row);
}

export async function getSenalesSlim(): Promise<{ linea_negocio: string; score_radar: number; radar_activo: boolean }[]> {
  return prisma.senal.findMany({
    select: { linea_negocio: true, score_radar: true, radar_activo: true },
  });
}

export async function countSenalesOroHoy(): Promise<number> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return prisma.senal.count({
    where: { score_radar: { gte: 8 }, created_at: { gte: hoy } },
  });
}
