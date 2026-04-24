// app/api/agent/status/[executionId]/route.ts
//
// GET /api/agent/status/[executionId]
//
// Lightweight proxy that returns the live status of ONE n8n execution.
// Intended for use by the scan form immediately after firing an agent —
// the client polls this endpoint until it gets a terminal status.
//
// Why this route instead of /api/executions/[id] directly:
//   - /api/executions/[id] is the authoritative source: it merges the DB row
//     with the live n8n state AND persists any transitions. It's the right
//     endpoint for the tracker tray and the pipeline card.
//   - This route is a thin, unauthenticated-friendly* proxy for the specific
//     "just tell me if my execution finished" use case. It calls n8n directly
//     via getExecutionStatus() and returns a normalised shape without touching
//     the DB. That makes it cheaper, faster to respond, and safe to call before
//     the DB row has been written (n8n can be slow to commit the execution id).
//
//   * Still requires a session — we just don't need a DB round-trip.
//
// Response shape:
//   {
//     executionId: string,
//     status: 'running' | 'success' | 'error' | 'waiting',
//     currentStep: string | null,
//     startedAt: string | null,
//     finishedAt: string | null,
//     empresasProcesadas: number | null,
//     isTimestampId: boolean,
//   }

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionStatus } from '@/lib/n8n';
import { getCurrentSession } from '@/lib/auth/session';

/** A timestamp fallback id is a long pure-digit string (Date.now() ~13 digits). */
function isTimestampLike(id: string): boolean {
  return /^\d{10,}$/.test(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;

  if (!executionId) {
    return NextResponse.json({ error: 'executionId es requerido' }, { status: 400 });
  }

  // Auth guard — same as the rest of /api/agent/*.
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isTimestamp = isTimestampLike(executionId);

  // Timestamp fallback: n8n never gave us a real execution id. We can't poll
  // anything meaningful, so we return a stable "still running" response.
  // The client should fall back to time-based estimation.
  if (isTimestamp) {
    return NextResponse.json({
      executionId,
      status:             'running',
      currentStep:        null,
      startedAt:          null,
      finishedAt:         null,
      empresasProcesadas: null,
      isTimestampId:      true,
    });
  }

  try {
    const live = await getExecutionStatus(executionId);
    return NextResponse.json({
      executionId:        live.id,
      status:             live.status,
      currentStep:        live.currentStep ?? null,
      startedAt:          live.startedAt ?? null,
      finishedAt:         live.finishedAt ?? null,
      empresasProcesadas: live.empresasProcesadas ?? null,
      isTimestampId:      false,
    });
  } catch (err) {
    // n8n unreachable or returned a non-2xx. Treat as still running so the
    // UI doesn't show a misleading error — the 30-min auto-timeout in the
    // tracker will eventually resolve it.
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error(`[GET /api/agent/status/${executionId}] n8n error:`, msg);
    return NextResponse.json({
      executionId,
      status:             'running',
      currentStep:        null,
      startedAt:          null,
      finishedAt:         null,
      empresasProcesadas: null,
      isTimestampId:      false,
    });
  }
}
