'use client';

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProspectorStepper } from './wizard/ProspectorStepper';
import { Step1Target } from './wizard/Step1Target';
import { Step2ConfigureAuto } from './wizard/Step2ConfigureAuto';
import { Step2ConfigureManual } from './wizard/Step2ConfigureManual';
import { Step3Review } from './wizard/Step3Review';
import { ProspectorLiveView } from './live/ProspectorLiveView';
import { useProspectorStream } from './live/useProspectorStream';
import {
  INITIAL_STATE,
  canAdvanceStep,
  type ProspectorWizardState,
} from './wizard/state';

export function ProspectorWizard() {
  const [state, setState] = useState<ProspectorWizardState>(INITIAL_STATE);
  const { state: streamState, start, cancel, reset, updateContact } = useProspectorStream();

  const patch = useCallback((updates: Partial<ProspectorWizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const goto = useCallback((step: 1 | 2 | 3) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const next = useCallback(() => {
    setState(prev => {
      if (prev.step === 1 && canAdvanceStep(prev)) return { ...prev, step: 2 };
      if (prev.step === 2 && canAdvanceStep(prev)) return { ...prev, step: 3 };
      return prev;
    });
  }, []);

  const prev = useCallback(() => {
    setState(p => {
      if (p.step === 2)      return { ...p, step: 1 };
      if (p.step === 3)      return { ...p, step: 2 };
      return p;
    });
  }, []);

  const fire = useCallback(async () => {
    // Guard contra doble-click: si ya estamos en live o connecting, no disparar de nuevo
    if (state.step === 'live' || streamState.status === 'connecting' || streamState.status === 'streaming') {
      return;
    }
    const sessionId = crypto.randomUUID();
    setState(prev => ({ ...prev, sessionId, step: 'live' }));

    await start({
      sessionId,
      modo:        state.modo === 'manual' ? 'manual' : 'auto',
      sublineas:   state.sublineas,
      tiers:       state.modo === 'auto' ? state.tiers : undefined,
      // Pasamos TODAS las empresas seleccionadas — el backend hace fallback
      // a búsqueda por nombre cuando no hay dominio (apolloSearch.companyName).
      empresas:    state.empresas.map(e => ({
        empresa_id: e.id,
        empresa:    e.empresa,
        pais:       e.pais,
        dominio:    e.dominio,
        sublinea:   e.sublinea,
        tier:       e.tier,
      })),
      job_titles:        state.jobTitles,
      max_contactos:     state.maxContactos,
      reveal_phone_auto: state.revealPhoneAuto,
    });
  }, [state, start]);

  const handleBackToWizard = useCallback(() => {
    setState(prev => ({ ...prev, step: 3 }));
    reset();
  }, [reset]);

  const handleNewSearch = useCallback(() => {
    setState(INITIAL_STATE);
    reset();
  }, [reset]);

  const handleCancel = useCallback(() => {
    if (state.sessionId) void cancel(state.sessionId);
  }, [cancel, state.sessionId]);

  const handlePhoneUnlocked = useCallback((apolloId: string, telMovil: string) => {
    updateContact(apolloId, { tel_movil: telMovil, phone_unlocked: true });
  }, [updateContact]);

  const canNext = canAdvanceStep(state);

  // ── Live view ───────────────────────────────────────────────────────────────
  if (state.step === 'live' && state.sessionId) {
    return (
      <div className="space-y-6">
        <ProspectorStepper current="live" />
        <ProspectorLiveView
          sessionId={state.sessionId}
          state={streamState}
          onCancel={handleCancel}
          onReset={handleNewSearch}
          onBack={handleBackToWizard}
          onPhoneUnlocked={handlePhoneUnlocked}
        />
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <ProspectorStepper current={state.step} onGoto={goto} />

      <Card className="p-6">
        {state.step === 1 && <Step1Target state={state} onChange={patch} />}
        {state.step === 2 && state.modo === 'auto'   && <Step2ConfigureAuto   state={state} onChange={patch} />}
        {state.step === 2 && state.modo === 'manual' && <Step2ConfigureManual state={state} onChange={patch} />}
        {state.step === 3 && (
          <Step3Review
            state={state}
            onChange={patch}
            onFire={fire}
            firing={streamState.status === 'connecting'}
          />
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={prev}
          disabled={state.step === 1}
        >
          <ChevronLeft size={14} className="mr-1" />
          Atrás
        </Button>
        {state.step < 3 ? (
          <Button type="button" size="sm" onClick={next} disabled={!canNext}>
            Siguiente
            <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Revisa y haz clic en "Buscar contactos"
          </span>
        )}
      </div>
    </div>
  );
}
