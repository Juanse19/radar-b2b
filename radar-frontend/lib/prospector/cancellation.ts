/**
 * lib/prospector/cancellation.ts — In-memory cancellation registry para
 * sesiones del wizard de Apollo Prospector v2.
 *
 * Mismo patrón que `lib/comercial/scan-cancellation.ts`: el cliente hace
 * POST /cancel; el handler marca el sessionId como cancelado y el loop
 * principal del SSE checa `isCancelled()` antes de cada empresa.
 */
import 'server-only';

const cancelledSessions = new Set<string>();

export function cancelProspectorSession(sessionId: string): void {
  if (sessionId) cancelledSessions.add(sessionId);
}

export function isProspectorCancelled(sessionId: string): boolean {
  return cancelledSessions.has(sessionId);
}

export function clearProspectorCancellation(sessionId: string): void {
  cancelledSessions.delete(sessionId);
}
