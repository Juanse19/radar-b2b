// hooks/useInflightExecutions.ts
//
// Polls /api/executions to get the list of pipelines (grouped by pipeline_id)
// that are currently running OR finished within the last 10 minutes. Used by
// the global <RunningExecutionsTray /> to render its pill + expanded panel.
//
// Adaptive interval:
//   - 4s when at least one pipeline is running
//   - 20s when everything is idle (just to pick up new fires from other tabs)
//
// We expose `anyRunningOfAgent(agent)` so the manual form button can disable
// itself when the same agent type already has an in-flight execution.

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { fetchJson } from '@/lib/fetcher';
import type { PipelineDTO, AgentType } from '@/lib/db/types';

interface ApiResponse {
  pipelines: PipelineDTO[];
}

export interface UseInflightExecutionsResult {
  pipelines: PipelineDTO[];
  /** Pipelines whose status is `running` or `waiting`. */
  inflight: PipelineDTO[];
  /** Pipelines that finished within the last 10 minutes. */
  recent: PipelineDTO[];
  anyRunning: boolean;
  /** Returns true if any in-flight pipeline contains an agent of this type. */
  anyRunningOfAgent: (agent: AgentType) => boolean;
  /** Force a refetch — call this right after firing /api/agent. */
  invalidate: () => void;
  isLoading: boolean;
}

const STALE_AFTER_MS = 10 * 60 * 1000;

export function useInflightExecutions(): UseInflightExecutionsResult {
  const qc = useQueryClient();

  const query = useQuery<ApiResponse>({
    queryKey: ['inflight-executions'],
    queryFn:  () => fetchJson<ApiResponse>('/api/executions?limit=20'),
    refetchInterval: (q) => {
      const data = q.state.data;
      const anyRunning = !!data?.pipelines?.some(p => p.status === 'running');
      return anyRunning ? 4000 : 20000;
    },
  });

  const rawPipelines = query.data?.pipelines;

  const { inflight, recent } = useMemo(() => {
    const pipelines = rawPipelines ?? [];
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const inflight: PipelineDTO[] = [];
    const recent:   PipelineDTO[] = [];
    for (const p of pipelines) {
      if (p.status === 'running') {
        inflight.push(p);
      } else {
        const age = now - Date.parse(p.started_at);
        if (age <= STALE_AFTER_MS) recent.push(p);
      }
    }
    return { inflight, recent };
  }, [rawPipelines]);

  const pipelines = rawPipelines ?? [];
  const anyRunning = inflight.length > 0;

  const anyRunningOfAgent = useCallback(
    (agent: AgentType) =>
      inflight.some(p => p.agents.some(a => a.agent_type === agent)),
    [inflight],
  );

  const invalidate = useCallback(
    () => { qc.invalidateQueries({ queryKey: ['inflight-executions'] }); },
    [qc],
  );

  return {
    pipelines,
    inflight,
    recent,
    anyRunning,
    anyRunningOfAgent,
    invalidate,
    isLoading: query.isLoading,
  };
}
