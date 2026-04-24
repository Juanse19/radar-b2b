// hooks/useAgentStatus.ts
//
// Focused hook for the "I just fired an agent — show me progress" use case.
//
// Why this exists alongside useExecutionPolling:
//   - useExecutionPolling hits /api/executions/[id], which merges a DB row with
//     the live n8n state and persists transitions. It's the right tool for the
//     tracker tray and the pipeline card.
//   - This hook hits /api/agent/status/[executionId], a lighter proxy that calls
//     n8n directly without a DB round-trip. It works immediately after firing,
//     even before the DB row has been fully committed.
//   - The API surface is simpler (no ExecutionDTO plumbing) and the semantics
//     are clearer: "what is happening to the thing I just fired?"
//
// Usage:
//
//   const { status, currentStep, elapsedSeconds, isTimestampId, isDone } =
//     useAgentStatus(executionId);
//
//   if (isDone && status === 'success') { /* show results link */ }
//
// The hook stops polling automatically once a terminal status (success | error)
// is received. It also exposes `reset()` so a form can reuse the same hook
// instance across multiple fires without unmounting.

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';

export type AgentStatusValue = 'idle' | 'running' | 'waiting' | 'success' | 'error';

export interface AgentStatusResponse {
  executionId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  currentStep: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  empresasProcesadas: number | null;
  isTimestampId: boolean;
}

export interface UseAgentStatusResult {
  /** Current status — 'idle' before the first poll returns. */
  status: AgentStatusValue;
  /** Human-readable label of the latest n8n node, or null. */
  currentStep: string | null;
  /** Seconds since the execution started (recomputed every second). */
  elapsedSeconds: number;
  /** Number of empresas n8n has processed so far, if available. */
  empresasProcesadas: number | null;
  /** True when the executionId is a Date.now() fallback — no real-time data. */
  isTimestampId: boolean;
  /** True when status is 'success' or 'error'. Polling has stopped. */
  isDone: boolean;
  /** Error from the polling fetch itself (not from the agent execution). */
  fetchError: unknown;
  /** Force an immediate re-poll. */
  refetch: () => Promise<unknown>;
  /**
   * Reset all state so the hook is ready for a new execution.
   * Call this just before setting a new executionId.
   */
  reset: () => void;
}

/**
 * How often to poll while the execution is in flight.
 * n8n agent runs typically take 60-90s; 4s gives ~20 polls without overloading.
 */
const POLL_INTERVAL_MS = 4000;

export function useAgentStatus(
  executionId: string | null | undefined,
): UseAgentStatusResult {
  const qc = useQueryClient();

  // ── TanStack Query for the status endpoint ──────────────────────────────
  const query = useQuery<AgentStatusResponse>({
    queryKey: ['agentStatus', executionId],
    queryFn: () =>
      fetch(`/api/agent/status/${executionId}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`status ${r.status}`);
          return r.json() as Promise<AgentStatusResponse>;
        }),
    enabled: !!executionId,
    refetchInterval: (q) => {
      const d = q.state.data;
      // If we already have a terminal status, stop.
      if (d?.status === 'success' || d?.status === 'error') return false;
      // Timestamp ids: no real-time data — no point hammering the endpoint.
      if (d?.isTimestampId) return false;
      return POLL_INTERVAL_MS;
    },
    // Surface errors via fetchError rather than rethrowing — the UI shows the
    // last known state so the user never sees a blank card.
    retry: 1,
  });

  // ── Elapsed timer ────────────────────────────────────────────────────────
  // Recomputed every second while running. Uses server startedAt if available,
  // falls back to the query's first-success timestamp.
  const [localStartMs, setLocalStartMs] = useState<number | null>(null);
  const [tick, setTick]                 = useState(0);

  useEffect(() => {
    // Capture a local start time as soon as we get our first response.
    if (query.data && localStartMs === null) {
      const serverStart = query.data.startedAt
        ? Date.parse(query.data.startedAt)
        : null;
      setLocalStartMs(serverStart ?? Date.now());
    }
  }, [query.data, localStartMs]);

  useEffect(() => {
    const d = query.data;
    if (!d || d.status === 'success' || d.status === 'error') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [query.data]);

  void tick; // satisfy ESLint: used indirectly via Date.now() in elapsedSeconds

  const finishedAt = query.data?.finishedAt ? Date.parse(query.data.finishedAt) : 0;
  // eslint-disable-next-line react-hooks/purity
  const referenceMs = finishedAt || (localStartMs ? Date.now() : 0);
  const elapsedSeconds = localStartMs
    ? Math.max(0, Math.floor((referenceMs - localStartMs) / 1000))
    : 0;

  // ── Reset helper ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setLocalStartMs(null);
    setTick(0);
    if (executionId) {
      qc.removeQueries({ queryKey: ['agentStatus', executionId] });
    }
  }, [executionId, qc]);

  // ── Derived values ────────────────────────────────────────────────────────
  const rawStatus  = query.data?.status ?? null;
  const isDone     = rawStatus === 'success' || rawStatus === 'error';
  const status: AgentStatusValue = !executionId
    ? 'idle'
    : rawStatus ?? (query.data?.isTimestampId ? 'running' : 'idle');

  return {
    status,
    currentStep:        query.data?.currentStep ?? null,
    elapsedSeconds,
    empresasProcesadas: query.data?.empresasProcesadas ?? null,
    isTimestampId:      query.data?.isTimestampId ?? false,
    isDone,
    fetchError:         query.error,
    refetch:            query.refetch,
    reset,
  };
}
