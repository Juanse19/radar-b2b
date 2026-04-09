// lib/db/supabase/calificaciones.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { CalificacionRow, CrearCalificacionData, GetCalificacionesFilter, TierEnum } from '../types';

const S = SCHEMA;

export async function crearCalificacion(data: CrearCalificacionData): Promise<CalificacionRow> {
  const cols = Object.keys(data);
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<CalificacionRow>(
    `INSERT INTO ${S}.calificaciones (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearCalificacion: no row returned');
  return row;
}

export async function getCalificacionesByEmpresa(empresaId: number, limit = 20): Promise<CalificacionRow[]> {
  return pgQuery<CalificacionRow>(
    `SELECT * FROM ${S}.calificaciones
     WHERE empresa_id = ${pgLit(empresaId)}
     ORDER BY created_at DESC LIMIT ${pgLit(limit)}`
  );
}

export async function getCalificaciones(filter: GetCalificacionesFilter): Promise<CalificacionRow[]> {
  const where: string[] = [];
  if (filter.empresaId)     where.push(`empresa_id = ${pgLit(filter.empresaId)}`);
  if (filter.tierCalculado) where.push(`tier_calculado = ${pgLit(filter.tierCalculado)}`);
  if (filter.from)          where.push(`created_at >= ${pgLit(filter.from)}`);
  if (filter.to)            where.push(`created_at <= ${pgLit(filter.to)}`);

  const limit  = filter.limit  ?? 50;
  const offset = filter.offset ?? 0;

  return pgQuery<CalificacionRow>(
    `SELECT * FROM ${S}.calificaciones
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function getTopEmpresasByTier(
  tier: TierEnum,
  limit = 50,
): Promise<Array<{ empresa_id: number; score_total: number; tier_calculado: TierEnum; created_at: string }>> {
  const rows = await pgQuery<{ id: number; score_total_ultimo: number; tier_actual: TierEnum; ultima_calificacion_at: string }>(
    `SELECT id, score_total_ultimo, tier_actual, ultima_calificacion_at
     FROM ${S}.empresas
     WHERE tier_actual = ${pgLit(tier)}
     ORDER BY score_total_ultimo DESC NULLS LAST
     LIMIT ${pgLit(limit)}`
  );
  return rows.map((r) => ({
    empresa_id:     r.id,
    score_total:    r.score_total_ultimo ?? 0,
    tier_calculado: r.tier_actual,
    created_at:     r.ultima_calificacion_at ?? '',
  }));
}
