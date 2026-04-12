// hooks/useExecutionPolling.ts
//
// Single source of truth for polling one ejecución's status.
// Used by:
//   - <AgentPipelineCard /> in the tracker tray
//   - <ExecutionStatusBadge /> (legacy, will be migrated in Sprint 2.5)
//   - The dashboard's MiniPipelineIndicator
//
// Features:
//   - Adaptive interval: polls every `intervalMs` (default 4s) while running,
//     stops as soon as the status is terminal (success/error).
//   - Timestamp guard: when the executionId is a Date.now() fallback (i.e.
//     n8n didn't return a real id), we never poll — just return the local
//     "we don't really know" state.
//   - Tolerates 500/network errors silently — UI shows the last known state.
//
// Returns the merged DTO from `GET /api/executions/[id]` plus a derived
// `elapsedSeconds` value computed client-side from `started_at`.

'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/fetcher';
import type { AgentType } from '@/lib/db/types';

export interface ExecutionDTO {
  id: number | null;
  n8n_execution_id: string;
  pipeline_id: string | null;
  agent_type: AgentType | null;
  linea_negocio: string | null;
  trigger_type: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: 'running' | 'success' | 'error' | 'waiting';
  current_step: string | null;
  empresas_procesadas: number | null;
  error_msg: string | null;
}

export interface UseExecutionPollingOptions {
  /** How often to poll while the execution is in flight. Defaults to 4000ms. */
  intervalMs?: number;
}

export interface UseExecutionPollingResult {
  data: ExecutionDTO | null;
  status: ExecutionDTO['status'] | 'idle';
  currentStep: string | null;
  /** Seconds since `started_at`, recomputed every second while running. */
  elapsedSeconds: number;
  /** Error from the polling fetch — distinct from execution.error_msg. */
  fetchError: unknown;
  isTimestampId: boolean;
  refetch: () => Promise<unknown>;
}

/** A timestamp fallback id is a long pure-digit string (Date.now() ~13 digits). */
function isTimestampLike(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^\d{10,}$/.test(id);
}

export function useExecutionPolling(
  executionId: string | null | undefined,
  opts: UseExecutionPollingOptions = {},
): UseExecutionPollingResult {
  const intervalMs = opts.intervalMs ?? 4000;
  const isTimestampId = isTimestampLike(executionId);

  const query = useQuery<ExecutionDTO>({
    queryKey: ['execution', executionId],
    queryFn:  () => fetchJson<ExecutionDTO>(`/api/executions/${executionId}`),
    enabled:  !!executionId && !isTimestampId,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return intervalMs;
      if (d.status === 'running' || d.status === 'waiting') return intervalMs;
      // Terminal — stop polling.
      return false;
    },
    // 4xx never retries (handled by global Providers retryFn), 5xx retries
    // up to 1 time. Errors don't crash — they're surfaced via `fetchError`.
  });

  // Recompute elapsed seconds every second while running. Cheap because the
  // hook is unmounted as soon as the card disappears.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!query.data || query.data.status !== 'running') return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [query.data]);

  const startedAt = query.data?.started_at ? Date.parse(query.data.started_at) : 0;
  const finishedAt = query.data?.finished_at ? Date.parse(query.data.finished_at) : 0;
  // eslint-disable-next-line react-hooks/purity
  const referenceTime = finishedAt || (startedAt ? Date.now() : 0);
  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((referenceTime - startedAt) / 1000))
    : 0;

  // Touch `tick` so the linter knows we depend on it for the recompute.
  void tick;

  return {
    data:           query.data ?? null,
    status:         query.data?.status ?? (isTimestampId ? 'running' : 'idle'),
    currentStep:    query.data?.current_step ?? null,
    elapsedSeconds,
    fetchError:     query.error,
    isTimestampId,
    refetch:        query.refetch,
  };
}
