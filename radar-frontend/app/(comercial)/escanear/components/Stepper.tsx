'use client';

import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  current: 1 | 2 | 3;
  onGoto?: (step: 1 | 2 | 3) => void;
}

const STEPS: Array<{ step: 1 | 2 | 3; label: string }> = [
  { step: 1, label: '¿Qué?' },
  { step: 2, label: 'Configurar' },
  { step: 3, label: 'Revisar' },
];

export function Stepper({ current, onGoto }: Props) {
  return (
    <nav aria-label="Wizard progress" className="mb-8">
      {/* Connector + circle row */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isCurrent   = s.step === current;
          const isCompleted = s.step < current;
          const isClickable = !!onGoto && isCompleted;
          const isLast      = i === STEPS.length - 1;
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
                  isCurrent   ? { background: 'var(--agent-radar)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--agent-radar) 30%, transparent)' } :
                  isCompleted ? { background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)', outline: '1px solid color-mix(in srgb, var(--agent-radar) 40%, transparent)' } :
                  undefined
                }
              >
                {isCompleted ? <Check size={14} /> : s.step}
              </button>
              {!isLast && (
                <div
                  className="h-0.5 flex-1 transition-all duration-300 bg-border"
                  style={s.step < current ? { background: 'var(--agent-radar)' } : undefined}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      {/* Labels row */}
      <div className="mt-2 flex items-start">
        {STEPS.map((s, i) => {
          const isCurrent   = s.step === current;
          const isLast      = i === STEPS.length - 1;
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
              {!isLast && <div className="flex-1" />}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
