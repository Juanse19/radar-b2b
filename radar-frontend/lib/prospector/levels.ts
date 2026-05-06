/**
 * lib/prospector/levels.ts — Clasificación de cargo → nivel jerárquico.
 *
 * Convierte un job title (en español o inglés) al nivel discreto usado
 * por el Prospector: C-LEVEL > DIRECTOR > GERENTE > JEFE > ANALISTA.
 *
 * El nivel decide:
 *   - Orden de priorización de contactos en una empresa.
 *   - Mapeo opcional al campo `seniority` de matec_radar.contactos
 *     (c_suite/vp/director/manager/contributor).
 */

export type Nivel =
  | 'C-LEVEL'
  | 'DIRECTOR'
  | 'GERENTE'
  | 'JEFE'
  | 'ANALISTA';

/** Orden de prioridad: menor = más alto. */
export const NIVEL_ORDEN: Record<Nivel, number> = {
  'C-LEVEL':  0,
  'DIRECTOR': 1,
  'GERENTE':  2,
  'JEFE':     3,
  'ANALISTA': 4,
};

/** Mapea Nivel → valor del enum `seniority` de matec_radar.contactos. */
export function nivelToSeniority(nivel: Nivel): string {
  switch (nivel) {
    case 'C-LEVEL':  return 'c_suite';
    case 'DIRECTOR': return 'director';
    case 'GERENTE':  return 'manager';
    case 'JEFE':     return 'manager';
    case 'ANALISTA': return 'contributor';
  }
}

/**
 * Clasifica un job title al nivel jerárquico correspondiente.
 * Si no matchea ningún patrón conocido, devuelve 'ANALISTA'.
 */
export function classifyLevel(title: string | null | undefined): Nivel {
  if (!title) return 'ANALISTA';
  const t = title.toLowerCase();

  // DIRECTOR (chequear ANTES que C-LEVEL para que "Vice President" no matchee
  // el `\bpresident\b` de C-LEVEL).
  if (
    /\bvp\b/.test(t)                         ||
    /\bvice president\b/.test(t)             ||
    /\bvicepresidente\b/.test(t)
  ) return 'DIRECTOR';

  // C-LEVEL — máxima prioridad (después del check de Vice President)
  if (
    /\bceo\b/.test(t)                        ||
    /\bcoo\b/.test(t)                        ||
    /\bcfo\b/.test(t)                        ||
    /\bcio\b/.test(t)                        ||
    /\bcto\b/.test(t)                        ||
    /\bcmo\b/.test(t)                        ||
    /\bcso\b/.test(t)                        ||
    /\bchief\s+\w+\s+officer\b/.test(t)      ||
    /\bgerente general\b/.test(t)            ||
    /\bdirector general\b/.test(t)           ||
    /\bmanaging director\b/.test(t)          ||
    /\bcountry manager\b/.test(t)            ||
    /\bpresidente\b/.test(t)                 ||
    /\bpresident\b/.test(t)                  ||
    /\bfundador\b/.test(t)                   ||
    /\bfounder\b/.test(t)                    ||
    /\bowner\b/.test(t)                      ||
    /\bdueño\b/.test(t)
  ) return 'C-LEVEL';

  // DIRECTOR (resto)
  if (
    /\bdirector\b/.test(t)                   ||
    /\bdirectora\b/.test(t)
  ) return 'DIRECTOR';

  // GERENTE / Manager / Head of
  if (
    /\bgerente\b/.test(t)                    ||
    /\bmanager\b/.test(t)                    ||
    /\bhead of\b/.test(t)                    ||
    /\bjefe de área\b/.test(t)               ||
    /\bplant manager\b/.test(t)
  ) return 'GERENTE';

  // JEFE / Coordinador / Supervisor / Lead
  if (
    /\bjefe\b/.test(t)                       ||
    /\bcoordinador\b/.test(t)                ||
    /\bcoordinator\b/.test(t)                ||
    /\bsupervisor\b/.test(t)                 ||
    /\blead\b/.test(t)                       ||
    /\bteam lead\b/.test(t)                  ||
    /\bencargado\b/.test(t)
  ) return 'JEFE';

  return 'ANALISTA';
}
