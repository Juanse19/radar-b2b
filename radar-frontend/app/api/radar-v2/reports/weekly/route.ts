import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { ensureRadarV2Tables } from '@/lib/radar-v2/db-migrations';

const S = SCHEMA;

// Parse ISO week string "YYYY-Www" to Monday 00:00 and Sunday 23:59:59 UTC
function parseIsoWeek(week: string): { start: string; end: string } | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const weekNum = parseInt(m[2], 10);
  // Jan 4 is always in week 1 per ISO 8601
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Monday = 1
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return {
    start: monday.toISOString(),
    end:   sunday.toISOString(),
  };
}

// Returns current ISO week string e.g. "2026-W16"
function currentIsoWeek(): string {
  const now = new Date();
  const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
  const dayOfJan4 = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() - dayOfJan4 + 1);
  const diffMs = now.getTime() - monday1.getTime();
  const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${now.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

type WeekSession = {
  id:                string;
  linea_negocio:     string;
  created_at:        string;
  empresas_count:    string;
  activas_count:     string;
  descartadas_count: string;
  total_cost_usd:    string | null;
  duration_ms:       string | null;
  has_report:        string; // 'true' or 'false'
};

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureRadarV2Tables();

  const weekParam = req.nextUrl.searchParams.get('week') ?? currentIsoWeek();
  const range = parseIsoWeek(weekParam);
  if (!range) {
    return NextResponse.json({ error: 'Invalid week format. Use YYYY-Www' }, { status: 400 });
  }

  try {
    const rows = await pgQuery<WeekSession>(`
      SELECT
        s.id,
        s.linea_negocio,
        s.created_at,
        s.empresas_count::text,
        COALESCE(s.activas_count, 0)::text     AS activas_count,
        COALESCE(s.descartadas_count, 0)::text AS descartadas_count,
        s.total_cost_usd::text,
        s.duration_ms::text,
        (r.id IS NOT NULL)::text               AS has_report
      FROM ${S}.radar_v2_sessions s
      LEFT JOIN ${S}.radar_v2_reports r ON r.session_id = s.id
      WHERE s.created_at BETWEEN ${pgLit(range.start)} AND ${pgLit(range.end)}
      ORDER BY s.created_at DESC
    `);

    const sessions = rows.map(r => ({
      id:                r.id,
      linea_negocio:     r.linea_negocio,
      created_at:        r.created_at,
      empresas_count:    parseInt(r.empresas_count ?? '0', 10),
      activas_count:     parseInt(r.activas_count ?? '0', 10),
      descartadas_count: parseInt(r.descartadas_count ?? '0', 10),
      total_cost_usd:    parseFloat(r.total_cost_usd ?? '0'),
      duration_ms:       r.duration_ms ? parseInt(r.duration_ms, 10) : null,
      has_report:        r.has_report === 'true',
    }));

    const totals = {
      sesiones:    sessions.length,
      empresas:    sessions.reduce((s, r) => s + r.empresas_count, 0),
      activas:     sessions.reduce((s, r) => s + r.activas_count, 0),
      descartadas: sessions.reduce((s, r) => s + r.descartadas_count, 0),
      costo_usd:   sessions.reduce((s, r) => s + r.total_cost_usd, 0),
    };

    return NextResponse.json({ week: weekParam, sessions, totals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/reports/weekly GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
