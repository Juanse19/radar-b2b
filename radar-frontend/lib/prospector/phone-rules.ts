/**
 * lib/prospector/phone-rules.ts — Decisión automática de revelar teléfono.
 *
 * Aunque el flujo del wizard expone "desbloquear teléfono por contacto"
 * (botón post-búsqueda), también existe una regla automática para escenarios
 * donde el usuario marca "buscar teléfonos automáticamente" en Step 3.
 *
 * Costo Apollo:
 *   - Email solo:           1 crédito
 *   - Email + teléfono:     9 créditos (reveal_phone_number=true)
 *
 * Regla por defecto: solo justifica el costo en C-LEVEL siempre y en
 * DIRECTOR si la empresa es Tier A (máxima prioridad comercial).
 */
import type { Nivel } from './levels';

/** Tiers reconocidos por Matec — alineados con `tier_enum` en matec_radar. */
export type Tier = 'A-ORO' | 'A' | 'B' | 'C' | 'sin_calificar';

export interface PhoneDecisionParams {
  nivel: Nivel;
  tier?: Tier | null;
}

/**
 * Decide si la búsqueda automática debe revelar el teléfono móvil.
 * Esto es solo para el modo "auto reveal" (default OFF en el wizard).
 * El desbloqueo manual por contacto ignora esta función.
 */
export function needsPhone({ nivel, tier }: PhoneDecisionParams): boolean {
  if (nivel === 'C-LEVEL')  return true;
  if (nivel === 'DIRECTOR') return tier === 'A-ORO' || tier === 'A';
  return false;
}

/**
 * Costo en créditos Apollo para enriquecer un contacto.
 * Útil para el estimador en Step 3 del wizard.
 */
export function creditCost(revealPhone: boolean): number {
  return revealPhone ? 9 : 1;
}
