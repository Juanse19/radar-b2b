/**
 * metrics.ts — Aggregated metrics for Radar v2 sessions.
 * Queries matec_radar schema directly via pgQuery.
 */
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MetricsRange = 'day' | 'week' | 'month';

export interface ComercialMetrics {
  range: MetricsRange;
  totals: {
    scans:               number;
    activas:             number;
    descartadas:         number;
    costo_usd:           number;
    tokens_in:           number;
    tokens_out:          number;
    duracion_promedio_ms: number;
  };
  promedios: {
    costo_por_scan:  number;
    tokens_por_scan: number;
  };
  ratio_activas: number;
  por_linea: Array<{
    linea:   string;
    scans:   number;
    activas: number;
    costo:   number;
  }>;
  serie: Array<{
    bucket: string;
    scans:  number;
    costo:  number;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyMetrics(range: MetricsRange): ComercialMetrics {
  return {
    range,
    totals: {
      scans: 0, activas: 0, descartadas: 0,
      costo_usd: 0, tokens_in: 0, tokens_out: 0,
      duracion_promedio_ms: 0,
    },
    promedios:    { costo_por_scan: 0, tokens_por_scan: 0 },
    ratio_activas: 0,
    por_linea:    [],
    serie:        [],
  };
}

function intervalFor(range: MetricsRange): string {
  if (range === 'day')   return '1 day';
  if (range === 'week')  return '7 days';
  return '30 days';
}

/**
 * DATE_TRUNC granularity for the time series bucket.
 * day  → 'hour'  (24 data points)
 * week → 'day'   (7 data points)
 * month→ 'day'   (30 data points)
 */
function bucketFor(range: MetricsRange): string {
  return range === 'day' ? 'hour' : 'day';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function computeMetrics(range: MetricsRange): Promise<ComercialMetrics> {
  const interval = intervalFor(range);
  const bucket   = bucketFor(range);

  // 1) Totals — one row
  type TotalsRow = {
    scans:                string;
    activas:              string;
    descartadas:          string;
    costo_usd:            string | null;
    tokens_in:            string | null;
    tokens_out:           string | null;
    duracion_promedio_ms: string | null;
  };

  // Aggregate from radar_v2_results (source of truth) joined to sessions.
  // Fallback to sessions columns if results don't exist (should not happen).
  const totalsRows = await pgQuery<TotalsRow>(`
    SELECT
      COUNT(DISTINCT s.id)::text                                                         AS scans,
      COALESCE(SUM(agg.activas), 0)::text                                                AS activas,
      COALESCE(SUM(agg.descartadas), 0)::text                                            AS descartadas,
      COALESCE(SUM(agg.costo_usd), 0)::text                                              AS costo_usd,
      COALESCE(SUM(agg.tokens_in), 0)::text                                              AS tokens_in,
      COALESCE(SUM(agg.tokens_out), 0)::text                                             AS tokens_out,
      COALESCE(AVG(s.duration_ms) FILTER (WHERE s.duration_ms IS NOT NULL), 0)::text
                                                                                          AS duracion_promedio_ms
    FROM ${S}.radar_v2_sessions s
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) FILTER (WHERE radar_activo = 'Sí')::bigint  AS activas,
        COUNT(*) FILTER (WHERE radar_activo = 'No')::bigint  AS descartadas,
        COALESCE(SUM(cost_usd),     0)::numeric              AS costo_usd,
        COALESCE(SUM(tokens_input), 0)::bigint               AS tokens_in,
        COALESCE(SUM(tokens_output),0)::bigint               AS tokens_out
      FROM ${S}.radar_v2_results
      GROUP BY session_id
    ) agg ON agg.session_id = s.id
    WHERE s.created_at >= NOW() - INTERVAL ${pgLit(interval)}
  `);

  if (!totalsRows.length) return emptyMetrics(range);

  const t = totalsRows[0];
  const scans        = parseInt(t.scans        ?? '0', 10);
  const activas      = parseInt(t.activas      ?? '0', 10);
  const descartadas  = parseInt(t.descartadas  ?? '0', 10);
  const costoUsd     = parseFloat(t.costo_usd  ?? '0');
  const tokensIn     = parseInt(t.tokens_in    ?? '0', 10);
  const tokensOut    = parseInt(t.tokens_out   ?? '0', 10);
  const duracionProm = parseFloat(t.duracion_promedio_ms ?? '0');

  const totalTokens = tokensIn + tokensOut;

  // 2) Por línea
  type LineaRow = {
    linea:       string;
    scans:       string;
    activas:     string;
    descartadas: string;
    costo:       string | null;
  };

  const lineaRows = await pgQuery<LineaRow>(`
    SELECT
      s.linea_negocio                                                        AS linea,
      COUNT(DISTINCT s.id)::text                                             AS scans,
      COUNT(*) FILTER (WHERE r.radar_activo = 'Sí')::text                   AS activas,
      COUNT(*) FILTER (WHERE r.radar_activo = 'No')::text                   AS descartadas,
      COALESCE(SUM(r.cost_usd), 0)::text                                     AS costo
    FROM ${S}.radar_v2_sessions s
    LEFT JOIN ${S}.radar_v2_results r ON r.session_id = s.id
    WHERE s.created_at >= NOW() - INTERVAL ${pgLit(interval)}
    GROUP BY s.linea_negocio
    ORDER BY COUNT(DISTINCT s.id) DESC
  `);

  const porLinea = lineaRows.map((row) => ({
    linea:       row.linea       ?? 'Sin línea',
    scans:       parseInt(row.scans       ?? '0', 10),
    activas:     parseInt(row.activas     ?? '0', 10),
    descartadas: parseInt(row.descartadas ?? '0', 10),
    costo:       parseFloat(row.costo ?? '0'),
  }));

  // 3) Serie temporal
  type SerieRow = {
    bucket: string;
    scans:  string;
    costo:  string | null;
  };

  const serieRows = await pgQuery<SerieRow>(`
    SELECT
      DATE_TRUNC(${pgLit(bucket)}, s.created_at)::text   AS bucket,
      COUNT(DISTINCT s.id)::text                         AS scans,
      COALESCE(SUM(r.cost_usd), 0)::text                 AS costo
    FROM ${S}.radar_v2_sessions s
    LEFT JOIN ${S}.radar_v2_results r ON r.session_id = s.id
    WHERE s.created_at >= NOW() - INTERVAL ${pgLit(interval)}
    GROUP BY DATE_TRUNC(${pgLit(bucket)}, s.created_at)
    ORDER BY DATE_TRUNC(${pgLit(bucket)}, s.created_at) ASC
  `);

  const serie = serieRows.map((row) => ({
    bucket: row.bucket ?? '',
    scans:  parseInt(row.scans ?? '0', 10),
    costo:  parseFloat(row.costo ?? '0'),
  }));

  return {
    range,
    totals: {
      scans,
      activas,
      descartadas,
      costo_usd:            costoUsd,
      tokens_in:            tokensIn,
      tokens_out:           tokensOut,
      duracion_promedio_ms: duracionProm,
    },
    promedios: {
      costo_por_scan:  scans > 0 ? costoUsd  / scans : 0,
      tokens_por_scan: scans > 0 ? totalTokens / scans : 0,
    },
    ratio_activas: (activas + descartadas) > 0
      ? activas / (activas + descartadas)
      : 0,
    por_linea: porLinea,
    serie,
  };
}
