// lib/lineas.ts
// Single source of truth for which business lines are active in the UI.
// Matec opera las 6 líneas de negocio en LATAM.

import type { LineaNegocio } from './types';

export const LINEAS_ACTIVAS: ReadonlyArray<LineaNegocio> = [
  'BHS',
  'Cartón',
  'Intralogística',
  'Final de Línea',
  'Motos',
  'SOLUMAT',
] as const;

export function isLineaActiva(linea: string | undefined | null): boolean {
  return !!linea && (LINEAS_ACTIVAS as readonly string[]).includes(linea);
}
