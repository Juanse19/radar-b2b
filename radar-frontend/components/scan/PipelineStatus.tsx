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

const COLOR_TOKENS: Record<StepColor, {
  card: string;
  icon: string;
  label: string;
  connector: string;
}> = {
  blue: {
    card: 'bg-blue-950/60 border-blue-700',
    icon: 'text-blue-400',
    label: 'text-blue-400',
    connector: 'bg-blue-500',
  },
  emerald: {
    card: 'bg-emerald-950/60 border-emerald-700',
    icon: 'text-emerald-400',
    label: 'text-emerald-400',
    connector: 'bg-emerald-500',
  },
  violet: {
    card: 'bg-violet-950/60 border-violet-700',
    icon: 'text-violet-400',
    label: 'text-violet-400',
    connector: 'bg-violet-500',
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

function StatusDot({ status, color }: { status: StepStatus; color: StepColor }) {
  if (status === 'done') {
    return <CheckCircle size={16} className="text-green-400 flex-shrink-0" />;
  }
  if (status === 'error') {
    return <XCircle size={16} className="text-red-400 flex-shrink-0" />;
  }
  if (status === 'running') {
    const glowColor =
      color === 'blue'
        ? 'shadow-[0_0_6px_rgba(96,165,250,0.8)]'
        : color === 'emerald'
        ? 'shadow-[0_0_6px_rgba(52,211,153,0.8)]'
        : 'shadow-[0_0_6px_rgba(167,139,250,0.8)]';
    return (
      <span
        className={`w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0 ${glowColor}`}
      />
    );
  }
  // idle
  return <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />;
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

  // Elapsed-time ticker
  useEffect(() => {
    if (!executionId || allDone || hasError) return;

    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        const stepIdx = getStepIndexByElapsed(next) as 0 | 1 | 2;
        setCurrentStep(stepIdx);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [executionId, allDone, hasError]);

  // React to execution status changes
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
      setHasError(true);
    }
  }, [execStatus, handleComplete]);

  // Reset when executionId changes
  useEffect(() => {
    setCurrentStep(0);
    setElapsedSeconds(0);
    setAllDone(false);
    setHasError(false);
    setCompleteCalled(false);
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
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          )}
          {allDone && <CheckCircle size={14} className="text-green-400" />}
          {hasError && <XCircle size={14} className="text-red-400" />}
          <span className="text-sm font-semibold text-foreground">
            {allDone
              ? 'Pipeline completado'
              : hasError
              ? 'Error en pipeline'
              : 'Pipeline en ejecución'}
          </span>
          <span className="text-xs text-muted-foreground">— {linea}</span>
        </div>
        {!allDone && !hasError && (
          <span className="text-xs text-muted-foreground tabular-nums">{elapsedSeconds}s</span>
        )}
      </div>

      {/* Steps — horizontal on md+, vertical on mobile */}
      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 md:gap-0">
        {PIPELINE_STEPS.map((step, idx) => {
          const status = getStepStatus(idx);
          const tokens = COLOR_TOKENS[step.color];
          const isActive = status === 'running';
          const isDone = status === 'done';
          const isIdle = status === 'idle';
          const isErr = status === 'error';

          const cardBase = 'flex-1 rounded-xl border p-4 transition-all duration-500';
          const cardColor =
            isActive || isDone
              ? tokens.card
              : isErr
              ? 'bg-red-950/60 border-red-700'
              : 'bg-surface-muted/40 border-border';

          return (
            <div key={step.id} className="flex flex-col md:flex-row flex-1 items-center">
              {/* Step card */}
              <div className={`${cardBase} ${cardColor} w-full`}>
                {/* Top row: num + status dot */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-bold tracking-wider ${
                      isActive || isDone
                        ? tokens.label
                        : isErr
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    WF{step.num}
                  </span>
                  <StatusDot status={status} color={step.color} />
                </div>

                {/* Icon + label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <step.Icon
                    size={18}
                    className={
                      isActive
                        ? tokens.icon
                        : isDone
                        ? 'text-green-400'
                        : isErr
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                    }
                  />
                  <span
                    className={`text-sm font-semibold ${
                      isActive
                        ? 'text-white'
                        : isDone
                        ? 'text-green-300'
                        : isErr
                        ? 'text-red-300'
                        : isIdle
                        ? 'text-muted-foreground'
                        : 'text-white'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Description */}
                <p
                  className={`text-xs leading-snug ${
                    isActive ? 'text-muted-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.desc}
                </p>

                {/* Running indicator */}
                {isActive && (
                  <div className="mt-3 h-0.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full animate-pulse ${
                        step.color === 'blue'
                          ? 'bg-blue-500'
                          : step.color === 'emerald'
                          ? 'bg-emerald-500'
                          : 'bg-violet-500'
                      }`}
                      style={{ width: '60%' }}
                    />
                  </div>
                )}
              </div>

              {/* Connector (only between steps) */}
              {idx < PIPELINE_STEPS.length - 1 && (
                <>
                  {/* Desktop: horizontal arrow */}
                  <div className="hidden md:flex items-center flex-shrink-0 px-1">
                    <div
                      className={`h-px w-6 transition-colors duration-700 ${
                        idx < currentStep || allDone
                          ? tokens.connector
                          : 'bg-surface-muted'
                      }`}
                    />
                    <div
                      className={`w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent transition-colors duration-700 ${
                        idx < currentStep || allDone
                          ? `border-l-${step.color === 'blue' ? 'blue' : step.color === 'emerald' ? 'emerald' : 'violet'}-500`
                          : 'border-l-gray-700'
                      }`}
                    />
                  </div>
                  {/* Mobile: vertical connector */}
                  <div className="md:hidden flex justify-center py-1">
                    <div
                      className={`w-px h-4 transition-colors duration-700 ${
                        idx < currentStep || allDone
                          ? tokens.connector
                          : 'bg-surface-muted'
                      }`}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Timestamp fallback note */}
      {isTimestamp && (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          El progreso se estima por tiempo — no hay ID de ejecución real disponible.
        </p>
      )}
    </div>
  );
}
