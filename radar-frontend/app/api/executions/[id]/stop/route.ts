// app/api/executions/[id]/stop/route.ts
//
// POST /api/executions/[id]/stop
//
// Asks n8n to stop an in-flight execution, then marks our local DB row
// as error so the tracker pill + cards reflect the stop immediately.
//
// n8n endpoint: POST /api/v1/executions/{n8nId}/stop
// (documented in https://docs.n8n.io/api/executions/)
//
// The caller only needs to pass the local execution id or the n8n id —
// we resolve whichever one we don't have from the local DB.

import { NextRequest, NextResponse } from 'next/server';
import { getEjecucionById, actualizarEjecucion } from '@/lib/db';

const N8N_HOST    = process.env.N8N_HOST    || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  // ── 1. Resolve the n8n execution id ──────────────────────────────────────
  let localId: number | null = null;
  let n8nId: string = id;

  try {
    const local = await getEjecucionById(id);
    if (local) {
      localId = local.id;
      n8nId   = local.n8n_execution_id ?? id;
    }
  } catch {
    // DB unavailable — try with whatever id was passed.
  }

  // ── 2. Ask n8n to stop the execution ─────────────────────────────────────
  let n8nStopped = false;
  let n8nError: string | null = null;

  // Only try n8n if the id looks like a real execution id (not a timestamp).
  const isTimestamp = /^\d{13}$/.test(n8nId);
  if (!isTimestamp) {
    try {
      const res = await fetch(
        `${N8N_HOST}/api/v1/executions/${n8nId}/stop`,
        {
          method:  'POST',
          headers: {
            'X-N8N-API-KEY':  N8N_API_KEY,
            'Content-Type':   'application/json',
          },
        },
      );
      if (res.ok) {
        n8nStopped = true;
      } else {
        const body = await res.text();
        n8nError = `n8n ${res.status}: ${body.slice(0, 120)}`;
      }
    } catch (err) {
      n8nError = err instanceof Error ? err.message : 'n8n unreachable';
    }
  }

  // ── 3. Mark the local DB row as stopped ──────────────────────────────────
  // We update even if n8n failed — the user clicked stop, so we treat it
  // as stopped locally. The next poll will reconcile if n8n disagrees.
  if (localId !== null) {
    try {
      await actualizarEjecucion(localId, {
        estado:     'error',
        error_msg:  'Detenido por el usuario',
        finished_at: new Date().toISOString(),
      });
    } catch {
      // Swallow — not fatal.
    }
  }

  if (!n8nStopped && n8nError) {
    // Return a partial success: we updated our DB but n8n might still be running.
    return NextResponse.json(
      { ok: false, localStopped: localId !== null, n8nError },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, n8nStopped, localStopped: localId !== null });
}
