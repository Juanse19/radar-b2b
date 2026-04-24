'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalWizardState } from '@/lib/comercial/calificador-wizard-state';
import { Stepper } from '../../escanear/components/Stepper';
import { CalStep1Target } from './CalStep1Target';
import { CalStep2Configure } from './CalStep2Configure';
import { CalStep3Review } from './CalStep3Review';

export function CalificadorWizard() {
  const { state, patch, goto, next, prev, canNext } = useCalWizardState();

  return (
    <div className="space-y-6">
      <Stepper current={state.step} onGoto={goto} />

      <Card className="p-6">
        {state.step === 1 && <CalStep1Target    state={state} onChange={patch} />}
        {state.step === 2 && <CalStep2Configure state={state} onChange={patch} />}
        {state.step === 3 && <CalStep3Review    state={state} onChange={patch} />}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          disabled={state.step === 1}
        >
          <ChevronLeft size={14} className="mr-1" /> Atrás
        </Button>
        {state.step < 3 ? (
          <Button size="sm" onClick={next} disabled={!canNext}>
            Siguiente <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Revisa y ejecuta arriba
          </span>
        )}
      </div>
    </div>
  );
}
