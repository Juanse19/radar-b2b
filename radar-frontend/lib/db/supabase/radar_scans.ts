// lib/db/supabase/radar_scans.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { RadarScanRow, RadarFuenteRow, CrearRadarScanData, GetRadarScansFilter } from '../types';

const S = SCHEMA;

export async function crearRadarScan(data: CrearRadarScanData): Promise<RadarScanRow> {
  const { fuentes, ...scanData } = data;
  const cols = Object.keys(scanData);
  const vals = cols.map((c) => pgLit((scanData as unknown as Record<string, unknown>)[c]));

  const [scan] = await pgQuery<RadarScanRow>(
    `INSERT INTO ${S}.radar_scans (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!scan) throw new Error('crearRadarScan: no row returned');

  if (fuentes && fuentes.length > 0) {
    for (const f of fuentes) {
      const fc = { ...f, radar_scan_id: scan.id };
      const fc_cols = Object.keys(fc);
      const fc_vals = fc_cols.map((c) => pgLit((fc as Record<string, unknown>)[c]));
      await pgQuery(
        `INSERT INTO ${S}.radar_fuentes (${fc_cols.join(', ')}) VALUES (${fc_vals.join(', ')})`
      );
    }
  }
  return scan;
}

export async function getRadarScansByEmpresa(empresaId: number, limit = 10): Promise<RadarScanRow[]> {
  return pgQuery<RadarScanRow>(
    `SELECT * FROM ${S}.radar_scans
     WHERE empresa_id = ${pgLit(empresaId)}
     ORDER BY created_at DESC LIMIT ${pgLit(limit)}`
  );
}

export async function getRadarScans(filter: GetRadarScansFilter): Promise<RadarScanRow[]> {
  const where: string[] = [];
  if (filter.empresaId !== undefined) where.push(`empresa_id = ${pgLit(filter.empresaId)}`);
  if (filter.radarActivo !== undefined) where.push(`radar_activo = ${pgLit(filter.radarActivo)}`);
  if (filter.ventanaCompra)  where.push(`ventana_compra = ${pgLit(filter.ventanaCompra)}`);
  if (filter.scoreGte !== undefined) where.push(`score_radar >= ${pgLit(filter.scoreGte)}`);
  if (filter.from)           where.push(`created_at >= ${pgLit(filter.from)}`);
  if (filter.to)             where.push(`created_at <= ${pgLit(filter.to)}`);

  const limit  = filter.limit  ?? 50;
  const offset = filter.offset ?? 0;

  return pgQuery<RadarScanRow>(
    `SELECT * FROM ${S}.radar_scans
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function getRadarFuentes(scanId: number): Promise<RadarFuenteRow[]> {
  return pgQuery<RadarFuenteRow>(
    `SELECT * FROM ${S}.radar_fuentes
     WHERE radar_scan_id = ${pgLit(scanId)}
     ORDER BY tavily_score DESC NULLS LAST`
  );
}

export async function getSenales(filter: {
  linea?: string; tier?: string; pais?: string; activos?: boolean;
  scoreGte?: number; scoreLt?: number; from?: string; to?: string;
  sort?: string; order?: 'asc' | 'desc'; limit?: number; offset?: number;
}): Promise<RadarScanRow[]> {
  const where: string[] = [];
  if (filter.activos)                where.push(`rs.radar_activo = TRUE`);
  if (filter.scoreGte !== undefined) where.push(`rs.score_radar >= ${pgLit(filter.scoreGte)}`);
  if (filter.scoreLt !== undefined)  where.push(`rs.score_radar < ${pgLit(filter.scoreLt)}`);
  if (filter.from)                   where.push(`rs.created_at >= ${pgLit(filter.from)}`);
  if (filter.to)                     where.push(`rs.created_at <= ${pgLit(filter.to)}`);

  const orderCol = filter.sort ?? 'rs.created_at';
  const orderDir = filter.order === 'asc' ? 'ASC' : 'DESC';
  const limit    = filter.limit  ?? 50;
  const offset   = filter.offset ?? 0;

  return pgQuery<RadarScanRow>(
    `SELECT rs.* FROM ${S}.radar_scans rs
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY ${orderCol} ${orderDir} NULLS LAST
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function getSenalesSlim(): Promise<Pick<RadarScanRow, 'id' | 'empresa_id' | 'score_radar' | 'tier_compuesto' | 'radar_activo' | 'created_at'>[]> {
  return pgQuery(
    `SELECT id, empresa_id, score_radar, tier_compuesto, radar_activo, created_at
     FROM ${S}.radar_scans
     ORDER BY created_at DESC LIMIT 200`
  );
}

export async function countSenalesOroHoy(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [row] = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${S}.radar_scans
     WHERE tier_compuesto = 'A' AND created_at >= ${pgLit(today + 'T00:00:00')}`
  );
  return parseInt(row?.count ?? '0', 10);
}

export async function crearSenal(data: Partial<RadarScanRow>): Promise<RadarScanRow> {
  const cols = Object.keys(data);
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<RadarScanRow>(
    `INSERT INTO ${S}.radar_scans (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearSenal: no row returned');
  return row;
}
