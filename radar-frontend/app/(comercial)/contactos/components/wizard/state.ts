/**
 * state.ts — Tipos + estado inicial para el wizard Prospector v2.
 *
 * El estado vive en React useState (no URL-driven) — el wizard de Contactos
 * es un flujo lineal sin necesidad de deep-link. Para historial usamos
 * /api/prospector/v2/sessions/[id].
 */

export type ProspectorMode = 'auto' | 'manual';

/**
 * Tiers reconocidos por matec_radar.tier_enum:
 * A (alta prioridad), B, C, D, sin_calificar.
 */
export type Tier = 'A' | 'B' | 'C' | 'D' | 'sin_calificar';

export interface EmpresaTarget {
  id?:       number;        // matec_radar.empresas.id (si conocida)
  empresa:   string;
  pais:      string;
  dominio?:  string | null;
  sublinea?: string | null; // codigo
  tier?:     string | null;
}

export interface ProspectorWizardState {
  step:           1 | 2 | 3 | 'live';

  // Step 1
  lineas:         string[];      // codigos de líneas seleccionadas (BHS, Cartón, Intralogística)
  sublineas:      string[];      // codigos de sub-líneas (aeropuertos, cargo_uld, ...)
  sublineaIds:    number[];      // ids de matec_radar.sub_lineas_negocio
  modo:           ProspectorMode | '';

  // Step 2 — Auto
  tiers:          Tier[];
  count:          number;        // 1..20

  // Step 2 — Manual
  empresas:       EmpresaTarget[];

  // Step 2 común
  jobTitles:      string[];      // editable; defaults vienen de getDefaultTitles()
  maxContactos:   number;        // 1..10 — contactos a obtener por empresa

  // Step 3
  revealPhoneAuto: boolean;      // si TRUE: cada enrich incluye teléfono (9 cred)

  // Live
  sessionId?:     string;
}

export const INITIAL_STATE: ProspectorWizardState = {
  step:            1,
  lineas:          [],
  sublineas:       [],
  sublineaIds:     [],
  modo:            '',
  tiers:           [],         // [] = sin filtro (todas las empresas). El user puede marcar A/B/C/D para filtrar.
  count:           5,
  empresas:        [],
  jobTitles:       [],
  maxContactos:    3,
  revealPhoneAuto: false,
};

export function canAdvanceStep(s: ProspectorWizardState): boolean {
  if (s.step === 1) {
    return s.lineas.length > 0 && s.modo !== '';
  }
  if (s.step === 2) {
    if (s.jobTitles.length === 0) return false;
    if (s.modo === 'auto')   return s.tiers.length > 0 && s.count > 0;
    if (s.modo === 'manual') return s.empresas.length > 0;
    return false;
  }
  return true;
}
