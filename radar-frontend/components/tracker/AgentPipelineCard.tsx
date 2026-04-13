// components/tracker/AgentPipelineCard.tsx
//
// Renders one ejecución (or one agent inside a pipeline) as a card.
// Used both inside the floating tray and inline in pages like /scan and
// /contactos to show "this is the run you just fired".
//
// Two variants:
//   - Standalone (just an executionId) → uses useExecutionPolling to fetch
//     and refetch live status. Also has a stop button while running.
//   - Embedded (you already have the EjecucionRow + elapsed_seconds) → renders
//     statically. Used inside the tray which already has the pipeline data.

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useExecutionPolling } from '@/hooks/useExecutionPolling';
import { StatusDot, type DotStatus } from './StatusDot';
import { Plane, Radar as RadarIcon, Users, Square, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AgentType, EjecucionRow } from '@/lib/db/types';

const AGENT_META: Record<AgentType, { label: string; icon: LucideIcon; accent: string }> = {
  calificador: { label: 'Calificador', icon: Plane,     accent: 'text-blue-600' },
  radar:       { label: 'Radar',       icon: RadarIcon, accent: 'text-violet-600' },
  prospector:  { label: 'Prospector',  icon: Users,     accent: 'text-emerald-600' },
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function statusToDot(status: string | null | undefined): DotStatus {
  if (status === 'success' || status === 'error' || status === 'waiting' || status === 'running' || status === 'partial') {
    return status as DotStatus;
  }
  return 'idle';
}

// ── Stop helper — calls POST /api/executions/[id]/stop ──────────────────────

async function stopExecution(executionId: string): Promise<void> {
  const res = await fetch(`/api/executions/${executionId}/stop`, { method: 'POST' });
  if (!res.ok && res.status !== 207) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.n8nError ?? `Error ${res.status}`);
  }
}

/** Dismiss a stuck/timestamp execution by marking it as error in the DB. */
async function dismissExecution(dbId: number): Promise<void> {
  const res = await fetch(`/api/executions/${dbId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'error', error_msg: 'Descartado manualmente' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Error ${res.status}`);
  }
}

// ── Variant 1: standalone, polls itself ─────────────────────────────────────

interface StandaloneProps {
  executionId: string | null | undefined;
  testId?: string;
}

export function AgentPipelineCard({ executionId, testId }: StandaloneProps) {
  const { data, status, currentStep, elapsedSeconds, isTimestampId, refetch } = useExecutionPolling(executionId);
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState(false);

  if (!executionId) return null;

  const agent: AgentType = data?.agent_type ?? 'calificador';
  const meta = AGENT_META[agent];
  const Icon = meta.icon;
  const isRunning = status === 'running' || status === 'waiting';

  async function handleStop() {
    setStopping(true);
    try {
      await stopExecution(executionId!);
      toast.success('Ejecución detenida');
      // Invalidate all execution-related queries so the tray refreshes.
      await queryClient.invalidateQueries({ queryKey: ['inflightExecutions'] });
      refetch();
    } catch (err) {
      toast.error(`No se pudo detener: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setStopping(false);
    }
  }

  return (
    <div
      data-testid={testId ?? `agent-card-${agent}`}
      className="rounded-xl border border-border bg-card p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={cn('shrink-0', meta.accent)} />
          <span className="font-medium text-foreground text-sm truncate">{meta.label}</span>
          <StatusDot status={statusToDot(status)} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
          {isRunning && !isTimestampId && (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopping}
              title="Detener ejecución"
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                stopping
                  ? 'text-muted-foreground border-border cursor-wait'
                  : 'text-red-400 border-red-800/60 hover:bg-red-900/20',
              )}
            >
              <Square size={10} className={stopping ? 'animate-pulse' : ''} />
              {stopping ? '…' : 'Detener'}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate" title={currentStep ?? undefined}>
        {isTimestampId
          ? 'Sin tracking en tiempo real (n8n no devolvió execution id)'
          : currentStep ?? (status === 'running' ? 'En cola…' : status === 'success' ? 'Completado' : status === 'error' ? 'Falló' : '—')}
      </p>
      {status === 'running' && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted/60">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
        </div>
      )}
      {data?.error_msg && (
        <p className="text-xs text-red-600 truncate" title={data.error_msg}>
          {data.error_msg}
        </p>
      )}
    </div>
  );
}

// ── Variant 2: embedded with full row data already provided ─────────────────

interface EmbeddedProps {
  agent: EjecucionRow & { elapsed_seconds: number };
  testId?: string;
  /** If passed, a stop button is shown while the execution is running. */
  onStop?: (executionId: string) => void;
}

export function AgentPipelineCardEmbedded({ agent: row, testId, onStop }: EmbeddedProps) {
  const meta = AGENT_META[row.agent_type] ?? AGENT_META.calificador;
  const Icon = meta.icon;
  const isRunning = row.estado === 'running' || row.estado === 'waiting';
  const [stopping, setStopping] = useState(false);
  const queryClient = useQueryClient();

  async function handleStop() {
    const id = row.n8n_execution_id ?? String(row.id);
    setStopping(true);
    try {
      await stopExecution(id);
      toast.success('Ejecución detenida');
      await queryClient.invalidateQueries({ queryKey: ['inflightExecutions'] });
      onStop?.(id);
    } catch (err) {
      toast.error(`No se pudo detener: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setStopping(false);
    }
  }

  const isTimestamp = /^\d{11,}$/.test(row.n8n_execution_id ?? '');
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await dismissExecution(row.id);
      toast.success('Ejecución descartada');
      await queryClient.invalidateQueries({ queryKey: ['inflight-executions'] });
    } catch (err) {
      toast.error(`No se pudo descartar: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div
      data-testid={testId ?? `agent-card-${row.agent_type}`}
      className="rounded-xl border border-border bg-card p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={cn('shrink-0', meta.accent)} />
          <span className="font-medium text-foreground text-sm truncate">{meta.label}</span>
          <StatusDot status={statusToDot(row.estado)} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatElapsed(row.elapsed_seconds)}
          </span>
          {isRunning && !isTimestamp && (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopping}
              title="Detener ejecución"
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                stopping
                  ? 'text-muted-foreground border-border cursor-wait'
                  : 'text-red-400 border-red-800/60 hover:bg-red-900/20',
              )}
            >
              <Square size={10} className={stopping ? 'animate-pulse' : ''} />
              {stopping ? '…' : 'Detener'}
            </button>
          )}
          {isRunning && isTimestamp && (
            <button
              type="button"
              onClick={handleDismiss}
              disabled={dismissing}
              title="Descartar — sin tracking en tiempo real"
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                dismissing
                  ? 'text-muted-foreground border-border cursor-wait'
                  : 'text-amber-400 border-amber-800/60 hover:bg-amber-900/20',
              )}
            >
              <X size={10} className={dismissing ? 'animate-pulse' : ''} />
              {dismissing ? '…' : 'Descartar'}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate" title={row.current_step ?? undefined}>
        {row.current_step ?? (row.estado === 'running'
          ? 'En cola…'
          : row.estado === 'success' ? 'Completado'
          : row.estado === 'error' ? 'Falló'
          : '—')}
      </p>
      {row.linea_negocio && (
        <p className="text-[11px] text-muted-foreground/70">
          Línea: {row.linea_negocio}
          {row.batch_size ? ` · ${row.batch_size} ${row.batch_size === 1 ? 'empresa' : 'empresas'}` : ''}
        </p>
      )}
      {row.estado === 'running' && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted/60">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
        </div>
      )}
      {row.error_msg && (
        <p className="text-xs text-red-600 truncate" title={row.error_msg}>
          {row.error_msg}
        </p>
      )}
    </div>
  );
}
