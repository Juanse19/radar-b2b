'use client';

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WizardState } from '@/lib/comercial/wizard-state';
import { Stepper } from '../../escanear/components/Stepper';
import { Step1Target } from '../../escanear/components/Step1Target';
import { Step2Configure } from '../../escanear/components/Step2Configure';
import { Step3Review } from '../../escanear/components/Step3Review';

const INITIAL: WizardState = {
  step:           1,
  mode:           '',
  line:           '',
  presetId:       null,
  count:          5,
  selectedIds:    [],
  customKeywords: undefined,
  sublineas:      [],
  sublinea:       undefined,
  paises:         [],
  maxSenales:     10,
  provider:       'claude',
  budgetUsd:      0,
  ragEnabled:     true,
};

/**
 * Self-contained signals wizard using local React state.
 * Does NOT write to the URL so it can coexist with other URL-driven
 * wizards on the same page (e.g. CalificadorWizard).
 */
export function SignalsWizardLocal() {
  const [state, setState] = useState<WizardState>(INITIAL);

  const patch = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const canNext =
    state.step === 1 ? !!state.line :
    state.step === 2 ? state.paises.length > 0 :
    true;

  function next() {
    if (canNext && state.step < 3) {
      setState((prev) => ({ ...prev, step: (prev.step + 1) as 1 | 2 | 3 }));
    }
  }

  function prev() {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: (prev.step - 1) as 1 | 2 | 3 }));
    }
  }

  function goto(step: 1 | 2 | 3) {
    setState((prev) => ({ ...prev, step }));
  }

  return (
    <div className="space-y-6">
      <Stepper current={state.step} onGoto={goto} />

      <Card className="p-6">
        {state.step === 1 && <Step1Target    state={state} onChange={patch} agentMode="signals" />}
        {state.step === 2 && <Step2Configure state={state} onChange={patch} agentMode="signals" />}
        {state.step === 3 && <Step3Review    state={state} onChange={patch} agentMode="signals" />}
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
