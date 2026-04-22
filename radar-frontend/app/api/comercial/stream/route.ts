/**
 * /api/comercial/stream — Server-Sent Events endpoint for Radar v2 live timeline.
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
import { scanCompany, getActiveBudget } from '@/lib/comercial/scanner';
import { isCancelled, clearCancellation } from '@/lib/comercial/scan-cancellation';
import {
  createSSEEmitter,
  getReplayEvents,
  replayBuffered,
} from '@/lib/comercial/sse-emitter';
import {
  createRadarV2Session,
  insertRadarV2Result,
  updateSessionStats,
} from '@/lib/comercial/db';
import { buildReport, insertReport } from '@/lib/comercial/report';
import type { ComercialResult } from '@/lib/comercial/types';
import { ensureRadarV2Tables } from '@/lib/comercial/db-migrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Scans can take several minutes on a multi-company batch (each + rate-limit delays).
export const maxDuration = 300;

// ms to wait between companies — 2s is sufficient for all providers.
// The original 65s was overly conservative for Claude's rate limit and unusable
// for OpenAI/Gemini. Callers that need a longer delay can pass it as a query param.
const RATE_LIMIT_DELAY_MS = 2_000;

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

      // Ensure radar_v2 tables exist (auto-migration) — non-fatal.
      await ensureRadarV2Tables().catch(() => { /* non-fatal */ });

      // Create session row using the client-generated UUID as PK — non-fatal.
      try {
        await createRadarV2Session({
          id:             sessionId,
          linea_negocio:  line.split(',')[0],
          empresas_count: empresas.length,
          user_id:        null,
        });
      } catch (err) {
        console.error('[stream] createRadarV2Session failed:', err);
      }

      emitter.emit('scan_started', {
        sessionId,
        empresas: empresas.map(e => e.name),
        linea:    line,
        provider: provider ?? 'claude',
      });

      const sessionStart  = Date.now();
      let totalCost   = 0;
      let activas     = 0;
      let descartadas = 0;
      let errors      = 0;

      // Accumulate DB-persisted results for the final report.
      const collectedResults: ComercialResult[] = [];

      // Look up monthly budget once before the loop — non-fatal if DB unavailable.
      const monthlyBudget = await getActiveBudget(provider ?? 'claude').catch(() => null);

      for (let i = 0; i < empresas.length; i++) {
        if (emitter.closed) break;
        if (isCancelled(sessionId)) {
          emitter.emit('session_done', {
            sessionId,
            total_empresas:    empresas.length,
            activas_count:     activas,
            descartadas_count: descartadas,
            errors_count:      errors,
            duration_ms:       Date.now() - sessionStart,
            total_cost_usd:    totalCost,
            cancelled:         true,
          });
          break;
        }

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

          // Persist result to DB — non-fatal.
          try {
            const dbResult = await insertRadarV2Result({
              session_id:          sessionId,
              empresa_id:          company.id ?? null,
              empresa_evaluada:    scan.result.empresa_evaluada,
              radar_activo:        scan.result.radar_activo,
              linea_negocio:       scan.result.linea_negocio ?? null,
              tipo_senal:          scan.result.tipo_senal ?? null,
              pais:                scan.result.pais ?? null,
              empresa_o_proyecto:  scan.result.empresa_o_proyecto ?? null,
              descripcion_resumen: scan.result.descripcion_resumen ?? null,
              criterios_cumplidos: scan.result.criterios_cumplidos ?? [],
              total_criterios:     scan.result.total_criterios ?? 0,
              ventana_compra:      scan.result.ventana_compra ?? null,
              monto_inversion:     scan.result.monto_inversion ?? null,
              fuente_link:         scan.result.fuente_link ?? null,
              fuente_nombre:       scan.result.fuente_nombre ?? null,
              fecha_senal:         scan.result.fecha_senal ?? null,
              evaluacion_temporal: scan.result.evaluacion_temporal ?? null,
              observaciones:       scan.result.observaciones ?? null,
              motivo_descarte:     scan.result.motivo_descarte ?? null,
              raw_json:            scan.result,
              tokens_input:        scan.tokens_input ?? undefined,
              tokens_output:       scan.tokens_output ?? undefined,
              cost_usd:            scan.cost_usd ?? undefined,
            });
            collectedResults.push(dbResult);
          } catch (err) {
            console.error('[stream] insertRadarV2Result failed:', err);
          }

          // Warn when cumulative spend reaches 80% of the monthly budget.
          if (monthlyBudget && totalCost >= monthlyBudget * 0.8) {
            emitter.emit('budget_warning', {
              consumed_usd: totalCost,
              budget_usd:   monthlyBudget,
              pct:          Math.round((totalCost / monthlyBudget) * 100),
            });
          }
        } catch (err) {
          errors += 1;
          const msg = err instanceof Error ? err.message : String(err);
          emitter.emit('company_error', { empresa: company.name, error: msg });
        }
      }

      // Update session stats — non-fatal.
      const duration_ms = Date.now() - sessionStart;
      try {
        await updateSessionStats(sessionId, {
          duration_ms,
          activas_count:     activas,
          descartadas_count: descartadas,
        });
      } catch (err) {
        console.error('[stream] updateSessionStats failed:', err);
      }

      // Save scan report snapshot — non-fatal.
      if (collectedResults.length > 0) {
        try {
          const sessionInput = {
            id:               sessionId,
            linea_negocio:    line.split(',')[0],
            empresas_count:   empresas.length,
            total_cost_usd:   totalCost,
            created_at:       new Date().toISOString(),
            duration_ms,
            activas_count:    activas,
            descartadas_count: descartadas,
            user_id:          null,
          };
          await insertReport(buildReport(sessionInput, collectedResults));
        } catch (err) {
          console.error('[stream] insertReport failed:', err);
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
