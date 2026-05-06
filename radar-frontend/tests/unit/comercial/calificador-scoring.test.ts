/**
 * Unit tests for lib/comercial/calificador/scoring.ts (V2 — 9 dimensions)
 * Pure functions — no mocks needed.
 */
import { describe, it, expect } from 'vitest';
import {
  PESOS,
  calcularScore,
  asignarTier,
  TIER_LABEL,
  shouldSuggestRadar,
  categoricoToScore,
  scoreToCategorico,
  allowedCategoricos,
} from '@/lib/comercial/calificador/scoring';
import type { DimScores } from '@/lib/comercial/calificador/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_TEN: DimScores = {
  impacto_presupuesto: 10,
  multiplanta:         10,
  recurrencia:         10,
  referente_mercado:   10,
  anio_objetivo:       10,
  ticket_estimado:     10,
  prioridad_comercial: 10,
  cuenta_estrategica:  10,
  tier:                10,
};

const ALL_ZERO: DimScores = {
  impacto_presupuesto: 0,
  multiplanta:         0,
  recurrencia:         0,
  referente_mercado:   0,
  anio_objetivo:       0,
  ticket_estimado:     0,
  prioridad_comercial: 0,
  cuenta_estrategica:  0,
  tier:                0,
};

const ALL_FIVE: DimScores = {
  impacto_presupuesto: 5,
  multiplanta:         5,
  recurrencia:         5,
  referente_mercado:   5,
  anio_objetivo:       5,
  ticket_estimado:     5,
  prioridad_comercial: 5,
  cuenta_estrategica:  5,
  tier:                5,
};

// ─── PESOS ────────────────────────────────────────────────────────────────────

describe('PESOS', () => {
  it('sum to 1.0', () => {
    const sum = Object.values(PESOS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('includes all 9 dimensions', () => {
    const dims = Object.keys(PESOS).sort();
    expect(dims).toEqual(
      [
        'anio_objetivo', 'cuenta_estrategica', 'impacto_presupuesto',
        'multiplanta', 'prioridad_comercial', 'recurrencia',
        'referente_mercado', 'ticket_estimado', 'tier',
      ].sort(),
    );
  });

  it('impacto_presupuesto has the highest weight', () => {
    const max = Math.max(...Object.values(PESOS));
    expect(PESOS.impacto_presupuesto).toBe(max);
  });
});

// ─── calcularScore ────────────────────────────────────────────────────────────

describe('calcularScore', () => {
  it('returns 10.0 when all dimensions are 10', () => {
    expect(calcularScore(ALL_TEN)).toBe(10.0);
  });

  it('returns 0.0 when all dimensions are 0', () => {
    expect(calcularScore(ALL_ZERO)).toBe(0.0);
  });

  it('returns 5.0 when all dimensions are 5', () => {
    expect(calcularScore(ALL_FIVE)).toBe(5.0);
  });

  it('rounds to 1 decimal place', () => {
    const scores: DimScores = { ...ALL_FIVE, impacto_presupuesto: 8, multiplanta: 7 };
    const result = calcularScore(scores);
    expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('weights impacto_presupuesto more heavily than any single other dimension', () => {
    const highImpacto: DimScores = { ...ALL_ZERO, impacto_presupuesto: 10 };
    const highReferente: DimScores = { ...ALL_ZERO, referente_mercado: 10 };
    expect(calcularScore(highImpacto)).toBeGreaterThan(calcularScore(highReferente));
  });
});

// ─── asignarTier ──────────────────────────────────────────────────────────────

describe('asignarTier', () => {
  it('returns A for score >= 8', () => {
    expect(asignarTier(8)).toBe('A');
    expect(asignarTier(10)).toBe('A');
  });

  it('returns B for score >= 5 and < 8', () => {
    expect(asignarTier(5)).toBe('B');
    expect(asignarTier(7.9)).toBe('B');
  });

  it('returns C for score >= 3 and < 5', () => {
    expect(asignarTier(3)).toBe('C');
    expect(asignarTier(4.9)).toBe('C');
  });

  it('returns D for score < 3', () => {
    expect(asignarTier(2.9)).toBe('D');
    expect(asignarTier(0)).toBe('D');
  });

  it('boundaries: 8→A, 5→B, 3→C', () => {
    expect(asignarTier(8)).toBe('A');
    expect(asignarTier(5)).toBe('B');
    expect(asignarTier(3)).toBe('C');
  });
});

// ─── TIER_LABEL ───────────────────────────────────────────────────────────────

describe('TIER_LABEL', () => {
  it('maps A to ORO', () => expect(TIER_LABEL.A).toBe('ORO'));
  it('maps B to MONITOREO', () => expect(TIER_LABEL.B).toBe('MONITOREO'));
  it('maps C to ARCHIVO', () => expect(TIER_LABEL.C).toBe('ARCHIVO'));
  it('maps D to Descartar', () => expect(TIER_LABEL.D).toBe('Descartar'));
});

// ─── shouldSuggestRadar ───────────────────────────────────────────────────────

describe('shouldSuggestRadar', () => {
  it('returns true for tier A', () => expect(shouldSuggestRadar('A')).toBe(true));
  it('returns true for tier B', () => expect(shouldSuggestRadar('B')).toBe(true));
  it('returns true for tier C', () => expect(shouldSuggestRadar('C')).toBe(true));
  it('returns false for tier D', () => expect(shouldSuggestRadar('D')).toBe(false));
});

// ─── categoricoToScore ────────────────────────────────────────────────────────

describe('categoricoToScore', () => {
  it('maps impacto_presupuesto categorical values', () => {
    expect(categoricoToScore('impacto_presupuesto', 'Muy Alto')).toBe(10);
    expect(categoricoToScore('impacto_presupuesto', 'Alto')).toBe(8);
    expect(categoricoToScore('impacto_presupuesto', 'Medio')).toBe(6);
    expect(categoricoToScore('impacto_presupuesto', 'Bajo')).toBe(4);
    expect(categoricoToScore('impacto_presupuesto', 'Muy Bajo')).toBe(2);
  });

  it('maps multiplanta values', () => {
    expect(categoricoToScore('multiplanta', 'Presencia internacional')).toBe(10);
    expect(categoricoToScore('multiplanta', 'Varias sedes regionales')).toBe(6);
    expect(categoricoToScore('multiplanta', 'Única sede')).toBe(2);
  });

  it('maps cuenta_estrategica binary values', () => {
    expect(categoricoToScore('cuenta_estrategica', 'Sí')).toBe(10);
    expect(categoricoToScore('cuenta_estrategica', 'No')).toBe(0);
  });

  it('maps tier (A/B/C) values', () => {
    expect(categoricoToScore('tier', 'A')).toBe(10);
    expect(categoricoToScore('tier', 'B')).toBe(6);
    expect(categoricoToScore('tier', 'C')).toBe(2);
  });

  it('maps anio_objetivo years', () => {
    expect(categoricoToScore('anio_objetivo', '2026')).toBe(10);
    expect(categoricoToScore('anio_objetivo', '2027')).toBe(6);
    expect(categoricoToScore('anio_objetivo', '2028')).toBe(2);
    expect(categoricoToScore('anio_objetivo', 'Sin año')).toBe(0);
  });

  it('throws on invalid categorical value', () => {
    expect(() => categoricoToScore('impacto_presupuesto', 'Increíble')).toThrow(/Invalid categorical/);
  });
});

// ─── scoreToCategorico ────────────────────────────────────────────────────────

describe('scoreToCategorico', () => {
  it('returns the closest categorical label for a numeric score', () => {
    expect(scoreToCategorico('impacto_presupuesto', 10)).toBe('Muy Alto');
    expect(scoreToCategorico('impacto_presupuesto', 8)).toBe('Alto');
    expect(scoreToCategorico('cuenta_estrategica', 10)).toBe('Sí');
    expect(scoreToCategorico('cuenta_estrategica', 0)).toBe('No');
  });

  it('rounds intermediate values to nearest known label', () => {
    expect(scoreToCategorico('impacto_presupuesto', 9)).toMatch(/Muy Alto|Alto/);
  });
});

// ─── allowedCategoricos ───────────────────────────────────────────────────────

describe('allowedCategoricos', () => {
  it('returns 5 values for impacto_presupuesto', () => {
    expect(allowedCategoricos('impacto_presupuesto')).toHaveLength(5);
  });
  it('returns 2 values for cuenta_estrategica', () => {
    expect(allowedCategoricos('cuenta_estrategica')).toEqual(['Sí', 'No']);
  });
  it('returns 3 values for tier', () => {
    expect(allowedCategoricos('tier')).toEqual(['A', 'B', 'C']);
  });
});
