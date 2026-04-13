// POST /api/executions/clear
//
// Marks all stuck (running/waiting) executions as error so the tray empties.
// Accepts optional { olderThanMinutes: number } — 0 or omit = clear all.

import { NextRequest, NextResponse } from 'next/server';
import { getPipelines, resolveEjecucion } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { olderThanMinutes?: number };
    const olderThanMinutes = typeof body.olderThanMinutes === 'number' ? body.olderThanMinutes : 0;
    const cutoffMs = olderThanMinutes > 0 ? olderThanMinutes * 60 * 1000 : 0;

    const pipelines = await getPipelines({ status: 'running', limit: 100 });
    const now = Date.now();

    let cleared = 0;
    for (const pipeline of pipelines) {
      for (const agent of pipeline.agents) {
        if (agent.estado !== 'running') continue;
        if (cutoffMs > 0 && now - Date.parse(agent.started_at) < cutoffMs) continue;
        try {
          await resolveEjecucion(agent.id, 'error', 'Descartado manualmente');
          cleared++;
        } catch { /* swallow per-row errors */ }
      }
    }

    return NextResponse.json({ cleared });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[POST /api/executions/clear] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
