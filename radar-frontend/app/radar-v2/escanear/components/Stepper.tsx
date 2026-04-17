'use client';

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
    <ol className="flex items-center justify-between gap-2" aria-label="Wizard progress">
      {STEPS.map((s, i) => {
        const isCurrent   = s.step === current;
        const isCompleted = s.step < current;
        const isClickable = !!onGoto && isCompleted;
        const isLast      = i === STEPS.length - 1;
        return (
          <li key={s.step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => isClickable && onGoto?.(s.step)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  isCurrent && 'border-primary bg-primary text-primary-foreground',
                  isCompleted && 'border-primary bg-primary/20 text-primary',
                  !isCurrent && !isCompleted && 'border-border bg-background text-muted-foreground',
                  isClickable && 'cursor-pointer hover:bg-primary/30',
                )}
              >
                {isCompleted ? <Check size={14} /> : s.step}
              </button>
              <span
                className={cn(
                  'mt-1.5 text-xs',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'mx-2 mb-6 h-0.5 flex-1',
                  s.step < current ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
