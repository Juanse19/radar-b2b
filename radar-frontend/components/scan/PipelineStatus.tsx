'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Radar,
  Users,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ExecutionStatus } from '@/lib/types';

export interface PipelineStatusProps {
  executionId: string | null;
  linea: string;
  onComplete?: () => void;
}

type StepStatus = 'idle' | 'running' | 'done' | 'error';
type StepColor = 'blue' | 'emerald' | 'violet';

interface PipelineStep {
  id: string;
  num: string;
  label: string;
  Icon: LucideIcon;
  desc: string;
  color: StepColor;
  thresholdSec: number;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'calificador',
    num: '01',
    label: 'Calificador',
    Icon: ClipboardCheck,
    desc: 'Evalúa y puntúa cada empresa (score 0-10)',
    color: 'blue',
    thresholdSec: 0,
  },
  {
    id: 'radar',
    num: '02',
    label: 'Radar',
    Icon: Radar,
    desc: 'Detecta señales de inversión (score 0-100)',
    color: 'emerald',
    thresholdSec: 15,
  },
  {
    id: 'prospector',
    num: '03',
    label: 'Prospector',
    Icon: Users,
    desc: 'Extrae contactos Apollo por empresa',
    color: 'violet',
    thresholdSec: 45,
  },
];

/* Light-theme color tokens for each step */
const COLOR_TOKENS: Record<StepColor, {
  card: string;
  icon: string;
  label: string;
  connector: string;
  bar: string;
}> = {
  blue: {
    card:      'bg-blue-50 border-blue-200',
    icon:      'text-blue-600',
    label:     'text-blue-700',
    connector: 'bg-blue-400',
    bar:       'bg-blue-500',
  },
  emerald: {
    card:      'bg-emerald-50 border-emerald-200',
    icon:      'text-emerald-600',
    label:     'text-emerald-700',
    connector: 'bg-emerald-400',
    bar:       'bg-emerald-500',
  },
  violet: {
    card:      'bg-violet-50 border-violet-200',
    icon:      'text-violet-600',
    label:     'text-violet-700',
    connector: 'bg-violet-400',
    bar:       'bg-violet-500',
  },
};

function isTimestampId(id: string): boolean {
  return /^\d{11,}$/.test(id);
}

function getStepIndexByElapsed(elapsed: number): number {
  if (elapsed >= PIPELINE_STEPS[2]!.thresholdSec) return 2;
  if (elapsed >= PIPELINE_STEPS[1]!.thresholdSec) return 1;
  return 0;
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />;
  if (status === 'error') return <XCircle size={16} className="text-red-600 flex-shrink-0" />;
  if (status === 'running') {
    return (
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
    );
  }
  return <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />;
}

export function PipelineStatus({ executionId, linea, onComplete }: PipelineStatusProps) {
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [completeCalled, setCompleteCalled] = useState(false);

  const isTimestamp = executionId ? isTimestampId(executionId) : true;

  const { data: execStatus } = useQuery<ExecutionStatus>({
    queryKey: ['execution', executionId],
    queryFn: () =>
      fetch(`/api/executions/${executionId}`).then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json() as Promise<ExecutionStatus>;
      }),
    enabled: !!executionId && !isTimestamp && !allDone && !hasError,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || d.status === 'running' || d.status === 'waiting') return 3000;
      return false;
    },
    retry: 2,
  });

  useEffect(() => {
    if (!executionId || allDone || hasError) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        setCurrentStep(getStepIndexByElapsed(next) as 0 | 1 | 2);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [executionId, allDone, hasError]);

  const handleComplete = useCallback(() => {
    if (!completeCalled) {
      setCompleteCalled(true);
      onComplete?.();
    }
  }, [completeCalled, onComplete]);

  useEffect(() => {
    if (!execStatus) return;
    if (execStatus.status === 'success') {
      setTimeout(() => {
        setAllDone(true);
        setCurrentStep(2);
        handleComplete();
      }, 1000);
    } else if (execStatus.status === 'error') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasError(true);
    }
  }, [execStatus, handleComplete]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCurrentStep(0);
    setElapsedSeconds(0);
    setAllDone(false);
    setHasError(false);
    setCompleteCalled(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [executionId]);

  if (!executionId) return null;

  function getStepStatus(idx: number): StepStatus {
    if (hasError && idx === currentStep) return 'error';
    if (allDone) return 'done';
    if (idx < currentStep) return 'done';
    if (idx === currentStep) return 'running';
    return 'idle';
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {!allDone && !hasError && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          {allDone && <CheckCircle size={14} className="text-emerald-600" />}
          {hasError && <XCircle size={14} className="text-red-600" />}
          <span className="text-sm font-semibold text-foreground">
            {allDone ? 'Pipeline completado' : hasError ? 'Error en pipeline' : 'Pipeline en ejecución'}
          </span>
          <span className="text-xs text-muted-foreground">— {linea}</span>
        </div>
        {!allDone && !hasError && (
          <span className="text-xs text-muted-foreground tabular-nums">{elapsedSeconds}s</span>
        )}
      </div>

      {/* Steps */}
      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 md:gap-0">
        {PIPELINE_STEPS.map((step, idx) => {
          const status = getStepStatus(idx);
          const tokens = COLOR_TOKENS[step.color];
          const isActive = status === 'running';
          const isDone   = status === 'done';
          const isErr    = status === 'error';
          const isIdle   = status === 'idle';

          const cardColor =
            isActive || isDone ? tokens.card
            : isErr ? 'bg-red-50 border-red-200'
            : 'bg-surface-muted border-border';

          return (
            <div key={step.id} className="flex flex-col md:flex-row flex-1 items-center">
              {/* Step card */}
              <div className={`flex-1 rounded-xl border-2 p-4 transition-all duration-500 w-full ${cardColor}`}>
                {/* Top: step number + dot */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold tracking-wider ${
                    isActive || isDone ? tokens.label
                    : isErr ? 'text-red-600'
                    : 'text-muted-foreground'
                  }`}>
                    WF{step.num}
                  </span>
                  <StatusDot status={status} />
                </div>

                {/* Icon + label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <step.Icon size={18} className={
                    isActive ? tokens.icon
                    : isDone  ? 'text-emerald-600'
                    : isErr   ? 'text-red-600'
                    : 'text-muted-foreground'
                  } />
                  <span className={`text-sm font-semibold ${
                    isActive ? 'text-foreground'
                    : isDone  ? 'text-emerald-700'
                    : isErr   ? 'text-red-700'
                    : isIdle  ? 'text-muted-foreground'
                    : 'text-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-snug">{step.desc}</p>

                {/* Progress bar when running */}
                {isActive && (
                  <div className="mt-3 h-0.5 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full animate-pulse ${tokens.bar}`} style={{ width: '60%' }} />
                  </div>
                )}
              </div>

              {/* Connector between steps */}
              {idx < PIPELINE_STEPS.length - 1 && (
                <>
                  <div className="hidden md:flex items-center shrink-0 px-1">
                    <div className={`h-px w-6 transition-colors duration-700 ${
                      idx < currentStep || allDone ? tokens.connector : 'bg-border'
                    }`} />
                    <div className={`w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent transition-colors duration-700 ${
                      idx < currentStep || allDone
                        ? step.color === 'blue' ? 'border-l-blue-400'
                          : step.color === 'emerald' ? 'border-l-emerald-400'
                          : 'border-l-violet-400'
                        : 'border-l-border'
                    }`} />
                  </div>
                  <div className="md:hidden flex justify-center py-1">
                    <div className={`w-px h-4 transition-colors duration-700 ${
                      idx < currentStep || allDone ? tokens.connector : 'bg-border'
                    }`} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isTimestamp && (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          El progreso se estima por tiempo — no hay ID de ejecución real disponible.
        </p>
      )}
    </div>
  );
}
