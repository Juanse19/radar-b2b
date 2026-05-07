'use client';

import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

interface Props {
  current:  Step | 'live';
  onGoto?:  (step: Step) => void;
}

const STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Objetivo' },
  { step: 2, label: 'Configurar' },
  { step: 3, label: 'Revisar' },
];

const ACCENT      = 'var(--agent-contactos)';
const ACCENT_TINT = 'var(--agent-contactos-tint)';

export function ProspectorStepper({ current, onGoto }: Props) {
  const liveActive = current === 'live';
  const currentN: number = liveActive ? 4 : current;

  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isCurrent   = !liveActive && s.step === current;
          const isCompleted = currentN > s.step;
          const isClickable = !!onGoto && isCompleted;
          return (
            <Fragment key={s.step}>
              <button
                type="button"
                onClick={() => isClickable ? onGoto?.(s.step) : undefined}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  !isCurrent && !isCompleted && 'bg-muted text-muted-foreground',
                )}
                style={
                  isCurrent
                    ? { background: ACCENT, color: '#fff', boxShadow: `0 2px 8px color-mix(in srgb, ${ACCENT} 30%, transparent)` }
                    : isCompleted
                      ? { background: ACCENT_TINT, color: ACCENT, outline: `1px solid color-mix(in srgb, ${ACCENT} 40%, transparent)` }
                      : undefined
                }
              >
                {isCompleted ? <Check size={14} /> : s.step}
              </button>
              <div
                className="h-0.5 flex-1 transition-all duration-300 bg-border"
                style={s.step < currentN ? { background: ACCENT } : undefined}
              />
            </Fragment>
          );
        })}
        <span
          className={cn(
            'flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition-all',
            !liveActive && 'bg-muted text-muted-foreground',
          )}
          style={liveActive
            ? { background: ACCENT, color: '#fff', boxShadow: `0 2px 8px color-mix(in srgb, ${ACCENT} 30%, transparent)` }
            : undefined
          }
        >
          En vivo
        </span>
      </div>

      <div className="mt-2 flex items-start">
        {STEPS.map((s, i) => {
          const isCurrent = !liveActive && s.step === current;
          return (
            <Fragment key={`label-${s.step}`}>
              <span
                className={cn(
                  'w-8 shrink-0 text-center text-[11px] leading-tight',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
              <div className="flex-1" />
            </Fragment>
          );
        })}
        <span
          className={cn(
            'shrink-0 px-3 text-[11px] leading-tight',
            liveActive ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          Resultados
        </span>
      </div>
    </nav>
  );
}
