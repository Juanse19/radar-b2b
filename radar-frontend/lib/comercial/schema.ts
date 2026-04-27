const MESES_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

/**
 * Normalizes any fecha_senal variant the AI may produce into DD/MM/AAAA
 * or "No disponible". Called inside parseAgente1Response so the rest of
 * the app always receives a clean value.
 *
 * Handles: "16 de enero de 2026", "enero 2026", "2026-01-15", "Q1 2026", etc.
 */
export function normalizeFechaSenal(raw: string): string {
  const s = raw?.trim() ?? '';

  if (!s || /^no\s+disponible$/i.test(s) || s === 'No data' || s === 'N/A') return 'No disponible';

  // Already DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // ISO full: 2026-01-15
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  // ISO year-month: 2026-03
  const isoYm = s.match(/^(\d{4})-(\d{2})$/);
  if (isoYm) return `01/${isoYm[2]}/${isoYm[1]}`;

  // "16 de enero de 2026" or "16 de enero 2026"
  const dmY = s.match(/^(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+(?:de\s+)?(\d{4})$/i);
  if (dmY) {
    const mes = MESES_ES[dmY[2].toLowerCase()];
    if (mes) return `${dmY[1].padStart(2, '0')}/${mes}/${dmY[3]}`;
  }

  // "enero de 2026" or "enero 2026"
  const mY = s.match(/^([a-záéíóúü]+)\s+(?:de\s+)?(\d{4})$/i);
  if (mY) {
    const mes = MESES_ES[mY[1].toLowerCase()];
    if (mes) return `01/${mes}/${mY[2]}`;
  }

  // Year only or quarter notation → no date available
  if (/^\d{4}$/.test(s)) return 'No disponible';
  if (/^Q\d\s+\d{4}|trimestre|primer|segundo|tercer|cuarto/i.test(s)) return 'No disponible';

  return s;
}

export interface Agente1Result {
  empresa_evaluada:    string;
  radar_activo:        'Sí' | 'No';
  linea_negocio:       string | null;
  tipo_senal:          string;
  pais:                string;
  empresa_o_proyecto:  string;
  descripcion_resumen: string;
  criterios_cumplidos: string[];
  total_criterios:     number;
  ventana_compra:      string;
  monto_inversion:     string;
  fuente_link:         string;
  fuente_nombre:       string;
  fecha_senal:         string;
  evaluacion_temporal: string;
  observaciones:       string | null;
  motivo_descarte:     string;
}

export function parseAgente1Response(text: string): Agente1Result {
  // Remove potential markdown code fences
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Try extracting JSON from the text if there's surrounding prose
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No JSON found in Claude response: ${clean.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Claude response is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.empresa_evaluada) throw new Error('Missing field: empresa_evaluada');
  if (!obj.radar_activo)     throw new Error('Missing field: radar_activo');

  return {
    empresa_evaluada:    String(obj.empresa_evaluada ?? ''),
    radar_activo:        obj.radar_activo === 'Sí' ? 'Sí' : 'No',
    linea_negocio:       obj.linea_negocio != null ? String(obj.linea_negocio) : null,
    tipo_senal:          String(obj.tipo_senal          ?? 'Sin Señal'),
    pais:                String(obj.pais                ?? ''),
    empresa_o_proyecto:  String(obj.empresa_o_proyecto  ?? ''),
    descripcion_resumen: String(obj.descripcion_resumen ?? ''),
    criterios_cumplidos: Array.isArray(obj.criterios_cumplidos) ? obj.criterios_cumplidos.map(String) : [],
    total_criterios:     Number(obj.total_criterios     ?? 0),
    ventana_compra:      String(obj.ventana_compra      ?? 'Sin señal'),
    monto_inversion:     String(obj.monto_inversion     ?? 'No reportado'),
    fuente_link:         String(obj.fuente_link         ?? 'No disponible'),
    fuente_nombre:       String(obj.fuente_nombre       ?? ''),
    fecha_senal:         normalizeFechaSenal(String(obj.fecha_senal ?? '')),
    evaluacion_temporal: String(obj.evaluacion_temporal ?? ''),
    observaciones:       obj.observaciones != null ? String(obj.observaciones) : null,
    motivo_descarte:     String(obj.motivo_descarte     ?? ''),
  };
}
