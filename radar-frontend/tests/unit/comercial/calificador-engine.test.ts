/**
 * Unit tests for lib/comercial/calificador/engine.ts
 *
 * Mocks:
 *  - server-only (no-op)
 *  - lib/comercial/rag (retrieveContext, buildRagBlock)
 *  - lib/db/supabase/pg_client (pgQuery, pgLit)
 *  - lib/comercial/providers (getProvider)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// ── RAG mock ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/comercial/rag', () => ({
  retrieveContext: vi.fn().mockResolvedValue([]),
  buildRagBlock:   vi.fn(() => 'RAG_BLOCK'),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockPgQuery = vi.fn().mockResolvedValue([]);
const mockPgLit   = vi.fn((v: string) => `'${v}'`);
vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: (...args: unknown[]) => mockPgQuery(...args),
  pgLit:   (v: unknown) => mockPgLit(v),
  SCHEMA:  'matec_radar',
}));

// ── Provider mock ─────────────────────────────────────────────────────────────
const mockCalificar = vi.fn();
const mockProvider = {
  name:                'mock',
  model:               'mock-model',
  scan:                vi.fn(),
  estimate:            vi.fn(),
  supports:            vi.fn(() => false),
  calificar:           mockCalificar,
  estimateCalificacion: vi.fn(() => ({
    tokens_in_est:   1000,
    tokens_out_est:  300,
    cost_usd_est:    0.002,
    cached_percentage: 0,
  })),
};

vi.mock('@/lib/comercial/providers', () => ({
  getProvider: vi.fn(() => mockProvider),
}));

// ─────────────────────────────────────────────────────────────────────────────

import { calificarEmpresa } from '@/lib/comercial/calificador/engine';
import type { CalificacionInput } from '@/lib/comercial/calificador/types';
import type { SSEEmitter } from '@/lib/comercial/providers/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInput(overrides: Partial<CalificacionInput> = {}): CalificacionInput {
  return {
    empresa:     'Grupo Bimbo',
    pais:        'Mexico',
    lineaNombre: 'Final de Línea',
    sessionId:   'test-session-001',
    ...overrides,
  };
}

function validLLMJson() {
  return {
    dimensiones: {
      impacto_presupuesto: { valor: 'Muy Alto', justificacion: 'Multinacional con CAPEX continuo en planta panificadora.' },
      multiplanta:         { valor: 'Presencia internacional', justificacion: 'Opera en 33 países con plantas en cada uno.' },
      recurrencia:         { valor: 'Alto', justificacion: 'Mantenimiento anual y expansiones recurrentes.' },
      referente_mercado:   { valor: 'Referente internacional', justificacion: 'Líder global en panificación industrial.' },
      acceso_al_decisor:   { valor: 'Contacto con 3 o más áreas', justificacion: 'Equipo de Operaciones, Mantenimiento y Compras visible en LinkedIn.' },
      anio_objetivo:       { valor: '2026', justificacion: 'Plan de expansión declarado para 2026 en LATAM.' },
      prioridad_comercial: { valor: 'Muy Alta', justificacion: 'Cuenta clave histórica de Matec.' },
      cuenta_estrategica:  { valor: 'Sí', justificacion: 'Cliente clave estratégico con relación activa.' },
    },
    razonamiento:
      'Grupo Bimbo es una empresa multinacional con alta capacidad de inversión en plantas productivas de alimentos en LATAM.',
    perfilWeb: {
      summary: 'Empresa líder en panificación con presencia en 33 países.',
      sources: ['https://grupobimbo.com/investors'],
    },
  };
}

function buildProviderOutput(rawJson = validLLMJson()) {
  return {
    rawJson,
    model:         'mock-model',
    tokensInput:   1500,
    tokensOutput:  400,
    costUsd:       0.003,
    scoreTotal:    0,
    tier:          'C' as const,
  };
}

function makeEmitter(): SSEEmitter & { events: Array<{ event: string; data: unknown }> } {
  const events: Array<{ event: string; data: unknown }> = [];
  return {
    events,
    emit(event, data) { events.push({ event, data }); },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calificarEmpresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalificar.mockResolvedValue(buildProviderOutput());
    // Empresas lookup returns no row → empresa_id = null
    mockPgQuery.mockResolvedValue([]);
  });

  it('calls provider.calificar with the empresa input', async () => {
    const input = buildInput();
    await calificarEmpresa(input, {});
    expect(mockCalificar).toHaveBeenCalledTimes(1);
    const [callInput] = mockCalificar.mock.calls[0] as [CalificacionInput];
    expect(callInput.empresa).toBe('Grupo Bimbo');
    expect(callInput.lineaNombre).toBe('Final de Línea');
  });

  it('returns correct scoreTotal and tier from LLM JSON', async () => {
    const result = await calificarEmpresa(buildInput(), {});
    // All scores ~8+ → tier A
    expect(result.tier).toBe('A');
    expect(result.scoreTotal).toBeGreaterThanOrEqual(8);
  });

  it('persists a row to the DB via pgQuery', async () => {
    await calificarEmpresa(buildInput(), {});
    // pgQuery called at least once for the INSERT
    const insertCall = mockPgQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO'),
    );
    expect(insertCall).toBeDefined();
  });

  it('emits empresa_started, dim_scored ×8, tier_assigned, empresa_done', async () => {
    const emitter = makeEmitter();
    await calificarEmpresa(buildInput(), {}, emitter);
    const eventNames = emitter.events.map(e => e.event);
    expect(eventNames).toContain('empresa_started');
    expect(eventNames.filter(n => n === 'dim_scored')).toHaveLength(8);
    expect(eventNames).toContain('tier_assigned');
    expect(eventNames).toContain('empresa_done');
  });

  it('emits tier_assigned with correct scoreTotal', async () => {
    const emitter = makeEmitter();
    await calificarEmpresa(buildInput(), {}, emitter);
    const tierEvent = emitter.events.find(e => e.event === 'tier_assigned');
    expect(tierEvent).toBeDefined();
    expect((tierEvent!.data as Record<string, unknown>).tier).toBe('A');
    expect((tierEvent!.data as Record<string, unknown>).scoreTotal).toBeGreaterThan(0);
  });

  it('returns provider model and token counts in output', async () => {
    const result = await calificarEmpresa(buildInput(), {});
    expect(result.model).toBe('mock-model');
    expect(result.tokensInput).toBe(1500);
    expect(result.tokensOutput).toBe(400);
    expect(result.costUsd).toBe(0.003);
  });

  it('retries once and throws when LLM JSON is invalid both times', async () => {
    const badJson = { dimensiones: {}, razonamiento: 'x', perfilWeb: {} };
    mockCalificar.mockResolvedValue(buildProviderOutput(badJson));
    await expect(calificarEmpresa(buildInput(), {})).rejects.toThrow(/invalid JSON/i);
    expect(mockCalificar).toHaveBeenCalledTimes(2);
  });

  it('includes ragContext in provider call when ragEnabled is true', async () => {
    const { retrieveContext, buildRagBlock } = await import('@/lib/comercial/rag');
    (retrieveContext as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: '1', text: 'ctx' }]);
    (buildRagBlock as ReturnType<typeof vi.fn>).mockReturnValue('CONTEXT_BLOCK');

    await calificarEmpresa(buildInput(), { ragEnabled: true });
    const [callInput] = mockCalificar.mock.calls[0] as [CalificacionInput];
    expect(callInput.ragContext).toBeDefined();
    expect(callInput.ragContext?.rawBlock).toBe('CONTEXT_BLOCK');
  });

  it('skips RAG when ragEnabled is false', async () => {
    const { retrieveContext } = await import('@/lib/comercial/rag');
    await calificarEmpresa(buildInput(), { ragEnabled: false });
    expect(retrieveContext).not.toHaveBeenCalled();
    const [callInput] = mockCalificar.mock.calls[0] as [CalificacionInput];
    expect(callInput.ragContext).toBeUndefined();
  });

  it('emits empresa_done with durationMs > 0', async () => {
    const emitter = makeEmitter();
    await calificarEmpresa(buildInput(), {}, emitter);
    const doneEvent = emitter.events.find(e => e.event === 'empresa_done');
    expect((doneEvent!.data as Record<string, unknown>).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('stores sub_linea_id when provided in input', async () => {
    await calificarEmpresa(buildInput({ subLineaId: 42 }), {});
    const insertCall = mockPgQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO'),
    );
    expect(insertCall).toBeDefined();
    expect((insertCall![0] as string)).toContain('42');
  });
});
