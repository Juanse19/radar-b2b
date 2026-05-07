'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalWizardState } from '@/lib/comercial/calificador-wizard-state';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';
import { Stepper } from '../../escanear/components/Stepper';
import { CalStep1Target } from './CalStep1Target';
import { CalStep2Configure } from './CalStep2Configure';
import { CalStep3Review } from './CalStep3Review';

export function CalificadorWizard() {
  const { state, patch, goto, next, prev, canNext } = useCalWizardState();

  // Auto-advance Step 1 → Step 2 cuando el usuario hace click explícito en una
  // mode card (Auto/Manual) y ya hay línea seleccionada. Mismo patrón que el
  // wizard de Escanear — ahorra el clic de "Siguiente" y mantiene flujo fluido.
  const autoAdvancedRef    = useRef(state.step > 1);
  const modeJustClickedRef = useRef(false);

  // Wrapper de patch: detecta cuando el cambio incluye `mode` (señal de click
  // explícito en la card de Auto/Manual). Cambios de línea o sub-línea solos
  // NO disparan auto-advance.
  const handleChange = useCallback((updates: Partial<CalWizardState>) => {
    if ('mode' in updates && updates.mode !== undefined && updates.mode !== '') {
      modeJustClickedRef.current = true;
      autoAdvancedRef.current    = false;
    }
    patch(updates);
  }, [patch]);

  useEffect(() => {
    if (state.step !== 1)             return;
    if (autoAdvancedRef.current)      return;
    if (!modeJustClickedRef.current)  return;
    if (!state.linea || !state.mode)  return;

    modeJustClickedRef.current = false;
    autoAdvancedRef.current    = true;
    const timer = setTimeout(() => patch({ step: 2 }), 400);
    return () => clearTimeout(timer);
  }, [state.step, state.linea, state.mode, patch]);

  return (
    <div className="space-y-6">
      <Stepper current={state.step} onGoto={goto} />

      <Card className="p-6">
        {state.step === 1 && <CalStep1Target    state={state} onChange={handleChange} />}
        {state.step === 2 && <CalStep2Configure state={state} onChange={handleChange} />}
        {state.step === 3 && <CalStep3Review    state={state} onChange={handleChange} />}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Al volver atrás cancelamos el auto-advance pendiente para que
            // el usuario pueda revisar la selección sin volver a saltar.
            autoAdvancedRef.current    = true;
            modeJustClickedRef.current = false;
            prev();
          }}
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
