import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getRadarV2Report } from '@/lib/radar-v2/db';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

type RouteParams = { params: Promise<{ sessionId: string }> };

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
      type SessionRow = { id: string };
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

    return NextResponse.json({
      session:  report.session_id,
      resumen:  report.resumen,
      activas:  report.activas,
      descartes: report.descartes,
      markdown: report.markdown,
      created_at: report.created_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/api/radar-v2/reports/${sessionId}] Error:`, msg);
    return NextResponse.json({ error: 'Error retrieving report', detail: msg }, { status: 500 });
  }
}
