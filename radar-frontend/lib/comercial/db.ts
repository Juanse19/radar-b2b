import 'server-only';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { ComercialResult, ComercialSession, ComercialResultsFilter } from './types';

const S = SCHEMA;

export async function createRadarV2Session(data: {
  id?:           string;
  user_id?:      string | null;
  linea_negocio: string;
  empresas_count: number;
}): Promise<ComercialSession> {
  const cols: string[] = ['linea_negocio', 'empresas_count'];
  const vals: string[] = [pgLit(data.linea_negocio), pgLit(data.empresas_count)];

  if (data.id      !== undefined) { cols.unshift('id');      vals.unshift(pgLit(data.id)); }
  if (data.user_id !== undefined) { cols.push('user_id');    vals.push(pgLit(data.user_id)); }

  const [row] = await pgQuery<ComercialSession>(
    `INSERT INTO ${S}.radar_v2_sessions (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('createRadarV2Session: no row returned');
  return row;
}

export async function updateSessionCost(sessionId: string, totalCost: number): Promise<void> {
  await pgQuery(
    `UPDATE ${S}.radar_v2_sessions SET total_cost_usd = ${pgLit(totalCost)} WHERE id = ${pgLit(sessionId)}`
  );
}

export async function getRadarV2Results(filter: ComercialResultsFilter): Promise<ComercialResult[]> {
  const where: string[] = [];

  if (filter.linea)        where.push(`linea_negocio = ${pgLit(filter.linea)}`);
  if (filter.radar_activo) where.push(`radar_activo = ${pgLit(filter.radar_activo)}`);
  if (filter.ventana)      where.push(`ventana_compra = ${pgLit(filter.ventana)}`);
  if (filter.from)         where.push(`created_at >= ${pgLit(filter.from)}`);
  if (filter.to)           where.push(`created_at <= ${pgLit(filter.to)}`);

  const limit  = Math.min(filter.limit  ?? 100, 500);
  const offset = filter.offset ?? 0;

  return pgQuery<ComercialResult>(
    `SELECT * FROM ${S}.radar_v2_results
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function countRadarV2Active(): Promise<number> {
  const [row] = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${S}.radar_v2_results WHERE radar_activo = 'Sí'`
  );
  return parseInt(row?.count ?? '0', 10);
}

export async function insertRadarV2Result(data: {
  session_id?:         string | null;
  empresa_id?:         number | null;
  empresa_evaluada:    string;
  radar_activo:        string;
  linea_negocio?:      string | null;
  tipo_senal?:         string | null;
  pais?:               string | null;
  empresa_o_proyecto?: string | null;
  descripcion_resumen?:string | null;
  criterios_cumplidos?:unknown[];
  total_criterios?:    number;
  ventana_compra?:     string | null;
  monto_inversion?:    string | null;
  fuente_link?:        string | null;
  fuente_nombre?:      string | null;
  fecha_senal?:        string | null;
  evaluacion_temporal?:string | null;
  observaciones?:      string | null;
  motivo_descarte?:    string | null;
  raw_json:            unknown;
  tokens_input?:       number;
  tokens_output?:      number;
  cost_usd?:           number;
}): Promise<ComercialResult> {
  const criterios = JSON.stringify(data.criterios_cumplidos ?? []);
  const rawJson   = JSON.stringify(data.raw_json);

  const [row] = await pgQuery<ComercialResult>(`
    INSERT INTO ${S}.radar_v2_results (
      session_id, empresa_id, empresa_evaluada, radar_activo,
      linea_negocio, tipo_senal, pais, empresa_o_proyecto,
      descripcion_resumen, criterios_cumplidos, total_criterios,
      ventana_compra, monto_inversion, fuente_link, fuente_nombre,
      fecha_senal, evaluacion_temporal, observaciones, motivo_descarte,
      raw_json, tokens_input, tokens_output, cost_usd
    ) VALUES (
      ${pgLit(data.session_id ?? null)}, ${pgLit(data.empresa_id ?? null)},
      ${pgLit(data.empresa_evaluada)}, ${pgLit(data.radar_activo)},
      ${pgLit(data.linea_negocio ?? null)}, ${pgLit(data.tipo_senal ?? null)},
      ${pgLit(data.pais ?? null)}, ${pgLit(data.empresa_o_proyecto ?? null)},
      ${pgLit(data.descripcion_resumen ?? null)}, ${pgLit(criterios)}::jsonb,
      ${pgLit(data.total_criterios ?? 0)},
      ${pgLit(data.ventana_compra ?? null)}, ${pgLit(data.monto_inversion ?? null)},
      ${pgLit(data.fuente_link ?? null)}, ${pgLit(data.fuente_nombre ?? null)},
      ${pgLit(data.fecha_senal ?? null)}, ${pgLit(data.evaluacion_temporal ?? null)},
      ${pgLit(data.observaciones ?? null)}, ${pgLit(data.motivo_descarte ?? null)},
      ${pgLit(rawJson)}::jsonb,
      ${pgLit(data.tokens_input ?? null)}, ${pgLit(data.tokens_output ?? null)},
      ${pgLit(data.cost_usd ?? null)}
    ) RETURNING *`
  );
  if (!row) throw new Error('insertRadarV2Result: no row returned');
  return row;
}

// ---------------------------------------------------------------------------
// v2 production additions
// ---------------------------------------------------------------------------

export async function updateSessionStats(
  sessionId: string,
  stats: {
    duration_ms?:       number | null;
    activas_count?:     number;
    descartadas_count?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  if (stats.duration_ms      !== undefined) sets.push(`duration_ms = ${pgLit(stats.duration_ms)}`);
  if (stats.activas_count    !== undefined) sets.push(`activas_count = ${pgLit(stats.activas_count)}`);
  if (stats.descartadas_count !== undefined) sets.push(`descartadas_count = ${pgLit(stats.descartadas_count)}`);
  if (!sets.length) return;
  await pgQuery(
    `UPDATE ${S}.radar_v2_sessions SET ${sets.join(', ')} WHERE id = ${pgLit(sessionId)}`,
  );
}

export async function getRadarV2Report(
  sessionId: string,
): Promise<{
  id: string;
  session_id: string;
  resumen: unknown;
  activas: unknown;
  descartes: unknown;
  markdown: string;
  created_at: string;
} | null> {
  type ReportRow = {
    id: string;
    session_id: string;
    resumen: unknown;
    activas: unknown;
    descartes: unknown;
    markdown: string;
    created_at: string;
  };
  const rows = await pgQuery<ReportRow>(
    `SELECT * FROM ${S}.radar_v2_reports WHERE session_id = ${pgLit(sessionId)} LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function insertRadarV2Report(data: {
  session_id: string;
  resumen:    unknown;
  activas:    unknown;
  descartes:  unknown;
  markdown:   string;
}): Promise<void> {
  await pgQuery(`
    INSERT INTO ${S}.radar_v2_reports (session_id, resumen, activas, descartes, markdown)
    VALUES (
      ${pgLit(data.session_id)},
      ${pgLit(JSON.stringify(data.resumen))}::jsonb,
      ${pgLit(JSON.stringify(data.activas))}::jsonb,
      ${pgLit(JSON.stringify(data.descartes))}::jsonb,
      ${pgLit(data.markdown)}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      resumen   = EXCLUDED.resumen,
      activas   = EXCLUDED.activas,
      descartes = EXCLUDED.descartes,
      markdown  = EXCLUDED.markdown
  `);
}
