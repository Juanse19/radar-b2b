'use client';

import { cn } from '@/lib/utils';
import { scoreToCategorico } from '@/lib/comercial/calificador/scoring';
import type { Dimension, DimScores } from '@/lib/comercial/calificador/types';

const DIM_LABELS: Record<Dimension, string> = {
  impacto_presupuesto: 'Impacto presupuesto',
  multiplanta:         'Multiplanta',
  recurrencia:         'Recurrencia',
  referente_mercado:   'Referente del mercado',
  acceso_al_decisor:   'Acceso al decisor',
  anio_objetivo:       'Año objetivo',
  prioridad_comercial: 'Prioridad comercial',
  cuenta_estrategica:  'Cuenta estratégica',
};

// Order mirrors the official Matec spreadsheet: Cualitativa first, Estratégica last.
const DIM_ORDER: Dimension[] = [
  'impacto_presupuesto',
  'multiplanta',
  'recurrencia',
  'referente_mercado',
  'acceso_al_decisor',
  'anio_objetivo',
  'prioridad_comercial',
  'cuenta_estrategica',
];

function scoreColor(score: number): string {
  if (score >= 8) return 'bg-amber-500';
  if (score >= 5) return 'bg-blue-500';
  if (score >= 3) return 'bg-slate-400';
  return 'bg-muted-foreground/30';
}

/** Optional per-dimension categorical detail returned by the V2 LLM. */
export interface DimDetailUI {
  valor: string;
  justificacion?: string;
}

interface Props {
  scores:       Partial<DimScores>;
  /** V2: per-dimension { valor, justificacion } map. Optional for V1 backward compat. */
  dimensiones?: Partial<Record<Dimension, DimDetailUI>>;
  animate?:     boolean;
}

export function DimensionStrip({ scores, dimensiones, animate = true }: Props) {
  return (
    <div className="space-y-2">
      {DIM_ORDER.map((dim) => {
        const score    = scores[dim];
        const detail   = dimensiones?.[dim];
        const known    = score !== undefined;
        const pct      = known ? (score! / 10) * 100 : 0;
        const valor    = detail?.valor ?? (known ? scoreToCategorico(dim, score!) : null);

        return (
          <div key={dim} className="space-y-0.5" title={detail?.justificacion}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{DIM_LABELS[dim]}</span>
              <div className="flex items-center gap-2">
                {valor && (
                  <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {valor}
                  </span>
                )}
                <span className={cn('font-mono font-semibold tabular-nums', known ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {known ? score!.toFixed(1) : '—'}
                </span>
              </div>
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
