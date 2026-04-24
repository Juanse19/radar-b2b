'use client';

import { cn } from '@/lib/utils';
import type { DimScores } from '@/lib/comercial/calificador/types';

const DIM_LABELS: Record<string, string> = {
  impacto_presupuesto: 'Impacto presupuesto',
  multiplanta:         'Multiplanta',
  recurrencia:         'Recurrencia',
  referente_mercado:   'Referente mercado',
  anio_objetivo:       'Año objetivo',
  ticket_estimado:     'Ticket estimado',
  prioridad_comercial: 'Prioridad comercial',
};

const DIM_ORDER = Object.keys(DIM_LABELS) as Array<keyof DimScores>;

function scoreColor(score: number): string {
  if (score >= 8) return 'bg-amber-500';
  if (score >= 5) return 'bg-blue-500';
  if (score >= 3) return 'bg-slate-400';
  return 'bg-muted-foreground/30';
}

interface Props {
  scores:   Partial<DimScores>;
  animate?: boolean;
}

export function DimensionStrip({ scores, animate = true }: Props) {
  return (
    <div className="space-y-2">
      {DIM_ORDER.map((dim) => {
        const score = scores[dim];
        const pct   = score !== undefined ? (score / 10) * 100 : 0;
        const known = score !== undefined;

        return (
          <div key={dim} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{DIM_LABELS[dim]}</span>
              <span className={cn('font-mono font-semibold tabular-nums', known ? 'text-foreground' : 'text-muted-foreground/40')}>
                {known ? score!.toFixed(1) : '—'}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  known ? scoreColor(score!) : 'bg-transparent',
                  animate && 'duration-700 ease-out',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
