'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWizardState } from '@/lib/comercial/wizard-state';
import { getPresetById } from '@/lib/comercial/presets';
import { Stepper } from './Stepper';
import { Step1Target } from './Step1Target';
import { Step2Configure } from './Step2Configure';
import { Step3Review } from './Step3Review';

export function Wizard() {
  const { state, patch, goto, next, prev, canNext } = useWizardState();
  const presetAppliedRef = useRef(false);
  const autoAdvancedRef  = useRef(false);

  // Auto-advance from Step 1 → Step 2 when both line and mode are selected.
  // Uses a ref to fire only ONCE per session; if user goes back to Step 1,
  // they can re-trigger by changing line/mode (ref resets below).
  useEffect(() => {
    if (state.step !== 1) {
      autoAdvancedRef.current = false;  // reset when user navigates away
      return;
    }
    if (autoAdvancedRef.current)  return;
    if (!state.line || !state.mode || !state.scanMode) return;

    autoAdvancedRef.current = true;
    const timer = setTimeout(() => patch({ step: 2 }), 400);
    return () => clearTimeout(timer);
  }, [state.step, state.line, state.mode, state.scanMode, patch]);

  // Apply preset on mount if present. Guard with ref so we never re-apply
  // after the user has navigated — the URL is the source of truth.
  useEffect(() => {
    if (presetAppliedRef.current) return;
    if (!state.presetId) {
      presetAppliedRef.current = true;
      return;
    }
    const preset = getPresetById(state.presetId);
    if (!preset) {
      presetAppliedRef.current = true;
      return;
    }
    const updates: Parameters<typeof patch>[0] = {};
    if (!state.line)     updates.line  = preset.linea;
    if (!state.mode)     updates.mode  = 'auto';
    else if (state.mode !== 'auto' && state.step === 1) updates.mode = 'auto';
    if (!state.count || state.count === 5) updates.count = preset.companyCount;
    if (Object.keys(updates).length > 0) patch(updates);
    presetAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Stepper current={state.step} onGoto={goto} />

      <Card className="p-6">
        {state.step === 1 && <Step1Target    state={state} onChange={patch} />}
        {state.step === 2 && <Step2Configure state={state} onChange={patch} />}
        {state.step === 3 && <Step3Review    state={state} onChange={patch} />}
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
