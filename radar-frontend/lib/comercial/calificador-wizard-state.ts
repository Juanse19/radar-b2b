'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type CalWizardMode = 'auto' | 'manual' | '';

export interface CalWizardState {
  step:        1 | 2 | 3;
  linea:       string;
  subLineaId:  number | null;
  mode:        CalWizardMode;
  count:       number;
  selectedIds: number[];
  provider:    string;
  ragEnabled:  boolean;
  model:       string;
}

/** URL-driven wizard state for the Calificador v2 wizard. */
export function useCalWizardState() {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const state: CalWizardState = useMemo(() => {
    const rawStep = Number(sp.get('step') ?? '1');
    const step    = (rawStep >= 1 && rawStep <= 3 ? rawStep : 1) as 1 | 2 | 3;
    const rawMode = sp.get('mode');
    const mode: CalWizardMode = rawMode === 'auto' || rawMode === 'manual' ? rawMode : '';
    const rawSub  = sp.get('subLineaId');
    return {
      step,
      linea:       sp.get('linea')    ?? '',
      subLineaId:  rawSub ? Number(rawSub) : null,
      mode,
      count:       Number(sp.get('count') ?? '5'),
      selectedIds: (sp.get('empresas') ?? '').split(',').filter(Boolean).map(Number),
      provider:    sp.get('provider')  ?? 'claude',
      ragEnabled:  sp.get('rag')       !== 'false',
      model:       sp.get('model')     ?? '',
    };
  }, [sp]);

  const patch = useCallback((updates: Partial<CalWizardState>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      const key =
        k === 'selectedIds' ? 'empresas'   :
        k === 'ragEnabled'  ? 'rag'        :
        k === 'subLineaId'  ? 'subLineaId' :
        k;
      if (v === null || v === undefined || v === '') {
        next.delete(key);
        continue;
      }
      if (k === 'selectedIds' && Array.isArray(v)) {
        const joined = (v as number[]).join(',');
        if (joined) next.set('empresas', joined);
        else        next.delete('empresas');
        continue;
      }
      if (k === 'ragEnabled') {
        next.set('rag', String(v));
        continue;
      }
      next.set(key, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, sp, pathname]);

  const goto = useCallback((step: 1 | 2 | 3) => patch({ step }), [patch]);
  const next = useCallback(() => {
    if (state.step < 3) patch({ step: (state.step + 1) as 1 | 2 | 3 });
  }, [patch, state.step]);
  const prev = useCallback(() => {
    if (state.step > 1) patch({ step: (state.step - 1) as 1 | 2 | 3 });
  }, [patch, state.step]);

  const canNext = useMemo(() => {
    if (state.step === 1) return !!state.linea && !!state.mode;
    if (state.step === 2) {
      if (state.mode === 'auto')   return state.count >= 1 && state.count <= 50;
      return state.selectedIds.length >= 1;
    }
    return true;
  }, [state]);

  return { state, patch, goto, next, prev, canNext };
}
