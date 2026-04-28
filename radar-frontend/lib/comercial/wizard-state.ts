'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type WizardMode = 'auto' | 'manual' | '';

export interface WizardState {
  step:     1 | 2 | 3;
  mode:     WizardMode;
  line:     string;          // '' if not selected
  presetId: string | null;
  // Step 2 data
  count:    number;          // auto mode (1-20)
  selectedIds: number[];     // manual mode
  customKeywords?: string;   // optional override for AI search keywords
  sublineas: string[];       // multi-select sub-líneas (empty = all when single line)
  /** Backwards-compat alias — first item of sublineas[] when single, undefined otherwise. */
  sublinea?: string;
  /** v5: enables RAG context retrieval from past signals/calificaciones (default true). */
  ragEnabled: boolean;
  // Step 3 data
  provider: string;          // 'claude' | 'openai' | 'gemini'
  budgetUsd: number;         // user override, default from estimate
}

/**
 * URL-driven wizard state. Reads every field from the query string so that
 * deep-links, back/forward and refresh all preserve the wizard position.
 */
export function useWizardState() {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const state: WizardState = useMemo(() => {
    const rawStep = Number(sp.get('step') ?? '1');
    const step    = (rawStep >= 1 && rawStep <= 3 ? rawStep : 1) as 1 | 2 | 3;
    const rawMode = sp.get('mode');
    const mode: WizardMode = rawMode === 'auto' || rawMode === 'manual' ? rawMode : '';
    return {
      step,
      mode,
      line:           sp.get('line') ?? '',
      presetId:       sp.get('preset'),
      count:          Number(sp.get('count') ?? '5'),
      selectedIds:    (sp.get('empresas') ?? '').split(',').filter(Boolean).map(Number),
      customKeywords: sp.get('keywords')  ?? undefined,
      sublineas:      (sp.get('sublineas') ?? sp.get('sublinea') ?? '').split(',').map(s => s.trim()).filter(Boolean),
      sublinea:       sp.get('sublinea') ?? (sp.get('sublineas')?.split(',')[0]?.trim() || undefined),
      provider:       sp.get('provider') ?? 'claude',
      budgetUsd:      Number(sp.get('budget') ?? '0'),
      ragEnabled:     sp.get('rag') !== 'false',
    };
  }, [sp]);

  const patch = useCallback((updates: Partial<WizardState>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      const key = k === 'presetId' ? 'preset' : k === 'selectedIds' ? 'empresas' : k === 'customKeywords' ? 'keywords' : k;
      if (v === null || v === undefined || v === '') {
        next.delete(key);
        continue;
      }
      if (k === 'selectedIds' && Array.isArray(v)) {
        const joined = (v as number[]).join(',');
        if (joined) next.set('empresas', joined);
        else next.delete('empresas');
        continue;
      }
      if (k === 'sublineas' && Array.isArray(v)) {
        const joined = (v as string[]).map(s => s.trim()).filter(Boolean).join(',');
        if (joined) next.set('sublineas', joined);
        else next.delete('sublineas');
        next.delete('sublinea'); // legacy alias — drop
        continue;
      }
      if (k === 'sublinea' && typeof v === 'string') {
        // Legacy alias: write to sublineas[] for forward compat
        if (v) next.set('sublineas', v);
        else next.delete('sublineas');
        next.delete('sublinea');
        continue;
      }
      if (k === 'ragEnabled') {
        // Default is true; only persist when false to keep URL clean
        if (v === false) next.set('rag', 'false');
        else next.delete('rag');
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
    if (state.step === 1) return !!state.line && !!state.mode;
    if (state.step === 2) {
      if (state.mode === 'auto')  return state.count >= 1 && state.count <= 20;
      return state.selectedIds.length >= 1;
    }
    return true;
  }, [state]);

  return { state, patch, goto, next, prev, canNext };
}
