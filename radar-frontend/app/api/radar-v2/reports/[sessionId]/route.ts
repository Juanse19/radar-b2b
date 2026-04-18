import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getRadarV2Report } from '@/lib/radar-v2/db';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { InformeSesion } from '@/lib/radar-v2/types';

const S = SCHEMA;

type RouteParams = { params: Promise<{ sessionId: string }> };

// BUG I1 FIX: SessionRow now includes all InformeSesion fields from radar_v2_sessions
type SessionRow = {
  id: string;
  linea_negocio: string;
  created_at: string;
  duration_ms: number | null;
  empresas_count: number;
  total_cost_usd: string | null; // Postgres NUMERIC comes back as string over HTTP
  activas_count: number;
  descartadas_count: number;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  // Validate UUID format to prevent injection
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
  }

  try {
    const report = await getRadarV2Report(sessionId);

    if (!report) {
      // Check if session exists but report was never generated
      const sessionRows = await pgQuery<SessionRow>(
        `SELECT id FROM ${S}.radar_v2_sessions WHERE id = ${pgLit(sessionId)} LIMIT 1`,
      );
      if (!sessionRows.length) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Report not yet generated for this session' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    if (format === 'md') {
      return new NextResponse(report.markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `inline; filename="radar-report-${sessionId.slice(0, 8)}.md"`,
        },
      });
    }

    // BUG I1 FIX: fetch the full session row so InformeEjecucion gets an InformeSesion
    // object instead of a bare UUID string.
    const sessionRows = await pgQuery<SessionRow>(
      `SELECT id, linea_negocio, created_at, duration_ms,
              empresas_count, total_cost_usd,
              COALESCE(activas_count, 0)     AS activas_count,
              COALESCE(descartadas_count, 0) AS descartadas_count
       FROM ${S}.radar_v2_sessions
       WHERE id = ${pgLit(sessionId)}
       LIMIT 1`,
    );

    const sessionRow = sessionRows[0];
    const informeSesion: InformeSesion = sessionRow
      ? {
          session_id:        sessionRow.id,
          linea_negocio:     sessionRow.linea_negocio ?? '',
          created_at:        sessionRow.created_at ?? '',
          duration_ms:       sessionRow.duration_ms ?? null,
          empresas_count:    Number(sessionRow.empresas_count) || 0,
          // BUG I2 FIX: Postgres NUMERIC arrives as string — coerce to number
          total_cost_usd:    parseFloat(sessionRow.total_cost_usd ?? '0') || 0,
          activas_count:     Number(sessionRow.activas_count) || 0,
          descartadas_count: Number(sessionRow.descartadas_count) || 0,
        }
      : {
          // Fallback: session row not found (shouldn't happen but keeps types happy)
          session_id:        sessionId,
          linea_negocio:     '',
          created_at:        '',
          duration_ms:       null,
          empresas_count:    0,
          total_cost_usd:    0,
          activas_count:     0,
          descartadas_count: 0,
        };

    return NextResponse.json({
      session:   informeSesion,
      resumen:   report.resumen,
      activas:   report.activas,
      descartes: report.descartes,
      markdown:  report.markdown,
      created_at: report.created_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/api/radar-v2/reports/${sessionId}] Error:`, msg);
    return NextResponse.json({ error: 'Error retrieving report', detail: msg }, { status: 500 });
  }
}
