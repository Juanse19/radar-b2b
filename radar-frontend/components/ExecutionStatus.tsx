'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import type { ExecutionStatus } from '@/lib/types';

interface Props {
  executionId: string;
  onComplete?: (status: ExecutionStatus) => void;
}

/** Returns true when the ID is a timestamp fallback (all digits, >10 chars). */
function isTimestampId(id: string): boolean {
  return /^\d{11,}$/.test(id);
}

export function ExecutionStatusBadge({ executionId, onComplete }: Props) {
  const isTimestamp = isTimestampId(executionId);

  const { data, isError } = useQuery<ExecutionStatus>({
    queryKey: ['execution', executionId],
    queryFn: () =>
      fetch(`/api/executions/${executionId}`).then(async r => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
    enabled: !isTimestamp,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || d.status === 'running' || d.status === 'waiting') return 4000;
      return false;
    },
    retry: 2,
  });

  useEffect(() => {
    if (data && (data.status === 'success' || data.status === 'error')) {
      onComplete?.(data);
    }
  }, [data, onComplete]);

  if (isTimestamp) {
    return (
      <div className="flex items-center gap-2 text-blue-600 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Escaneo en curso. Revisa la pestaña Resultados en 2-3 minutos.
      </div>
    );
  }

  if (isError) return (
    <div className="flex items-center gap-2 text-amber-600 text-sm">
      <Clock size={16} /> No se pudo obtener el estado. El escaneo puede seguir en curso.
    </div>
  );

  if (!data) return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
      <Loader2 size={16} className="animate-spin" /> Iniciando escaneo...
    </div>
  );

  const icons: Record<ExecutionStatus['status'], React.ReactNode> = {
    running: <Loader2 size={16} className="animate-spin text-blue-600" />,
    waiting: <Clock size={16} className="text-amber-600" />,
    success: <CheckCircle size={16} className="text-emerald-600" />,
    error: <XCircle size={16} className="text-red-600" />,
  };

  const messages: Record<ExecutionStatus['status'], string> = {
    running: `Escaneando empresas${data.empresasProcesadas ? ` · ${data.empresasProcesadas} procesadas` : ''}...`,
    waiting: 'En cola...',
    success: `✅ Escaneo completado${data.empresasProcesadas ? ` · ${data.empresasProcesadas} empresas` : ''}`,
    error: '❌ Error en el escaneo',
  };

  const textColor =
    data.status === 'success' ? 'text-emerald-600'
    : data.status === 'error' ? 'text-red-600'
    : 'text-blue-600';

  return (
    <div className={`flex items-center gap-2 text-sm ${textColor}`}>
      {icons[data.status]}
      {messages[data.status]}
    </div>
  );
}
