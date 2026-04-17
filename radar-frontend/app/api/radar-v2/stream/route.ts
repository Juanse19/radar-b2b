/**
 * /api/radar-v2/stream — Server-Sent Events endpoint for Radar v2 live timeline.
 *
 * Query params:
 *   - sessionId: string (required) — groups events so reconnects can replay
 *   - empresas:  JSON-encoded array of { id?, name, country } (required)
 *   - line:      string (required) — línea de negocio
 *   - provider:  string (optional) — 'claude' | 'openai' | 'gemini'
 *
 * Headers:
 *   - Last-Event-ID: <number> — if present, server replays buffered events with id > N.
 *
 * The stream lives as long as the scan takes. Events are ephemeral (in-memory only).
 */
import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { scanCompany } from '@/lib/radar-v2/scanner';
import {
  createSSEEmitter,
  getReplayEvents,
  replayBuffered,
} from '@/lib/radar-v2/sse-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Scans can take several minutes on a multi-company batch (each + rate-limit delays).
export const maxDuration = 300;

// ms to wait between companies so Claude's 10K tokens/min rate limit isn't hit.
const RATE_LIMIT_DELAY_MS = 65_000;

interface CompanyInput {
  id?:      number;
  name:     string;
  country:  string;
}

function parseEmpresas(raw: string | null): CompanyInput[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    const out: CompanyInput[] = [];
    for (const item of arr) {
      if (
        typeof item === 'object' && item !== null &&
        'name' in item && 'country' in item &&
        typeof (item as Record<string, unknown>).name    === 'string' &&
        typeof (item as Record<string, unknown>).country === 'string'
      ) {
        const rec = item as Record<string, unknown>;
        out.push({
          id:      typeof rec.id === 'number' ? rec.id : undefined,
          name:    rec.name    as string,
          country: rec.country as string,
        });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url       = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const empresas  = parseEmpresas(url.searchParams.get('empresas'));
  const line      = url.searchParams.get('line');
  const provider  = url.searchParams.get('provider') ?? undefined;

  if (!sessionId) return new Response('sessionId required',  { status: 400 });
  if (!line)      return new Response('line required',       { status: 400 });
  if (!empresas)  return new Response('empresas[] required', { status: 400 });
  if (empresas.length > 20) {
    return new Response('Max 20 companies per scan', { status: 400 });
  }

  const lastEventId = Number.parseInt(req.headers.get('last-event-id') ?? '0', 10) || 0;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Replay buffered events synchronously if this is a reconnect.
  const replay = lastEventId > 0 ? getReplayEvents(sessionId, lastEventId) : null;
  const emitter = createSSEEmitter(writer, sessionId);

  // Kick off the scan pipeline without awaiting — the ReadableStream is
  // returned immediately so the browser starts receiving headers.
  (async () => {
    try {
      if (replay && replay.length) {
        await replayBuffered(writer, replay);
      }

      emitter.emit('scan_started', {
        sessionId,
        empresas: empresas.map(e => e.name),
        linea:    line,
        provider: provider ?? 'claude',
      });

      const sessionStart = Date.now();
      let totalCost   = 0;
      let activas     = 0;
      let descartadas = 0;
      let errors      = 0;

      for (let i = 0; i < empresas.length; i++) {
        if (emitter.closed) break;

        if (i > 0) {
          await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
        }

        const company = empresas[i];
        try {
          const scan = await scanCompany(company, line, {
            providerName: provider,
            sessionId,
            emit:         emitter,
          });
          totalCost += scan.cost_usd;
          if (scan.result.radar_activo === 'Sí') activas += 1;
          else                                    descartadas += 1;
        } catch (err) {
          errors += 1;
          const msg = err instanceof Error ? err.message : String(err);
          emitter.emit('company_error', { empresa: company.name, error: msg });
        }
      }

      emitter.emit('session_done', {
        sessionId,
        total_empresas:    empresas.length,
        activas_count:     activas,
        descartadas_count: descartadas,
        errors_count:      errors,
        duration_ms:       Date.now() - sessionStart,
        total_cost_usd:    totalCost,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitter.emit('error', { message: msg });
    } finally {
      await emitter.close();
    }
  })();

  return new Response(readable, {
    status:  200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-store, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
