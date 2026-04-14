'use client';

// components/ExecutionStatus.tsx
//
// Compact inline badge that shows the live status of one execution.
// Migrated to use `useExecutionPolling` (Sprint 2.5) so polling logic
// lives in exactly one place across the codebase.
//
// This component is the lightweight cousin of <AgentPipelineCard /> — it just
// renders a one-line badge with icon + status, intended for places like the
// dashboard or the legacy /scan inline status. New code should prefer
// <AgentPipelineCard /> which has richer UI.

import { useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { useExecutionPolling, type ExecutionDTO } from '@/hooks/useExecutionPolling';
import type { ExecutionStatus as ExecutionStatusLegacy } from '@/lib/types';

interface Props {
  executionId: string;
  /** Called once when the polling reaches a terminal state. */
  onComplete?: (status: ExecutionStatusLegacy) => void;
}

export function ExecutionStatusBadge({ executionId, onComplete }: Props) {
  const { data, status, isTimestampId, fetchError } = useExecutionPolling(executionId);

  // Bridge to the legacy callback shape so existing callers don't break.
  useEffect(() => {
    if (!data || !onComplete) return;
    if (data.status === 'success' || data.status === 'error') {
      onComplete({
        id:                 data.n8n_execution_id,
        status:             data.status,
        startedAt:          data.started_at ?? undefined,
        finishedAt:         data.finished_at ?? undefined,
        empresasProcesadas: data.empresas_procesadas ?? undefined,
        currentStep:        data.current_step ?? undefined,
      });
    }
  }, [data, onComplete]);

  if (isTimestampId) {
    return (
      <div className="flex items-center gap-2 text-blue-300 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Escaneo en curso. Revisa la pestaña Resultados en 2-3 minutos.
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center gap-2 text-yellow-400 text-sm">
        <Clock size={16} /> No se pudo obtener el estado. El escaneo puede seguir en curso.
      </div>
    );
  }

  if (!data || status === 'idle') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
        <Loader2 size={16} className="animate-spin" /> Iniciando escaneo...
      </div>
    );
  }

  return <BadgeFor data={data} />;
}

function BadgeFor({ data }: { data: ExecutionDTO }) {
  const status = data.status;
  const procesadas = data.empresas_procesadas;
  const icons: Record<ExecutionDTO['status'], React.ReactNode> = {
    running: <Loader2 size={16} className="animate-spin text-blue-400" />,
    waiting: <Clock size={16} className="text-yellow-400" />,
    success: <CheckCircle size={16} className="text-green-400" />,
    error:   <XCircle size={16} className="text-red-400" />,
  };
  const messages: Record<ExecutionDTO['status'], string> = {
    running: data.current_step ?? `Escaneando empresas${procesadas ? ` · ${procesadas} procesadas` : ''}...`,
    waiting: 'En cola...',
    success: `✅ Escaneo completado${procesadas ? ` · ${procesadas} empresas` : ''}`,
    error:   '❌ Error en el escaneo',
  };
  const colorClass =
    status === 'success' ? 'text-green-400'
    : status === 'error' ? 'text-red-400'
    : 'text-blue-300';

  return (
    <div className={`flex items-center gap-2 text-sm ${colorClass}`}>
      {icons[status]}
      {messages[status]}
    </div>
  );
}
