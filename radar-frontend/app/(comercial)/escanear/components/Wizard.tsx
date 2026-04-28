'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWizardState } from '@/lib/comercial/wizard-state';
import type { WizardState } from '@/lib/comercial/wizard-state';
import { getPresetById } from '@/lib/comercial/presets';
import { Stepper } from './Stepper';
import { Step1Target } from './Step1Target';
import { Step2Configure } from './Step2Configure';
import { Step3Review } from './Step3Review';

export function Wizard() {
  const { state, patch, goto, next, prev, canNext } = useWizardState();
  const presetAppliedRef   = useRef(false);
  // true  → auto-advance is suppressed (already advanced, or user clicked Atrás)
  // false → will advance as soon as mode is explicitly clicked with a line set
  const autoAdvancedRef    = useRef(state.step > 1);
  // Becomes true ONLY when the user explicitly clicks a mode card (Auto/Manual).
  // Line or subline changes alone do NOT set this — they shouldn't trigger advance.
  const modeJustClickedRef = useRef(false);

  // Wrap patch so we can detect explicit mode clicks from Step1Target.
  // Any call that includes `mode` in its updates is a deliberate user action.
  const handleChange = useCallback((updates: Partial<WizardState>) => {
    if ('mode' in updates && updates.mode !== undefined && updates.mode !== '') {
      modeJustClickedRef.current = true;
      autoAdvancedRef.current    = false; // allow re-advance after going back
    }
    patch(updates);
  }, [patch]);

  // Auto-advance step 1 → 2 ONLY when:
  //   1. User explicitly clicked a mode card (modeJustClickedRef)
  //   2. A line is already selected
  // This prevents accidental advance when the user is exploring lines/sublines
  // while mode is already set from a previous URL visit.
  useEffect(() => {
    if (state.step !== 1)             return;
    if (autoAdvancedRef.current)      return;
    if (!modeJustClickedRef.current)  return;
    if (!state.line || !state.mode)   return;

    modeJustClickedRef.current = false;
    autoAdvancedRef.current    = true;
    const timer = setTimeout(() => patch({ step: 2 }), 400);
    return () => clearTimeout(timer);
  }, [state.step, state.line, state.mode, patch]);

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
        {state.step === 1 && <Step1Target    state={state} onChange={handleChange} />}
        {state.step === 2 && <Step2Configure state={state} onChange={handleChange} />}
        {state.step === 3 && <Step3Review    state={state} onChange={handleChange} />}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
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
