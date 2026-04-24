/**
 * Unit tests for lib/comercial/calificador/scoring.ts
 * Pure functions — no mocks needed.
 */
import { describe, it, expect } from 'vitest';
import {
  PESOS,
  calcularScore,
  asignarTier,
  TIER_LABEL,
  shouldSuggestRadar,
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
};

const ALL_ZERO: DimScores = {
  impacto_presupuesto: 0,
  multiplanta:         0,
  recurrencia:         0,
  referente_mercado:   0,
  anio_objetivo:       0,
  ticket_estimado:     0,
  prioridad_comercial: 0,
};

// Weights sum to 1.0 — so average(all 5) == 5.0
const ALL_FIVE: DimScores = {
  impacto_presupuesto: 5,
  multiplanta:         5,
  recurrencia:         5,
  referente_mercado:   5,
  anio_objetivo:       5,
  ticket_estimado:     5,
  prioridad_comercial: 5,
};

// ─── PESOS ────────────────────────────────────────────────────────────────────

describe('PESOS', () => {
  it('sum to 1.0', () => {
    const sum = Object.values(PESOS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('impacto_presupuesto has the highest weight (0.25)', () => {
    expect(PESOS.impacto_presupuesto).toBe(0.25);
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
    // Score = 8 * 0.25 + 7 * (0.15+0.15+0.15) + 6 * (0.10+0.10+0.10)
    //       = 2.0 + 3.15 + 1.8 = 6.95
    const scores: DimScores = {
      impacto_presupuesto: 8,
      multiplanta:         7,
      recurrencia:         7,
      referente_mercado:   6,
      anio_objetivo:       7,
      ticket_estimado:     6,
      prioridad_comercial: 6,
    };
    const result = calcularScore(scores);
    // Verify it's rounded to 1 decimal
    expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('weights impacto_presupuesto more heavily than any single other dimension', () => {
    const highImpacto: DimScores = { ...ALL_ZERO, impacto_presupuesto: 10 };
    const highMultiplanta: DimScores = { ...ALL_ZERO, multiplanta: 10 };
    expect(calcularScore(highImpacto)).toBeGreaterThan(calcularScore(highMultiplanta));
  });
});

// ─── asignarTier ──────────────────────────────────────────────────────────────

describe('asignarTier', () => {
  it('returns A for score >= 8', () => {
    expect(asignarTier(8)).toBe('A');
    expect(asignarTier(10)).toBe('A');
    expect(asignarTier(8.5)).toBe('A');
  });

  it('returns B for score >= 5 and < 8', () => {
    expect(asignarTier(5)).toBe('B');
    expect(asignarTier(7.9)).toBe('B');
    expect(asignarTier(6.5)).toBe('B');
  });

  it('returns C for score >= 3 and < 5', () => {
    expect(asignarTier(3)).toBe('C');
    expect(asignarTier(4.9)).toBe('C');
    expect(asignarTier(3.5)).toBe('C');
  });

  it('returns D for score < 3', () => {
    expect(asignarTier(2.9)).toBe('D');
    expect(asignarTier(0)).toBe('D');
    expect(asignarTier(1)).toBe('D');
  });

  it('boundary: exactly 8 is A, not B', () => {
    expect(asignarTier(8)).toBe('A');
  });

  it('boundary: exactly 5 is B, not C', () => {
    expect(asignarTier(5)).toBe('B');
  });

  it('boundary: exactly 3 is C, not D', () => {
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
