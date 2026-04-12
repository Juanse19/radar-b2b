// app/api/executions/route.ts
//
// GET /api/executions
//   Returns ejecuciones from the LOCAL database (not from n8n directly),
//   grouped by pipeline_id, so the floating tracker tray can render one card
//   per pipeline regardless of how many agents participated.
//
// Query params:
//   - status=running | all   (default: all)
//   - limit=N                (default: 20, max: 50)
//
// Why DB-backed instead of n8n REST API:
//   - Lets us group cascades (WF01→02→03) by pipeline_id, which n8n doesn't
//     know about.
//   - Survives the n8n executions endpoint being temporarily unavailable.
//   - Polling 1 endpoint that hits SQLite/Postgres is far cheaper than polling
//     3 endpoints that walk n8n REST.
//
// The legacy shape (flat array of n8n raw rows) is still returned when
// `?legacy=1` is set, so any old caller of this route doesn't break.

import { NextRequest, NextResponse } from 'next/server';
import { getPipelines } from '@/lib/db';
import { getRecentExecutions } from '@/lib/n8n';
import { getCurrentSession } from '@/lib/auth/session';

const N8N_WORKFLOW_ID = process.env.N8N_WORKFLOW_ID || 'jDtdafuyYt8TXISl';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(Number(searchParams.get('limit') ?? '20'), 50);
  const status = searchParams.get('status') === 'running' ? 'running' : 'all';
  const legacy = searchParams.get('legacy') === '1';

  if (legacy) {
    // Legacy shape — used by code that hasn't migrated yet.
    try {
      const executions = await getRecentExecutions(N8N_WORKFLOW_ID, limit);
      return NextResponse.json(executions);
    } catch {
      return NextResponse.json([], { status: 200 });
    }
  }

  try {
    const pipelines = await getPipelines({ status, limit });
    return NextResponse.json({ pipelines });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[GET /api/executions] Error:', msg);
    // Tracker tolera lista vacía sin romperse.
    return NextResponse.json({ pipelines: [], error: msg }, { status: 200 });
  }
}
