/**
 * lib/apollo/job-titles.ts — Default Job Title catalog per sub-línea.
 *
 * Las sub-líneas se identifican por su `codigo` en `matec_radar.sub_lineas_negocio`.
 * Si un usuario no especifica títulos en el wizard, se usa esta lista por defecto.
 *
 * Nota: la BD también tiene `matec_radar.job_titles` con titles por sub-línea.
 * Esta lista hardcodeada sirve como fallback si la query a la BD falla
 * o si la sub-línea aún no tiene titles registrados en la BD.
 */

const TITLES_BY_SUBLINEA: Record<string, string[]> = {
  // ── BHS ─────────────────────────────────────────────────────────────────────
  aeropuertos: [
    'Director de Operaciones Aeroportuarias',
    'Director de Infraestructura',
    'Director de Proyectos',
    'Director de Operaciones',
    'COO',
    'CEO',
    'Gerente de Operaciones',
    'Airport Operations Manager',
    'Gerente de Infraestructura',
    'Gerente de Proyectos',
    'Head of Operations',
    'Head of Infrastructure',
  ],
  cargo_uld: [
    'Director de Operaciones',
    'Director de Logística',
    'COO',
    'CEO',
    'Gerente de Operaciones',
    'Gerente de Logística',
    'Gerente de Almacén',
    'Cargo Operations Manager',
    'Freight Manager',
    'Head of Cargo Operations',
    'Head of Logistics',
  ],

  // ── Cartón y Papel ───────────────────────────────────────────────────────────
  carton_corrugado: [
    'Gerente General',
    'Director General',
    'CEO',
    'Director de Operaciones',
    'Director de Producción',
    'Director de Manufactura',
    'Gerente de Planta',
    'Plant Manager',
    'Gerente de Producción',
    'Production Manager',
    'Gerente de Manufactura',
    'Manufacturing Manager',
    'Gerente de Corrugado',
    'Gerente de Conversión',
    'Conversion Manager',
  ],

  // ── Intralogística ───────────────────────────────────────────────────────────
  final_linea: [
    'Gerente General',
    'Director General',
    'CEO',
    'COO',
    'Director de Operaciones',
    'Director de Supply Chain',
    'Director de Manufactura',
    'Gerente de Planta',
    'Plant Manager',
    'Gerente de Producción',
    'Production Manager',
    'Gerente de Operaciones',
    'Operations Manager',
    'Gerente de Empaque',
    'Packaging Manager',
    'Head of Operations',
    'Head of Supply Chain',
  ],
  ensambladoras_motos: [
    'Gerente General',
    'Director de Manufactura',
    'Director de Operaciones',
    'CEO',
    'Gerente de Planta',
    'Plant Manager',
    'Gerente de Producción',
    'Production Manager',
    'Gerente de Manufactura',
    'Manufacturing Manager',
    'Gerente de Ensamble',
    'Assembly Manager',
    'Gerente de Operaciones',
    'Operations Manager',
  ],
  solumat: [
    'Gerente General',
    'Director General',
    'CEO',
    'Director de Operaciones',
    'Director de Manufactura',
    'Director de Producción',
    'Gerente de Planta',
    'Plant Manager',
    'Gerente de Producción',
    'Production Manager',
    'Gerente de Manufactura',
    'Manufacturing Manager',
    'Gerente de Operaciones',
    'Operations Manager',
    'Head of Manufacturing',
  ],
  logistica: [
    'Gerente General',
    'Director General',
    'CEO',
    'COO',
    'Director de Logística',
    'Director de Supply Chain',
    'Director de Operaciones',
    'Gerente de Logística',
    'Gerente de Supply Chain',
    'Gerente de Distribución',
    'Logistics Manager',
    'Supply Chain Manager',
    'Distribution Manager',
    'Head of Logistics',
    'Head of Supply Chain',
  ],
};

const DEFAULT_FALLBACK = TITLES_BY_SUBLINEA.final_linea;

/**
 * Devuelve la lista por defecto de job titles para una sub-línea.
 * Acepta el `codigo` (ej. "aeropuertos") o variantes con guiones/mayúsculas.
 */
export function getDefaultTitles(sublineaCodigo: string | null | undefined): string[] {
  if (!sublineaCodigo) return DEFAULT_FALLBACK;
  const key = String(sublineaCodigo).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TITLES_BY_SUBLINEA[key] ?? DEFAULT_FALLBACK;
}

/** Lista de las sub-líneas reconocidas con titles por defecto. */
export const SUBLINEAS_WITH_DEFAULTS = Object.keys(TITLES_BY_SUBLINEA);
