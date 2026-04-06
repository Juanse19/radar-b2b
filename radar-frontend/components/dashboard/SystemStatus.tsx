'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Execution {
  id: string | number;
  status: string;
  finished: boolean;
  startedAt?: string;
  stoppedAt?: string;
}

export function SystemStatus() {
  const { data: executions, isLoading } = useQuery<Execution[]>({
    queryKey: ['recentExecutions'],
    queryFn: () => fetch('/api/executions?limit=1').then(r => r.json()),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  const latest = Array.isArray(executions) ? executions[0] : null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 size={12} className="animate-spin" />
        Verificando N8N...
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
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
    <div className="flex items-center gap-1.5 text-xs">
      {isRunning && (
        <>
          <Loader2 size={12} className="animate-spin text-blue-400" />
          <span className="text-blue-400">N8N corriendo...</span>
        </>
      )}
      {isSuccess && (
        <>
          <CheckCircle2 size={12} className="text-green-400" />
          <span className="text-gray-400">Último scan: {fecha}</span>
        </>
      )}
      {isError && (
        <>
          <XCircle size={12} className="text-red-400" />
          <span className="text-red-400">Error en último scan</span>
        </>
      )}
    </div>
  );
}
