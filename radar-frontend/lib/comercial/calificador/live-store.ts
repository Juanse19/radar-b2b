'use client';

/**
 * live-store.ts — Zustand store para sesiones de calificación en vivo.
 *
 * La conexión SSE vive AQUÍ, no en el componente, así que la sesión
 * sobrevive a navegación entre rutas y tab switches. Cualquier componente
 * (panel principal, indicador flotante, mini-toasts) se subscribe al
 * mismo estado.
 *
 * Solo se pierde si el usuario cierra la pestaña del navegador (SSE
 * muere con el documento) — ese es el comportamiento esperado.
 */
import { create } from 'zustand';
import type { Dimension, DimScores, Tier } from './types';

export type ProviderName = 'claude' | 'openai' | 'gemini';
export type CompanyStatus = 'pending' | 'running' | 'done' | 'error';

export interface DimDetailUI {
  valor: string;
  justificacion?: string;
}

export interface CompanyLive {
  name:        string;
  country:     string;
  status:      CompanyStatus;
  scores:      Partial<DimScores>;
  dimensiones: Partial<Record<Dimension, DimDetailUI>>;
  scoreTotal?: number;
  tier?:       Tier;
  razonamientoPreview?: string;
  thinking:    string[];
  costUsd?:    number;
  error?:      string;
}

export interface EmpresaInput {
  id?:     number;
  name:    string;
  country: string;
  domain?: string;
}

export interface StartScanOptions {
  linea:      string;
  subLineaId?: number;
  provider:   ProviderName;
  ragEnabled: boolean;
  model?:     string;
}

interface CalLiveState {
  // ── Estado de sesión ──
  sessionId:   string | null;
  status:      'idle' | 'running' | 'done' | 'error';
  linea:       string | null;
  provider:    ProviderName | null;
  companies:   CompanyLive[];
  totalCost:   number;
  startedAt:   number | null;
  errorMessage: string | null;

  // ── Conexión SSE (interna) ──
  eventSource: EventSource | null;

  // ── Acciones ──
  startSession: (sessionId: string, empresas: EmpresaInput[], options: StartScanOptions) => void;
  cancelSession: () => void;
  reset:         () => void;
}

const INITIAL: Omit<CalLiveState, 'startSession' | 'cancelSession' | 'reset'> = {
  sessionId:    null,
  status:       'idle',
  linea:        null,
  provider:     null,
  companies:    [],
  totalCost:    0,
  startedAt:    null,
  errorMessage: null,
  eventSource:  null,
};

export const useCalLiveStore = create<CalLiveState>((set, get) => ({
  ...INITIAL,

  startSession(sessionId, empresas, options) {
    // Cierra cualquier sesión previa antes de abrir una nueva
    get().eventSource?.close();

    const initialCompanies: CompanyLive[] = empresas.map((e) => ({
      name:        e.name,
      country:     e.country,
      status:      'pending' as const,
      scores:      {},
      dimensiones: {},
      thinking:    [],
    }));

    set({
      sessionId,
      status:    'running',
      linea:     options.linea,
      provider:  options.provider,
      companies: initialCompanies,
      totalCost: 0,
      startedAt: Date.now(),
      errorMessage: null,
    });

    // Build SSE URL
    const params = new URLSearchParams({
      sessionId,
      linea:      options.linea,
      provider:   options.provider,
      ragEnabled: String(options.ragEnabled),
      empresas:   JSON.stringify(empresas.map((e) => ({
        name:    e.name,
        country: e.country,
        domain:  e.domain,
        id:      e.id,
      }))),
    });
    if (options.subLineaId) params.set('subLineaId', String(options.subLineaId));
    if (options.model)      params.set('model', options.model);

    const es = new EventSource(`/api/comercial/calificar?${params.toString()}`);

    function patchCompany(name: string, patch: (c: CompanyLive) => Partial<CompanyLive>) {
      set((state) => ({
        companies: state.companies.map((c) =>
          c.name === name ? { ...c, ...patch(c) } : c,
        ),
      }));
    }

    es.addEventListener('empresa_started', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { empresa: string };
      patchCompany(d.empresa, () => ({ status: 'running' }));
    });

    es.addEventListener('thinking', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { empresa: string; chunk: string };
      patchCompany(d.empresa, (c) => ({
        thinking: [...c.thinking.slice(-4), d.chunk],
      }));
    });

    es.addEventListener('dim_scored', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as {
        empresa: string;
        dim:     Dimension;
        value:   number;
        valor?:  string;
        justificacion?: string;
      };
      patchCompany(d.empresa, (c) => ({
        scores:      { ...c.scores, [d.dim]: d.value },
        dimensiones: d.valor
          ? { ...c.dimensiones, [d.dim]: { valor: d.valor, justificacion: d.justificacion } }
          : c.dimensiones,
      }));
    });

    es.addEventListener('tier_assigned', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as {
        empresa: string;
        tier: Tier;
        scoreTotal: number;
        razonamientoPreview: string;
      };
      patchCompany(d.empresa, () => ({
        tier:       d.tier,
        scoreTotal: d.scoreTotal,
        razonamientoPreview: d.razonamientoPreview,
      }));
    });

    es.addEventListener('empresa_done', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { empresa: string; costUsd: number };
      patchCompany(d.empresa, () => ({ status: 'done', costUsd: d.costUsd }));
      set((state) => ({ totalCost: state.totalCost + (d.costUsd ?? 0) }));
    });

    es.addEventListener('company_error', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { empresa: string; error: string };
      patchCompany(d.empresa, () => ({ status: 'error', error: d.error }));
    });

    es.addEventListener('session_done', () => {
      set({ status: 'done' });
      es.close();
      set({ eventSource: null });
    });

    es.addEventListener('error', (e) => {
      // SSE 'error' cuando se cierra naturalmente — solo registra si la sesión no terminó OK
      if (get().status === 'running') {
        const data = (e as MessageEvent).data;
        const msg = data ? (() => { try { return JSON.parse(data).message; } catch { return null; } })() : null;
        set({ status: 'error', errorMessage: msg ?? 'Conexión interrumpida' });
        es.close();
        set({ eventSource: null });
      }
    });

    set({ eventSource: es });
  },

  cancelSession() {
    get().eventSource?.close();
    set({ ...INITIAL });
  },

  reset() {
    get().eventSource?.close();
    set({ ...INITIAL });
  },
}));
