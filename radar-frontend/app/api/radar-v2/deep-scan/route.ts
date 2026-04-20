/**
 * /api/radar-v2/deep-scan — SSE endpoint for deep single-company investigation.
 *
 * POST body:
 *   { empresa: string, pais: string, linea: string, sessionId?: string }
 *
 * Returns text/event-stream. Emits the same StreamEventType taxonomy as the
 * batch stream route so the client can reuse the same EventSource handler.
 * On completion, persists the result to radar_v2_results.
 */
import 'server-only';
import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { scanCompany } from '@/lib/radar-v2/scanner';
import {
  createSSEEmitter,
} from '@/lib/radar-v2/sse-emitter';
import {
  createRadarV2Session,
  insertRadarV2Result,
  updateSessionStats,
} from '@/lib/radar-v2/db';
import { ensureRadarV2Tables } from '@/lib/radar-v2/db-migrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Deep scans use up to 20 turns and more detailed prompts — allow extra time.
export const maxDuration = 180;

interface DeepScanBody {
  empresa:    string;
  pais:       string;
  linea:      string;
  sessionId?: string;
}

function isValidBody(v: unknown): v is DeepScanBody {
  if (typeof v !== 'object' || v === null) return false;
  const rec = v as Record<string, unknown>;
  return (
    typeof rec.empresa === 'string' && rec.empresa.trim().length > 0 &&
    typeof rec.pais    === 'string' && rec.pais.trim().length    > 0 &&
    typeof rec.linea   === 'string' && rec.linea.trim().length   > 0
  );
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!isValidBody(body)) {
    return new Response('empresa, pais and linea are required strings', { status: 400 });
  }

  const { empresa, pais, linea } = body;
  const sessionId = (typeof body.sessionId === 'string' && body.sessionId.trim())
    ? body.sessionId.trim()
    : crypto.randomUUID();

  const company = { name: empresa.trim(), country: pais.trim() };

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const emitter = createSSEEmitter(writer, sessionId);

  // Kick off without awaiting — return the stream immediately.
  (async () => {
    try {
      // Ensure tables exist (auto-migration) — non-fatal.
      await ensureRadarV2Tables().catch(() => { /* non-fatal */ });

      // Create session row — non-fatal.
      try {
        await createRadarV2Session({
          id:             sessionId,
          linea_negocio:  linea,
          empresas_count: 1,
          user_id:        null,
        });
      } catch (err) {
        console.error('[deep-scan] createRadarV2Session failed:', err);
      }

      emitter.emit('scan_started', {
        sessionId,
        empresas: [company.name],
        linea,
        provider: 'claude',
        mode: 'deep',
      });

      const scanStart = Date.now();

      const scan = await scanCompany(company, linea, {
        providerName: 'claude',
        sessionId,
        emit: emitter,
      });

      const duration_ms = Date.now() - scanStart;

      // Persist result — non-fatal.
      try {
        await insertRadarV2Result({
          session_id:          sessionId,
          empresa_id:          null,
          empresa_evaluada:    scan.result.empresa_evaluada,
          radar_activo:        scan.result.radar_activo,
          linea_negocio:       scan.result.linea_negocio ?? null,
          tipo_senal:          scan.result.tipo_senal    ?? null,
          pais:                scan.result.pais          ?? null,
          empresa_o_proyecto:  scan.result.empresa_o_proyecto  ?? null,
          descripcion_resumen: scan.result.descripcion_resumen ?? null,
          criterios_cumplidos: scan.result.criterios_cumplidos ?? [],
          total_criterios:     scan.result.total_criterios     ?? 0,
          ventana_compra:      scan.result.ventana_compra      ?? null,
          monto_inversion:     scan.result.monto_inversion     ?? null,
          fuente_link:         scan.result.fuente_link         ?? null,
          fuente_nombre:       scan.result.fuente_nombre       ?? null,
          fecha_senal:         scan.result.fecha_senal         ?? null,
          evaluacion_temporal: scan.result.evaluacion_temporal ?? null,
          observaciones:       scan.result.observaciones       ?? null,
          motivo_descarte:     scan.result.motivo_descarte     ?? null,
          raw_json:            scan.result,
          tokens_input:        scan.tokens_input  ?? undefined,
          tokens_output:       scan.tokens_output ?? undefined,
          cost_usd:            scan.cost_usd      ?? undefined,
        });
      } catch (err) {
        console.error('[deep-scan] insertRadarV2Result failed:', err);
      }

      // Update session stats — non-fatal.
      try {
        await updateSessionStats(sessionId, {
          duration_ms,
          activas_count:     scan.result.radar_activo === 'Sí' ? 1 : 0,
          descartadas_count: scan.result.radar_activo === 'No' ? 1 : 0,
        });
      } catch (err) {
        console.error('[deep-scan] updateSessionStats failed:', err);
      }

      emitter.emit('session_done', {
        sessionId,
        total_empresas:    1,
        activas_count:     scan.result.radar_activo === 'Sí' ? 1 : 0,
        descartadas_count: scan.result.radar_activo === 'No' ? 1 : 0,
        errors_count:      0,
        duration_ms,
        total_cost_usd:    scan.cost_usd,
        result:            scan.result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deep-scan] scan failed:', msg);
      emitter.emit('error', { message: msg });
    } finally {
      await emitter.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-store, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
