'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import type { ExecutionStatus } from '@/lib/types';

interface Execution {
  id: string | number;
  status: string;
  finished: boolean;
  startedAt?: string;
  stoppedAt?: string;
}

interface SystemStatusProps {
  activeExecutionId?: string | null;
}

const STEP_LABELS = ['Calificador', 'Radar', 'Prospector'];
const STEP_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-violet-400'];
const STEP_THRESHOLDS = [0, 15, 45];

function isTimestampId(id: string): boolean {
  return /^\d{11,}$/.test(id);
}

function MiniPipelineIndicator({ executionId }: { executionId: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [allDone, setAllDone] = useState(false);

  const isTimestamp = isTimestampId(executionId);

  const { data: execStatus } = useQuery<ExecutionStatus>({
    queryKey: ['execution', executionId],
    queryFn: () =>
      fetch(`/api/executions/${executionId}`).then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json() as Promise<ExecutionStatus>;
      }),
    enabled: !isTimestamp && !allDone,
    refetchInterval: (query) => {
      const d = query.state.data;
      // 6s en lugar de 3s — el dashboard se siente igual de "vivo" pero
      // libera el main thread la mitad del tiempo.
      if (!d || d.status === 'running' || d.status === 'waiting') return 6000;
      return false;
    },
    retry: 2,
  });

  useEffect(() => {
    if (allDone) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [allDone]);

  useEffect(() => {
    if (execStatus?.status === 'success') setAllDone(true);
  }, [execStatus]);

  const currentStep = allDone
    ? 3
    : elapsed >= STEP_THRESHOLDS[2]!
    ? 2
    : elapsed >= STEP_THRESHOLDS[1]!
    ? 1
    : 0;

  const isError = execStatus?.status === 'error';

  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const isDone = allDone || i < currentStep;
        const isActive = !allDone && i === currentStep;
        const dotColor = isDone
          ? STEP_COLORS[i]
          : isActive
          ? STEP_COLORS[i]
          : 'bg-gray-600';
        return (
          <div key={label} className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${dotColor} ${
                isActive && !isError ? 'animate-pulse' : ''
              } ${isError && i === currentStep ? 'bg-red-400' : ''}`}
              title={label}
            />
            <span
              className={`text-xs hidden lg:inline transition-colors duration-300 ${
                isDone
                  ? 'text-green-400'
                  : isActive
                  ? 'text-blue-300'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span className="text-muted-foreground text-xs hidden lg:inline">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SystemStatus({ activeExecutionId }: SystemStatusProps) {
  const { data: executions, isLoading } = useQuery<Execution[]>({
    queryKey: ['recentExecutions'],
    queryFn: () => fetch('/api/executions?limit=1').then(r => r.json()),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  const latest = Array.isArray(executions) ? executions[0] : null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" />
        Verificando N8N...
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={12} />
        Sin ejecuciones recientes
      </div>
    );
  }

  const isRunning = !latest.finished && latest.status !== 'error';
  const isError   = latest.status === 'error';
  const isSuccess = latest.finished && !isError;

  const fechaStr = latest.stoppedAt ?? latest.startedAt;
  const fecha = fechaStr ? new Date(fechaStr).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '—';

  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      {isRunning && (
        <>
          <Loader2 size={12} className="animate-spin text-blue-400" />
          <span className="text-blue-400">N8N corriendo...</span>
        </>
      )}
      {isSuccess && (
        <>
          <CheckCircle2 size={12} className="text-green-400" />
          <span className="text-muted-foreground">Último scan: {fecha}</span>
        </>
      )}
      {isError && (
        <>
          <XCircle size={12} className="text-red-400" />
          <span className="text-red-400">Error en último scan</span>
        </>
      )}
      {/* Mini pipeline indicator when there's an active execution */}
      {activeExecutionId && (
        <>
          <span className="text-muted-foreground">·</span>
          <MiniPipelineIndicator executionId={activeExecutionId} />
        </>
      )}
    </div>
  );
}
