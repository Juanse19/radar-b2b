/**
 * Unit tests for lib/comercial/calificador/scoring.ts (V3 / Fase A1 — 8 dimensiones)
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
  acceso_al_decisor:   10,
  anio_objetivo:       10,
  prioridad_comercial: 10,
  cuenta_estrategica:  10,
};

const ALL_ZERO: DimScores = {
  impacto_presupuesto: 0,
  multiplanta:         0,
  recurrencia:         0,
  referente_mercado:   0,
  acceso_al_decisor:   0,
  anio_objetivo:       0,
  prioridad_comercial: 0,
  cuenta_estrategica:  0,
};

const ALL_FIVE: DimScores = {
  impacto_presupuesto: 5,
  multiplanta:         5,
  recurrencia:         5,
  referente_mercado:   5,
  acceso_al_decisor:   5,
  anio_objetivo:       5,
  prioridad_comercial: 5,
  cuenta_estrategica:  5,
};

// ─── PESOS ────────────────────────────────────────────────────────────────────

describe('PESOS', () => {
  it('sum to 1.0', () => {
    const sum = Object.values(PESOS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('includes exactly the 8 V3 dimensions', () => {
    const dims = Object.keys(PESOS).sort();
    expect(dims).toEqual(
      [
        'acceso_al_decisor', 'anio_objetivo', 'cuenta_estrategica',
        'impacto_presupuesto', 'multiplanta', 'prioridad_comercial',
        'recurrencia', 'referente_mercado',
      ].sort(),
    );
  });

  it('does NOT include retired dimensions (ticket_estimado, tier)', () => {
    expect(Object.keys(PESOS)).not.toContain('ticket_estimado');
    expect(Object.keys(PESOS)).not.toContain('tier');
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
});

// ─── asignarTier (with sub-divisions) ─────────────────────────────────────────

describe('asignarTier', () => {
  it('returns A for score >= 8', () => {
    expect(asignarTier(8)).toBe('A');
    expect(asignarTier(10)).toBe('A');
    expect(asignarTier(8.5)).toBe('A');
  });

  it('returns B-Alta for score in [6.5, 8)', () => {
    expect(asignarTier(6.5)).toBe('B-Alta');
    expect(asignarTier(7)).toBe('B-Alta');
    expect(asignarTier(7.99)).toBe('B-Alta');
  });

  it('returns B-Baja for score in [5, 6.5)', () => {
    expect(asignarTier(5)).toBe('B-Baja');
    expect(asignarTier(6)).toBe('B-Baja');
    expect(asignarTier(6.49)).toBe('B-Baja');
  });

  it('returns C for score in [3, 5)', () => {
    expect(asignarTier(3)).toBe('C');
    expect(asignarTier(4.9)).toBe('C');
  });

  it('returns D for score < 3', () => {
    expect(asignarTier(2.9)).toBe('D');
    expect(asignarTier(0)).toBe('D');
  });

  it('boundaries: 8→A, 6.5→B-Alta, 5→B-Baja, 3→C', () => {
    expect(asignarTier(8)).toBe('A');
    expect(asignarTier(6.5)).toBe('B-Alta');
    expect(asignarTier(5)).toBe('B-Baja');
    expect(asignarTier(3)).toBe('C');
  });
});

// ─── TIER_LABEL ───────────────────────────────────────────────────────────────

describe('TIER_LABEL', () => {
  it('maps A to ORO', () => expect(TIER_LABEL.A).toBe('ORO'));
  it('maps B-Alta to MONITOREO Alto', () => expect(TIER_LABEL['B-Alta']).toBe('MONITOREO Alto'));
  it('maps B-Baja to MONITOREO Bajo', () => expect(TIER_LABEL['B-Baja']).toBe('MONITOREO Bajo'));
  it('maps C to ARCHIVO', () => expect(TIER_LABEL.C).toBe('ARCHIVO'));
  it('maps D to Descartar', () => expect(TIER_LABEL.D).toBe('Descartar'));
});

// ─── shouldSuggestRadar ───────────────────────────────────────────────────────

describe('shouldSuggestRadar', () => {
  it('returns true for tier A', () => expect(shouldSuggestRadar('A')).toBe(true));
  it('returns true for tier B-Alta', () => expect(shouldSuggestRadar('B-Alta')).toBe(true));
  it('returns true for tier B-Baja', () => expect(shouldSuggestRadar('B-Baja')).toBe(true));
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

  it('maps acceso_al_decisor values (NEW V3 dimension)', () => {
    expect(categoricoToScore('acceso_al_decisor', 'Contacto con 3 o más áreas')).toBe(10);
    expect(categoricoToScore('acceso_al_decisor', 'Contacto Gerente o Directivo')).toBe(7);
    expect(categoricoToScore('acceso_al_decisor', 'Contacto Líder o Jefe')).toBe(4);
    expect(categoricoToScore('acceso_al_decisor', 'Sin Contacto')).toBe(1);
  });

  it('maps cuenta_estrategica binary values', () => {
    expect(categoricoToScore('cuenta_estrategica', 'Sí')).toBe(10);
    expect(categoricoToScore('cuenta_estrategica', 'No')).toBe(0);
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
    expect(scoreToCategorico('acceso_al_decisor', 10)).toBe('Contacto con 3 o más áreas');
    expect(scoreToCategorico('acceso_al_decisor', 1)).toBe('Sin Contacto');
  });
});

// ─── allowedCategoricos ───────────────────────────────────────────────────────

describe('allowedCategoricos', () => {
  it('returns 5 values for impacto_presupuesto', () => {
    expect(allowedCategoricos('impacto_presupuesto')).toHaveLength(5);
  });
  it('returns 4 values for acceso_al_decisor', () => {
    expect(allowedCategoricos('acceso_al_decisor')).toHaveLength(4);
  });
  it('returns 2 values for cuenta_estrategica', () => {
    expect(allowedCategoricos('cuenta_estrategica')).toEqual(['Sí', 'No']);
  });
});
