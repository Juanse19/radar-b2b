/**
 * Utilidades para fechas devueltas por el agente RADAR.
 *
 * El agente puede devolver:
 *   - "DD/MM/AAAA"  (formato preferido en español)
 *   - "AAAA-MM-DD"  (ISO)
 *   - "No disponible" / "" / null
 *
 * Nunca usar `new Date(fecha)` directo: produce "Invalid Date" con DD/MM/AAAA.
 */

const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseFechaRadar(fecha: string | null | undefined): Date | null {
  if (!fecha) return null;
  const trimmed = String(fecha).trim();
  if (!trimmed || /^no\s+disponible$/i.test(trimmed) || trimmed === '—' || trimmed === '-') {
    return null;
  }

  const ddmm = trimmed.match(DD_MM_YYYY);
  if (ddmm) {
    const [, dd, mm, yyyy] = ddmm;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (ISO_DATE.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatFechaRadar(
  fecha: string | null | undefined,
  locale = 'es-CO',
): string {
  const d = parseFechaRadar(fecha);
  if (!d) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Fecha de hoy en formato DD/MM/AAAA — usar para inyectar {{FECHA_HOY}} en prompts.
 */
export function fechaHoyES(): string {
  return new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
