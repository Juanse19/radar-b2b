/**
 * calificador/scoring.ts — Deterministic scoring logic (V3 / Fase A1).
 *
 * 8 dimensiones que el LLM califica → ponderación → score 0-10 → tier.
 * Tier es resultado calculado, NO una dimensión que el LLM elige.
 *
 * Pure functions: no I/O, no side effects. Easy to unit-test.
 */
import type { Dimension, DimScores, Tier } from './types';

// ── Weights (sum = 1.00) for the 8 calificador dimensions ───────────────────
//
// Ajustado para Fase A1:
//   - Eliminado `ticket_estimado` (no aparece en spreadsheets oficiales).
//   - Agregado `acceso_al_decisor` con peso alto (es señal directa de
//     ejecución comercial).
//   - `tier` ya no es dimensión; se deriva del score total.
export const PESOS: Record<Dimension, number> = {
  impacto_presupuesto: 0.20,
  prioridad_comercial: 0.18,
  acceso_al_decisor:   0.15,
  cuenta_estrategica:  0.13,
  anio_objetivo:       0.12,
  multiplanta:         0.10,
  recurrencia:         0.07,
  referente_mercado:   0.05,
};

/** Weighted average of 8 dimension scores → 0–10 with 1 decimal. */
export function calcularScore(scores: DimScores): number {
  const total = (Object.entries(scores) as [Dimension, number][]).reduce(
    (acc, [dim, val]) => acc + val * (PESOS[dim] ?? 0),
    0,
  );
  return Math.round(total * 10) / 10;
}

/**
 * Map a weighted score to a tier letter.
 *   A (≥8) = ORO        → trigger Radar automatically
 *   B (≥5) = MONITOREO  → offer to trigger Radar
 *   C (≥3) = ARCHIVO    → offer to trigger Radar
 *   D (<3) = Descartar  → no radar suggestion
 */
export function asignarTier(score: number): Tier {
  if (score >= 8) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'D';
}

/**
 * Human-readable label for a tier.
 * Convención del equipo comercial Matec: se muestra como "Tier X"
 * (no como "ORO/MONITOREO/ARCHIVO" — esos eran los nombres del backlog
 * interno de WF01 N8N, ya retirado).
 */
export const TIER_LABEL: Record<Tier, string> = {
  A: 'Tier A',
  B: 'Tier B',
  C: 'Tier C',
  D: 'Tier D',
};

/** Whether this tier should trigger an automatic Radar suggestion. */
export function shouldSuggestRadar(tier: Tier): boolean {
  return tier === 'A' || tier === 'B' || tier === 'C';
}

// ─── Categórico ↔ Score mapping ───────────────────────────────────────────────
//
// Source of truth: la rúbrica cualitativa de Matec (pantallazos oficiales).
// Cada dimensión mapea un valor categórico ("Muy Alto", "Sí", "Sin Contacto"…)
// a un score 0-10 utilizado por `calcularScore`.

const CATEGORICO_SCORE_MAP: Record<Dimension, Record<string, number>> = {
  impacto_presupuesto: {
    'Muy Alto': 10, 'Alto': 8, 'Medio': 6, 'Bajo': 4, 'Muy Bajo': 2,
  },
  multiplanta: {
    'Presencia internacional': 10,
    'Varias sedes regionales': 6,
    'Única sede': 2,
  },
  recurrencia: {
    'Muy Alto': 10, 'Alto': 8, 'Medio': 6, 'Bajo': 4, 'Muy Bajo': 2,
  },
  referente_mercado: {
    'Referente internacional': 10,
    'Referente país': 6,
    'Baja visibilidad': 2,
  },
  acceso_al_decisor: {
    'Contacto con 3 o más áreas': 10,
    'Contacto Gerente o Directivo': 7,
    'Contacto Líder o Jefe': 4,
    'Sin Contacto': 1,
  },
  anio_objetivo: {
    '2026': 10, '2027': 6, '2028': 2, 'Sin año': 0,
  },
  prioridad_comercial: {
    'Muy Alta': 10, 'Alta': 8, 'Media': 5, 'Baja': 3, 'Muy Baja': 1,
  },
  cuenta_estrategica: {
    'Sí': 10, 'No': 0,
  },
};

/**
 * Map a categorical value to a numeric score 0–10.
 * Throws when `valor` is not in the dimension's allowed set.
 */
export function categoricoToScore(dim: Dimension, valor: string): number {
  const map = CATEGORICO_SCORE_MAP[dim];
  if (!map) {
    throw new Error(`Unknown dimension: ${dim}`);
  }
  if (!(valor in map)) {
    throw new Error(
      `Invalid categorical value "${valor}" for dimension "${dim}". ` +
      `Expected one of: ${Object.keys(map).join(' | ')}`,
    );
  }
  return map[valor];
}

/**
 * Inverse mapping: pick the closest categorical label for a numeric score.
 * Used for backward compatibility with rows that only have numeric scores.
 */
export function scoreToCategorico(dim: Dimension, score: number): string {
  const map = CATEGORICO_SCORE_MAP[dim];
  if (!map) return String(score);

  let bestLabel = '';
  let bestDist  = Infinity;
  for (const [label, val] of Object.entries(map)) {
    const dist = Math.abs(val - score);
    if (dist < bestDist) {
      bestDist = dist;
      bestLabel = label;
    }
  }
  return bestLabel;
}

/** Allowed categorical values for a dimension (for Zod enum / UI dropdowns). */
export function allowedCategoricos(dim: Dimension): string[] {
  return Object.keys(CATEGORICO_SCORE_MAP[dim] ?? {});
}
