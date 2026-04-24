/**
 * In-process registry of cancelled scan session IDs.
 *
 * The SSE stream route checks `isCancelled(sessionId)` between company scans
 * and stops the loop cleanly. Since this lives in process memory, it only
 * works when cancel + stream are served by the same Node instance
 * (true for single-server deploys; in a multi-instance setup this would need
 * Redis or an equivalent shared store).
 */

const cancelled = new Set<string>();

export function cancelScan(sessionId: string): void {
  cancelled.add(sessionId);
  // Auto-clean after 10 min so the Set doesn't grow unbounded.
  setTimeout(() => cancelled.delete(sessionId), 10 * 60 * 1000);
}

export function isCancelled(sessionId: string): boolean {
  return cancelled.has(sessionId);
}

export function clearCancellation(sessionId: string): void {
  cancelled.delete(sessionId);
}
