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
// V2 note: WF01 (Calificador) is no longer in n8n. Pipelines now start with
// the in-process /api/comercial/calificar SSE engine and may continue to
// WF02/WF03 if the user chooses to trigger Radar / Prospector.

import { NextRequest, NextResponse } from 'next/server';
import { getPipelines } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(Number(searchParams.get('limit') ?? '20'), 50);
  const status = searchParams.get('status') === 'running' ? 'running' : 'all';

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
