/**
 * GET /api/admin/tokens?days=30
 *
 * Aggregated usage from radar_v2_token_events + radar_v2_sessions.
 * Returns KPIs + recent events + daily cost series for the admin dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? '30'), 90);
  const interval = `${days} days`;

  try {
    // 1) KPIs: tokens, cost, scans
    type KpiRow = {
      scans:       string;
      tokens_in:   string | null;
      tokens_out:  string | null;
      costo_usd:   string | null;
    };
    const [kpi] = await pgQuery<KpiRow>(`
      SELECT
        COUNT(DISTINCT s.id)::text                                    AS scans,
        COALESCE(SUM(r.tokens_input), 0)::text                        AS tokens_in,
        COALESCE(SUM(r.tokens_output), 0)::text                       AS tokens_out,
        COALESCE(SUM(r.cost_usd), 0)::text                            AS costo_usd
      FROM ${S}.radar_v2_sessions s
      LEFT JOIN ${S}.radar_v2_results r ON r.session_id = s.id
      WHERE s.created_at >= NOW() - INTERVAL ${pgLit(interval)}
    `);

    // 2) Eventos recientes (resultados individuales como proxy si no hay token_events)
    type EventRow = {
      id:            string;
      empresa:       string;
      linea:         string | null;
      tokens_input:  number | null;
      tokens_output: number | null;
      cost_usd:      string | null;
      created_at:    string;
    };
    const events = await pgQuery<EventRow>(`
      SELECT
        r.id::text,
        r.empresa_evaluada   AS empresa,
        r.linea_negocio      AS linea,
        r.tokens_input,
        r.tokens_output,
        r.cost_usd::text     AS cost_usd,
        r.created_at
      FROM ${S}.radar_v2_results r
      WHERE r.created_at >= NOW() - INTERVAL ${pgLit(interval)}
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    // 3) Serie diaria de costo (últimos N días)
    type SerieRow = { day: string; costo: string | null; scans: string };
    const serie = await pgQuery<SerieRow>(`
      SELECT
        DATE_TRUNC('day', r.created_at)::text                 AS day,
        COALESCE(SUM(r.cost_usd), 0)::text                    AS costo,
        COUNT(DISTINCT r.session_id)::text                    AS scans
      FROM ${S}.radar_v2_results r
      WHERE r.created_at >= NOW() - INTERVAL ${pgLit(interval)}
      GROUP BY DATE_TRUNC('day', r.created_at)
      ORDER BY day ASC
    `);

    return NextResponse.json({
      days,
      totals: {
        scans:     parseInt(kpi?.scans     ?? '0', 10),
        tokens_in: parseInt(kpi?.tokens_in ?? '0', 10),
        tokens_out:parseInt(kpi?.tokens_out?? '0', 10),
        costo_usd: parseFloat(kpi?.costo_usd ?? '0'),
      },
      events: events.map((e) => ({
        id:            e.id,
        empresa:       e.empresa,
        linea:         e.linea,
        tokens_input:  e.tokens_input ?? 0,
        tokens_output: e.tokens_output ?? 0,
        cost_usd:      parseFloat(e.cost_usd ?? '0'),
        created_at:    e.created_at,
      })),
      serie: serie.map((s) => ({
        day:   s.day,
        costo: parseFloat(s.costo ?? '0'),
        scans: parseInt(s.scans ?? '0', 10),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/tokens] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
