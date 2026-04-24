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
    fecha_senal:         String(obj.fecha_senal         ?? 'No disponible'),
    evaluacion_temporal: String(obj.evaluacion_temporal ?? ''),
    observaciones:       obj.observaciones != null ? String(obj.observaciones) : null,
    motivo_descarte:     String(obj.motivo_descarte     ?? ''),
  };
}
