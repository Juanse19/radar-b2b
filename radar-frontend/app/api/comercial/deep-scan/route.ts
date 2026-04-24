/**
 * /api/comercial/deep-scan — SSE endpoint for deep single-company investigation.
 *
 * POST body:
 *   { empresa: string, pais: string, linea: string, sessionId?: string }
 *
 * Returns text/event-stream. Emits the same StreamEventType taxonomy as the
 * batch stream route so the client can reuse the same EventSource handler.
 * On completion, persists the result to radar_v2_results.
 *
 * Security controls:
 *   - Authentication: requires valid session with ACTIVO access state
 *   - Input validation: length caps + allowlist for linea de negocio
 *   - Rate limiting: 5 scans/minute per user (in-memory sliding window)
 *   - Error sanitisation: internal errors logged server-side, generic message sent to client
 */
import 'server-only';
import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { scanCompany } from '@/lib/comercial/scanner';
import {
  createSSEEmitter,
} from '@/lib/comercial/sse-emitter';
import {
  createRadarV2Session,
  insertRadarV2Result,
  updateSessionStats,
} from '@/lib/comercial/db';
import { ensureRadarV2Tables } from '@/lib/comercial/db-migrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Deep scans use up to 20 turns and more detailed prompts — allow extra time.
export const maxDuration = 180;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EMPRESA_LEN = 200;
const MAX_PAIS_LEN    = 100;

const VALID_LINEAS = new Set([
  'BHS',
  'Intralogística',
  'Cartón Corrugado',
  'Final de Línea',
  'Motos',
  'Solumat',
]);

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter — 5 requests / 60 s per user
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS  = 60_000;
const RATE_MAX        = 5;
const rateBuckets     = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now  = Date.now();
  const hits  = (rateBuckets.get(userId) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  rateBuckets.set(userId, hits);
  return false;
}

// ---------------------------------------------------------------------------
// Body type + validation
// ---------------------------------------------------------------------------

interface DeepScanBody {
  empresa:    string;
  pais:       string;
  linea:      string;
  sessionId?: string;
}

function isValidBody(v: unknown): v is DeepScanBody {
  if (typeof v !== 'object' || v === null) return false;
  const rec = v as Record<string, unknown>;
  if (typeof rec.empresa !== 'string' || rec.empresa.trim().length === 0) return false;
  if (typeof rec.pais    !== 'string' || rec.pais.trim().length    === 0) return false;
  if (typeof rec.linea   !== 'string' || rec.linea.trim().length   === 0) return false;
  if (rec.empresa.trim().length > MAX_EMPRESA_LEN) return false;
  if (rec.pais.trim().length    > MAX_PAIS_LEN)    return false;
  if (!VALID_LINEAS.has(rec.linea.trim())) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Authentication ───────────────────────────────────────────────────────
  const session = await getCurrentSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only ACTIVO users can trigger scans (avoids PENDIENTE/INACTIVO abuse).
  if (session.accessState !== 'ACTIVO') {
    return new Response('Forbidden: account not active', { status: 403 });
  }

  // ── Rate limiting (per authenticated user) ───────────────────────────────
  if (isRateLimited(session.id)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  // ── Body parsing + validation ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!isValidBody(body)) {
    return new Response(
      `empresa (max ${MAX_EMPRESA_LEN} chars), pais (max ${MAX_PAIS_LEN} chars), and linea (one of: ${[...VALID_LINEAS].join(', ')}) are required`,
      { status: 400 },
    );
  }

  const { empresa, pais, linea } = body;
  const sessionId = (typeof body.sessionId === 'string' && body.sessionId.trim())
    ? body.sessionId.trim()
    : crypto.randomUUID();

  const company = { name: empresa.trim(), country: pais.trim() };

  // ── Stream setup ──────────────────────────────────────────────────────────
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
          user_id:        session.id,   // attribute cost to authenticated user
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
      // Log full error server-side; send only a generic message to the client.
      const fullMsg = err instanceof Error ? err.message : String(err);
      console.error('[deep-scan] scan failed:', fullMsg);
      emitter.emit('error', { message: 'La investigación falló. Intenta de nuevo.' });
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
