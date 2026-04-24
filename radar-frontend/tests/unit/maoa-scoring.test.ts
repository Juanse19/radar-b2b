/**
 * Unit tests for MAOA scoring logic — pure functions, no I/O.
 *
 * MAOA (Metodología de Alineación de Oportunidades Activas) uses two agents:
 *
 *   TIER (4 variables, 0-10 each):
 *     industria_tamano, capex_historica, complejidad_tecnica, pais_foco
 *     → tier_score = average of the 4 values
 *     → tier_clasificacion: ≥8 → "A", ≥5 → "B", else → "C"
 *
 *   TIR (4 variables, 0-10 each):
 *     probabilidad_timing, presupuesto_asignado, nivel_influencia, presion_competencia
 *     → tir_score = average of the 4 values
 *     → tir_clasificacion: ≥8 → "A", ≥5 → "B", else → "C"
 *
 *   score_final = (tier_score + tir_score) / 2
 *
 *   Convergencia:
 *     Both A                → "Verificada"
 *     Either B (not both A) → "Pendiente"
 *     Otherwise             → "Sin convergencia"
 *
 *   Accion recomendada:
 *     "Verificada" → "ABM ACTIVADO"
 *     "Pendiente"  → "MONITOREO ACTIVO"
 *     otherwise    → "ARCHIVAR"
 */

import { describe, it, expect } from 'vitest';

// ── Pure helper functions (inline — no production module dependency) ──────────

type Clasificacion = 'A' | 'B' | 'C';
type Convergencia  = 'Verificada' | 'Pendiente' | 'Sin convergencia';
type Accion        = 'ABM ACTIVADO' | 'MONITOREO ACTIVO' | 'ARCHIVAR';

/** Average of an array of numbers. */
function calcularPromedio(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/** Map a numeric score (0-10) to its MAOA letter classification. */
function clasificar(score: number): Clasificacion {
  if (score >= 8) return 'A';
  if (score >= 5) return 'B';
  return 'C';
}

/** Calculate TIER score and classification from the 4 TIER variables. */
function calcularTier(variables: [number, number, number, number]) {
  const score = calcularPromedio(variables);
  return { score, clasificacion: clasificar(score) };
}

/** Calculate TIR score and classification from the 4 TIR variables. */
function calcularTir(variables: [number, number, number, number]) {
  const score = calcularPromedio(variables);
  return { score, clasificacion: clasificar(score) };
}

/** Compute the combined MAOA final score. */
function calcularScoreFinal(tierScore: number, tirScore: number): number {
  return (tierScore + tirScore) / 2;
}

/** Determine convergence from two MAOA classification strings. */
function calcularConvergencia(
  tierClasificacion: Clasificacion,
  tirClasificacion: Clasificacion,
): Convergencia {
  if (tierClasificacion === 'A' && tirClasificacion === 'A') return 'Verificada';
  if (tierClasificacion === 'B' || tirClasificacion === 'B') return 'Pendiente';
  return 'Sin convergencia';
}

/** Map convergence to recommended action. */
function calcularAccion(convergencia: Convergencia): Accion {
  if (convergencia === 'Verificada') return 'ABM ACTIVADO';
  if (convergencia === 'Pendiente')  return 'MONITOREO ACTIVO';
  return 'ARCHIVAR';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calcularPromedio()', () => {
  it('computes average of four values', () => {
    expect(calcularPromedio([8.5, 9, 8, 8.5])).toBeCloseTo(8.5, 5);
  });

  it('returns 0 for an empty array', () => {
    expect(calcularPromedio([])).toBe(0);
  });

  it('single-element array returns that element', () => {
    expect(calcularPromedio([7])).toBe(7);
  });
});

describe('clasificar()', () => {
  it('score ≥ 8 → "A"', () => {
    expect(clasificar(8)).toBe('A');
    expect(clasificar(9)).toBe('A');
    expect(clasificar(10)).toBe('A');
    expect(clasificar(8.5)).toBe('A');
  });

  it('score ≥ 5 and < 8 → "B"', () => {
    expect(clasificar(5)).toBe('B');
    expect(clasificar(6)).toBe('B');
    expect(clasificar(7)).toBe('B');
    expect(clasificar(7.99)).toBe('B');
  });

  it('score < 5 → "C"', () => {
    expect(clasificar(0)).toBe('C');
    expect(clasificar(4)).toBe('C');
    expect(clasificar(4.99)).toBe('C');
  });

  it('boundary 8.0 is exactly "A", 7.999 is "B"', () => {
    expect(clasificar(8.0)).toBe('A');
    expect(clasificar(7.999)).toBe('B');
  });

  it('boundary 5.0 is exactly "B", 4.999 is "C"', () => {
    expect(clasificar(5.0)).toBe('B');
    expect(clasificar(4.999)).toBe('C');
  });
});

describe('calcularTier()', () => {
  it('[8.5, 9, 8, 8.5] → avg=8.5 → clasificacion="A"', () => {
    const { score, clasificacion } = calcularTier([8.5, 9, 8, 8.5]);
    expect(score).toBeCloseTo(8.5, 5);
    expect(clasificacion).toBe('A');
  });

  it('[5, 6, 5, 5] → avg=5.25 → clasificacion="B"', () => {
    const { score, clasificacion } = calcularTier([5, 6, 5, 5]);
    expect(score).toBeCloseTo(5.25, 5);
    expect(clasificacion).toBe('B');
  });

  it('[2, 3, 1, 4] → avg=2.5 → clasificacion="C"', () => {
    const { score, clasificacion } = calcularTier([2, 3, 1, 4]);
    expect(score).toBeCloseTo(2.5, 5);
    expect(clasificacion).toBe('C');
  });

  it('all zeros → avg=0 → clasificacion="C"', () => {
    const { score, clasificacion } = calcularTier([0, 0, 0, 0]);
    expect(score).toBe(0);
    expect(clasificacion).toBe('C');
  });
});

describe('calcularTir()', () => {
  it('[7, 8, 7.5, 7] → avg=7.375 → clasificacion="B"', () => {
    const { score, clasificacion } = calcularTir([7, 8, 7.5, 7]);
    expect(score).toBeCloseTo(7.375, 5);
    expect(clasificacion).toBe('B');
  });

  it('[8, 9, 8, 8] → avg=8.25 → clasificacion="A"', () => {
    const { score, clasificacion } = calcularTir([8, 9, 8, 8]);
    expect(score).toBeCloseTo(8.25, 5);
    expect(clasificacion).toBe('A');
  });

  it('all zeros → avg=0 → clasificacion="C"', () => {
    const { score, clasificacion } = calcularTir([0, 0, 0, 0]);
    expect(score).toBe(0);
    expect(clasificacion).toBe('C');
  });
});

describe('calcularScoreFinal()', () => {
  it('(8.5 + 7.375) / 2 = 7.9375', () => {
    expect(calcularScoreFinal(8.5, 7.375)).toBeCloseTo(7.9375, 5);
  });

  it('(10 + 10) / 2 = 10', () => {
    expect(calcularScoreFinal(10, 10)).toBe(10);
  });

  it('(0 + 0) / 2 = 0 (all-zero edge case)', () => {
    expect(calcularScoreFinal(0, 0)).toBe(0);
  });

  it('symmetric: (a + b) / 2 === (b + a) / 2', () => {
    expect(calcularScoreFinal(6, 8)).toBeCloseTo(calcularScoreFinal(8, 6), 10);
  });
});

describe('calcularConvergencia()', () => {
  it('A + A → "Verificada"', () => {
    expect(calcularConvergencia('A', 'A')).toBe('Verificada');
  });

  it('A + B → "Pendiente"', () => {
    expect(calcularConvergencia('A', 'B')).toBe('Pendiente');
  });

  it('B + A → "Pendiente"', () => {
    expect(calcularConvergencia('B', 'A')).toBe('Pendiente');
  });

  it('B + B → "Pendiente"', () => {
    expect(calcularConvergencia('B', 'B')).toBe('Pendiente');
  });

  it('C + C → "Sin convergencia"', () => {
    expect(calcularConvergencia('C', 'C')).toBe('Sin convergencia');
  });

  it('A + C → "Sin convergencia" (only one B triggers Pendiente, not A+C)', () => {
    // A+C: tier=A, tir=C → neither both-A, nor any-B → "Sin convergencia"
    expect(calcularConvergencia('A', 'C')).toBe('Sin convergencia');
  });

  it('C + A → "Sin convergencia"', () => {
    expect(calcularConvergencia('C', 'A')).toBe('Sin convergencia');
  });

  it('B + C → "Pendiente" (at least one B)', () => {
    expect(calcularConvergencia('B', 'C')).toBe('Pendiente');
  });

  it('C + B → "Pendiente" (at least one B)', () => {
    expect(calcularConvergencia('C', 'B')).toBe('Pendiente');
  });
});

describe('calcularAccion()', () => {
  it('"Verificada" → "ABM ACTIVADO"', () => {
    expect(calcularAccion('Verificada')).toBe('ABM ACTIVADO');
  });

  it('"Pendiente" → "MONITOREO ACTIVO"', () => {
    expect(calcularAccion('Pendiente')).toBe('MONITOREO ACTIVO');
  });

  it('"Sin convergencia" → "ARCHIVAR"', () => {
    expect(calcularAccion('Sin convergencia')).toBe('ARCHIVAR');
  });
});

describe('MAOA end-to-end — all-zero edge case', () => {
  it('all zeros → score=0 → "C" → "Sin convergencia" → "ARCHIVAR"', () => {
    const tier = calcularTier([0, 0, 0, 0]);
    const tir  = calcularTir([0, 0, 0, 0]);

    expect(tier.score).toBe(0);
    expect(tier.clasificacion).toBe('C');
    expect(tir.score).toBe(0);
    expect(tir.clasificacion).toBe('C');

    const scoreFinal   = calcularScoreFinal(tier.score, tir.score);
    const convergencia = calcularConvergencia(tier.clasificacion, tir.clasificacion);
    const accion       = calcularAccion(convergencia);

    expect(scoreFinal).toBe(0);
    expect(convergencia).toBe('Sin convergencia');
    expect(accion).toBe('ARCHIVAR');
  });
});

describe('MAOA end-to-end — DHL exact case', () => {
  // TIER: [8.5, 9, 8, 9] → avg = 34.5 / 4 = 8.625 → A
  // TIR:  [7.5, 8, 7.5, 7.5] → avg = 30.5 / 4 = 7.625 → B
  // convergencia = A + B → "Pendiente"
  // score_final = (8.625 + 7.625) / 2 = 8.125

  it('tier=[8.5,9,8,9] → avg=8.625 → clasificacion="A"', () => {
    const { score, clasificacion } = calcularTier([8.5, 9, 8, 9]);
    expect(score).toBeCloseTo(8.625, 5);
    expect(clasificacion).toBe('A');
  });

  it('tir=[7.5,8,7.5,7.5] → avg=7.625 → clasificacion="B"', () => {
    const { score, clasificacion } = calcularTir([7.5, 8, 7.5, 7.5]);
    expect(score).toBeCloseTo(7.625, 5);
    expect(clasificacion).toBe('B');
  });

  it('convergencia = A + B → "Pendiente"', () => {
    expect(calcularConvergencia('A', 'B')).toBe('Pendiente');
  });

  it('score_final = (8.625 + 7.625) / 2 = 8.125', () => {
    expect(calcularScoreFinal(8.625, 7.625)).toBeCloseTo(8.125, 5);
  });

  it('accion = "Pendiente" → "MONITOREO ACTIVO"', () => {
    expect(calcularAccion('Pendiente')).toBe('MONITOREO ACTIVO');
  });

  it('full DHL pipeline produces correct outputs', () => {
    const tier = calcularTier([8.5, 9, 8, 9]);
    const tir  = calcularTir([7.5, 8, 7.5, 7.5]);

    expect(tier.score).toBeCloseTo(8.625, 5);
    expect(tier.clasificacion).toBe('A');
    expect(tir.score).toBeCloseTo(7.625, 5);
    expect(tir.clasificacion).toBe('B');

    const scoreFinal   = calcularScoreFinal(tier.score, tir.score);
    const convergencia = calcularConvergencia(tier.clasificacion, tir.clasificacion);
    const accion       = calcularAccion(convergencia);

    expect(scoreFinal).toBeCloseTo(8.125, 5);
    expect(convergencia).toBe('Pendiente');
    expect(accion).toBe('MONITOREO ACTIVO');
  });
});
