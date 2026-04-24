/**
 * calificador/scoring.ts — Deterministic scoring logic.
 * Pure functions: no I/O, no side effects. Easy to unit-test.
 */
import type { Dimension, DimScores, Tier } from './types';

export const PESOS: Record<Dimension, number> = {
  impacto_presupuesto: 0.25,
  multiplanta:         0.15,
  recurrencia:         0.15,
  referente_mercado:   0.10,
  anio_objetivo:       0.15,
  ticket_estimado:     0.10,
  prioridad_comercial: 0.10,
};

/** Weighted average of 7 dimension scores → 0–10 with 1 decimal. */
export function calcularScore(scores: DimScores): number {
  const total = (Object.entries(scores) as [Dimension, number][]).reduce(
    (acc, [dim, val]) => acc + val * PESOS[dim],
    0,
  );
  return Math.round(total * 10) / 10;
}

/**
 * Map a weighted score to a tier letter.
 *   A (≥8) = ORO          → trigger Radar automatically
 *   B (≥5) = MONITOREO    → offer to trigger Radar
 *   C (≥3) = ARCHIVO      → offer to trigger Radar
 *   D (<3) = Descartar    → no radar suggestion
 */
export function asignarTier(score: number): Tier {
  if (score >= 8) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'D';
}

/** Human-readable label for a tier. */
export const TIER_LABEL: Record<Tier, string> = {
  A: 'ORO',
  B: 'MONITOREO',
  C: 'ARCHIVO',
  D: 'Descartar',
};

/** Whether this tier should trigger an automatic Radar suggestion. */
export function shouldSuggestRadar(tier: Tier): boolean {
  return tier === 'A' || tier === 'B' || tier === 'C';
}
