'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FeedbackMotivo } from '@/lib/comercial/types';

interface FeedbackButtonsProps {
  resultadoId: string;
  onDone?:     () => void;
}

type Phase = 'idle' | 'voting_neg' | 'done';

const MOTIVOS: Array<{ value: FeedbackMotivo; label: string }> = [
  { value: 'fuente_falsa',        label: 'Fuente falsa' },
  { value: 'fecha_equivocada',    label: 'Fecha equivocada' },
  { value: 'empresa_irrelevante', label: 'Empresa irrelevante' },
  { value: 'senal_real',          label: 'Señal real confirmada' },
  { value: 'otro',                label: 'Otro' },
];

export function FeedbackButtons({ resultadoId, onDone }: FeedbackButtonsProps) {
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [motivo,     setMotivo]     = useState<FeedbackMotivo | ''>('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(util: boolean, motivoValue?: FeedbackMotivo) {
    setSubmitting(true);
    try {
      await fetch('/api/comercial/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          resultado_id: resultadoId,
          util,
          ...(motivoValue ? { motivo: motivoValue } : {}),
        }),
      });
    } catch {
      // best-effort — still show done state
    } finally {
      setSubmitting(false);
    }
    setPhase('done');
    onDone?.();
  }

  function handlePositive() {
    void submit(true);
  }

  function handleNegativeConfirm() {
    if (!motivo) return;
    void submit(false, motivo as FeedbackMotivo);
  }

  if (phase === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check size={13} className="text-green-500" />
        Feedback registrado
      </span>
    );
  }

  if (phase === 'voting_neg') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Motivo:</p>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMotivo(m.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                motivo === m.value
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant="danger"
            className="h-7 px-3 text-xs"
            onClick={handleNegativeConfirm}
            disabled={!motivo || submitting}
            aria-label="Confirmar feedback negativo"
          >
            Enviar
          </Button>
          <button
            type="button"
            onClick={() => { setPhase('idle'); setMotivo(''); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">¿Útil?</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-600"
        onClick={handlePositive}
        aria-label="Marcar señal como útil"
        disabled={submitting}
      >
        <ThumbsUp size={13} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-600"
        onClick={() => setPhase('voting_neg')}
        aria-label="Marcar señal como no útil"
        disabled={submitting}
      >
        <ThumbsDown size={13} />
      </Button>
    </div>
  );
}
