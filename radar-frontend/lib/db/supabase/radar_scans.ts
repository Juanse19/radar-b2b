// lib/db/supabase/radar_scans.ts
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from './pg_client';
import type { RadarScanRow, RadarFuenteRow, CrearRadarScanData, GetRadarScansFilter, SenalRow, GetSenalesFilter } from '../types';

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

// getSenales — reads from radar_scans (N8N WF02 writes here) and JOINs
// with empresas to populate empresa_nombre, empresa_pais, linea_negocio.
// Returns SenalRow[] so /api/signals and dashboard remain type-compatible.
export async function getSenales(filter: GetSenalesFilter): Promise<SenalRow[]> {
  const SORT_MAP: Record<string, string> = {
    'score_radar':   'rs.score_radar',
    'created_at':    'rs.created_at',
    'empresa_nombre':'e.company_name',
    'linea_negocio': 'rs.created_at',
  };

  const where: string[] = [];
  if (filter.activos)                where.push(`rs.radar_activo = TRUE`);
  if (filter.scoreGte !== undefined) where.push(`rs.score_radar >= ${pgLit(filter.scoreGte)}`);
  if (filter.scoreLt  !== undefined) where.push(`rs.score_radar < ${pgLit(filter.scoreLt)}`);
  if (filter.from)                   where.push(`rs.created_at >= ${pgLit(filter.from)}`);
  if (filter.to)                     where.push(`rs.created_at <= ${pgLit(filter.to)}`);
  if (filter.empresaId !== undefined) where.push(`rs.empresa_id = ${pgLit(filter.empresaId)}`);
  if (filter.pais)                   where.push(`e.pais ILIKE ${pgLit('%' + filter.pais + '%')}`);
  if (filter.linea && filter.linea !== 'ALL') {
    // linea_negocio is stored in sub_lineas_negocio via empresa_sub_lineas pivot
    where.push(`EXISTS (
      SELECT 1 FROM ${S}.empresa_sub_lineas esl2
      JOIN ${S}.sub_lineas_negocio sl2 ON sl2.id = esl2.sub_linea_id
      WHERE esl2.empresa_id = rs.empresa_id AND sl2.nombre = ${pgLit(filter.linea)}
    )`);
  }
  // ejecutado_por_id is added by migration _011 — only apply filter if provided
  if (filter.ejecutadoPorId) where.push(`rs.ejecutado_por_id = ${pgLit(filter.ejecutadoPorId)}`);

  const orderCol = SORT_MAP[filter.sort ?? ''] ?? 'rs.created_at';
  const orderDir = filter.order === 'asc' ? 'ASC' : 'DESC';
  const limit    = filter.limit  ?? 100;
  const offset   = filter.offset ?? 0;

  return pgQuery<SenalRow>(
    `SELECT
       rs.id,
       rs.empresa_id,
       rs.ejecucion_id,
       e.company_name            AS empresa_nombre,
       e.pais                    AS empresa_pais,
       (SELECT sl2.nombre
          FROM ${S}.empresa_sub_lineas esl2
          JOIN ${S}.sub_lineas_negocio sl2 ON sl2.id = esl2.sub_linea_id
         WHERE esl2.empresa_id = rs.empresa_id
         LIMIT 1)                AS linea_negocio,
       CASE rs.tier_compuesto::text
         WHEN 'A' THEN 'ORO'
         WHEN 'B' THEN 'MONITOREO'
         WHEN 'C' THEN 'ARCHIVO'
         ELSE NULL
       END                       AS tier,
       rs.radar_activo,
       rs.tipo_senal,
       rs.descripcion_senal      AS descripcion,
       NULL::text                AS fuente,
       NULL::text                AS fuente_url,
       rs.score_radar::numeric,
       rs.ventana_compra::text,
       rs.prioridad_comercial::text,
       rs.motivo_descarte,
       NULL::text                AS ticket_estimado,
       rs.razonamiento_agente,
       rs.created_at,
       rs.ejecutado_por_id,
       rs.ejecutado_por_nombre
     FROM ${S}.radar_scans rs
     JOIN ${S}.empresas e ON e.id = rs.empresa_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY ${orderCol} ${orderDir} NULLS LAST
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function getSenalesSlim(): Promise<{ id: number; empresa_id: number | null; score_radar: number; tier_compuesto: string | null; linea_negocio: string; radar_activo: boolean; created_at: string }[]> {
  return pgQuery(
    `SELECT
       rs.id,
       rs.empresa_id,
       rs.score_radar,
       rs.tier_compuesto::text AS tier_compuesto,
       rs.radar_activo,
       rs.created_at,
       (SELECT sl2.nombre
          FROM ${S}.empresa_sub_lineas esl2
          JOIN ${S}.sub_lineas_negocio sl2 ON sl2.id = esl2.sub_linea_id
         WHERE esl2.empresa_id = rs.empresa_id
         LIMIT 1) AS linea_negocio
     FROM ${S}.radar_scans rs
     ORDER BY created_at DESC LIMIT 200`
  );
}

export async function countSenalesOroHoy(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [row] = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${S}.radar_scans
     WHERE tier_compuesto = 'A'::${S}.tier_enum
       AND created_at >= ${pgLit(today + 'T00:00:00')}`
  );
  return parseInt(row?.count ?? '0', 10);
}

// crearSenal — accepts SenalRow-shaped input (from /api/signals POST)
// and maps to radar_scans columns. empresa_id is required; empresa_nombre
// is stored in the empresas table, not directly in radar_scans.
export async function crearSenal(data: {
  empresa_id?:          number | null;
  ejecucion_id?:        number | null;
  empresa_nombre?:      string;
  linea_negocio?:       string;
  tier?:                string | null;
  radar_activo?:        boolean;
  tipo_senal?:          string | null;
  descripcion?:         string | null;
  score_radar?:         number;
  ventana_compra?:      string | null;
  prioridad_comercial?: string | null;
  motivo_descarte?:     string | null;
  razonamiento_agente?: string | null;
}): Promise<SenalRow> {
  // Map SenalRow fields to radar_scans columns
  const insert: Record<string, unknown> = {
    score_radar:         data.score_radar    ?? 0,
    radar_activo:        data.radar_activo   ?? false,
    tipo_senal:          data.tipo_senal     ?? null,
    descripcion_senal:   data.descripcion    ?? null,
    motivo_descarte:     data.motivo_descarte ?? null,
    razonamiento_agente: data.razonamiento_agente ?? null,
    ventana_compra:      data.ventana_compra ?? 'desconocida',
    prioridad_comercial: data.prioridad_comercial ?? null,
  };
  if (data.empresa_id)   insert.empresa_id   = data.empresa_id;
  if (data.ejecucion_id) insert.ejecucion_id = data.ejecucion_id;
  // Map tier text to tier_enum (A/B/C)
  if (data.tier) {
    const tierMap: Record<string, string> = { 'ORO': 'A', 'MONITOREO': 'B', 'ARCHIVO': 'C' };
    insert.tier_compuesto = tierMap[data.tier] ?? null;
  }

  const cols = Object.keys(insert);
  const vals = cols.map((c) => pgLit(insert[c]));
  const [row] = await pgQuery<SenalRow>(
    `INSERT INTO ${S}.radar_scans (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearSenal: no row returned');
  return row;
}
