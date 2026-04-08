// lib/lineas.ts
// Single source of truth for which business lines are active in the UI.
// Matec only uses 3 lineas en producción: BHS, Cartón, Intralogística.
// Las demás (Final de Línea, Motos, SOLUMAT) están en el tipo pero no se muestran.

import type { LineaNegocio } from './types';

export const LINEAS_ACTIVAS: ReadonlyArray<LineaNegocio> = [
  'BHS',
  'Cartón',
  'Intralogística',
] as const;

export function isLineaActiva(linea: string | undefined | null): boolean {
  return !!linea && (LINEAS_ACTIVAS as readonly string[]).includes(linea);
}
