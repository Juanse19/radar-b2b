import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

// BUG I3 FIX: Dedicated sessions endpoint so the informes page can load
// session-level aggregates directly instead of grouping raw results client-side.
//
// GET /api/comercial/sessions?limit=20&offset=0
// Returns: { sessions: SessionSummary[], total: number }

type SessionSummaryRow = {
  id: string;
  created_at: string | null;
  linea_negocio: string;
  empresas_count: string; // Postgres INT comes as string over HTTP in some drivers
  activas_count: string;
  descartadas_count: string;
  total_cost_usd: string | null; // NUMERIC
  status: string;
};

type TotalRow = { total: string };

export async function GET(req: NextRequest) {
  const authSession = await getCurrentSession();
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limit  = Math.min(Math.max(Number(searchParams.get('limit')  ?? 20), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  try {
    const [rows, totalRows] = await Promise.all([
      pgQuery<SessionSummaryRow>(`
        SELECT
          s.id,
          s.created_at,
          s.linea_negocio,
          s.empresas_count,
          COALESCE(s.activas_count,     0) AS activas_count,
          COALESCE(s.descartadas_count, 0) AS descartadas_count,
          s.total_cost_usd,
          CASE
            WHEN s.activas_count IS NULL AND s.descartadas_count IS NULL THEN 'running'
            ELSE 'done'
          END AS status
        FROM ${S}.radar_v2_sessions s
        ORDER BY s.created_at DESC
        LIMIT  ${pgLit(limit)}
        OFFSET ${pgLit(offset)}
      `),
      pgQuery<TotalRow>(`
        SELECT COUNT(*)::text AS total FROM ${S}.radar_v2_sessions
      `),
    ]);

    // BUG I2 cross-route: coerce all numeric fields coming from Postgres as strings
    const sessions = rows.map(r => ({
      id:            r.id,
      // BUG I4 FIX: guard created_at — return empty string so callers can null-check
      created_at:    r.created_at ?? '',
      linea_negocio: r.linea_negocio ?? '',
      total_empresas:   Number(r.empresas_count)    || 0,
      activas:          Number(r.activas_count)      || 0,
      descartadas:      Number(r.descartadas_count)  || 0,
      total_cost_usd:   parseFloat(r.total_cost_usd ?? '0') || 0,
      status:           r.status ?? 'done',
    }));

    const total = parseInt(totalRows[0]?.total ?? '0', 10);

    return NextResponse.json({ sessions, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/comercial/sessions] Error:', msg);
    return NextResponse.json({ error: 'Error fetching sessions', detail: msg }, { status: 500 });
  }
}
