'use client';

import { cn } from '@/lib/utils';
import type { CompanyScanState } from '@/lib/radar-v2/types';

interface Props {
  items: CompanyScanState[];
}

const statusLabel: Record<string, string> = {
  idle:     'En cola',
  scanning: 'Escaneando...',
  done:     'Completado',
  error:    'Error',
};

const statusColor: Record<string, string> = {
  idle:     'bg-muted text-muted-foreground',
  scanning: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done:     'bg-green-500/15 text-green-700 dark:text-green-400',
  error:    'bg-destructive/15 text-destructive',
};

const radarBadge = (activo: string | undefined) => {
  if (!activo) return null;
  return activo === 'Sí'
    ? <span className="ml-2 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">✓ Señal activa</span>
    : <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600">✗ Descartada</span>;
};

export function ScanProgress({ items }: Props) {
  return (
    <div className="space-y-2">
      {items.map(({ company, status, result, error }) => (
        <div
          key={company.id}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors',
            status === 'scanning' && 'border-blue-500/30',
            status === 'done'     && 'border-green-500/30',
            status === 'error'    && 'border-destructive/30',
            status === 'idle'     && 'border-border',
          )}
        >
          {/* Spinner / dot */}
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
            {status === 'scanning' ? (
              <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : status === 'done' ? (
              <span className="text-green-600">✓</span>
            ) : status === 'error' ? (
              <span className="text-destructive">✗</span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            )}
          </span>

          <span className="flex-1 min-w-0">
            <span className="font-medium truncate">{company.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{company.country}</span>
            {status === 'done' && radarBadge(result?.radar_activo)}
            {status === 'error' && error && (
              <span className="ml-2 text-xs text-destructive truncate">{error}</span>
            )}
          </span>

          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor[status])}>
            {statusLabel[status]}
          </span>
        </div>
      ))}
    </div>
  );
}
