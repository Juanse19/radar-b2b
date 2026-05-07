/**
 * /api/comercial/calificar — SSE endpoint for Calificador v2.
 *
 * Query params:
 *   - sessionId:   string  (required) — groups events; reconnects replay buffered events
 *   - linea:       string  (required) — línea de negocio name
 *   - empresas:    JSON    (required) — array of { name, country, id?, domain? }
 *   - subLineaId:  number  (optional) — FK to sub_lineas_negocio
 *   - provider:    string  (optional) — 'claude' | 'openai' | 'gemini'
 *   - ragEnabled:  'true'|'false' (optional, default true)
 *   - model:       string  (optional) — model override
 *
 * Headers:
 *   - Last-Event-ID: <number> — if present, server replays buffered events with id > N.
 *
 * SSE events emitted (see engine.ts for payload shapes):
 *   session_started, empresa_started, rag_context, profiling_web, thinking,
 *   dim_scored, tier_assigned, empresa_done, company_error, session_done, error
 */
import 'server-only';
import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { isCancelled, clearCancellation } from '@/lib/comercial/scan-cancellation';
import {
  createSSEEmitter,
  getReplayEvents,
  replayBuffered,
} from '@/lib/comercial/sse-emitter';
import { calificarEmpresa } from '@/lib/comercial/calificador/engine';
import type { CalificacionInput } from '@/lib/comercial/calificador/types';

export const dynamic    = 'force-dynamic';
export const runtime    = 'nodejs';
// Califications stream: each company call may take 30-60s with web search.
export const maxDuration = 600;

// Delay between companies to respect provider rate limits (ms).
const INTER_COMPANY_DELAY_MS = 3_000;

// ─── Input parsing ────────────────────────────────────────────────────────────

interface EmpresaInput {
  id?:     number;
  name:    string;
  country: string;
  domain?: string;
}

function parseEmpresas(raw: string | null): EmpresaInput[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    const out: EmpresaInput[] = [];
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
          domain:  typeof rec.domain === 'string' ? rec.domain : undefined,
        });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url        = new URL(req.url);
  const sessionId  = url.searchParams.get('sessionId');
  const linea      = url.searchParams.get('linea');
  const empresas   = parseEmpresas(url.searchParams.get('empresas'));
  const subLineaId = url.searchParams.get('subLineaId')
    ? Number(url.searchParams.get('subLineaId'))
    : undefined;
  const provider   = url.searchParams.get('provider') ?? undefined;
  const ragEnabled = url.searchParams.get('ragEnabled') !== 'false';
  const model      = url.searchParams.get('model') ?? undefined;

  if (!sessionId) return new Response('sessionId required',  { status: 400 });
  if (!linea)     return new Response('linea required',      { status: 400 });
  if (!empresas)  return new Response('empresas[] required', { status: 400 });
  if (empresas.length > 50) {
    return new Response('Max 50 companies per calificacion batch', { status: 400 });
  }

  const lastEventId = Number.parseInt(req.headers.get('last-event-id') ?? '0', 10) || 0;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const emitter = createSSEEmitter(writer, sessionId);

  // Replay buffered events synchronously if this is a reconnect.
  const replay = lastEventId > 0 ? getReplayEvents(sessionId, lastEventId) : null;

  (async () => {
    try {
      if (replay && replay.length) {
        await replayBuffered(writer, replay);
      }

      emitter.emit('session_started', {
        sessionId,
        empresas:   empresas.map(e => e.name),
        linea,
        subLineaId: subLineaId ?? null,
        provider:   provider ?? 'claude',
        ragEnabled,
        total:      empresas.length,
      });

      const sessionStart = Date.now();
      let totalCost      = 0;
      const tieredCounts: Record<string, number> = { 'A': 0, 'B-Alta': 0, 'B-Baja': 0, 'C': 0, 'D': 0 };
      let errors         = 0;

      for (let i = 0; i < empresas.length; i++) {
        if (emitter.closed) break;
        if (isCancelled(sessionId)) {
          emitter.emit('session_done', {
            sessionId,
            total_empresas: empresas.length,
            tiers:          tieredCounts,
            errors_count:   errors,
            duration_ms:    Date.now() - sessionStart,
            total_cost_usd: totalCost,
            cancelled:      true,
          });
          break;
        }

        if (i > 0) {
          await new Promise(r => setTimeout(r, INTER_COMPANY_DELAY_MS));
        }

        const empresa = empresas[i];
        const input: CalificacionInput = {
          empresa:      empresa.name,
          pais:         empresa.country,
          lineaNombre:  linea,
          subLineaId:   subLineaId ?? undefined,
          company_domain: empresa.domain,
          sessionId,
        };

        try {
          const result = await calificarEmpresa(
            input,
            { ragEnabled, providerName: provider, model },
            emitter,
          );
          totalCost += result.costUsd;
          tieredCounts[result.tier] = (tieredCounts[result.tier] ?? 0) + 1;
        } catch (err) {
          errors += 1;
          const msg = err instanceof Error ? err.message : String(err);
          emitter.emit('company_error', { empresa: empresa.name, error: msg });
        }
      }

      emitter.emit('session_done', {
        sessionId,
        total_empresas: empresas.length,
        tiers:          tieredCounts,
        errors_count:   errors,
        duration_ms:    Date.now() - sessionStart,
        total_cost_usd: totalCost,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitter.emit('error', { message: msg });
    } finally {
      clearCancellation(sessionId);
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
