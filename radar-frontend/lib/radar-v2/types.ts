/** Tipos para el módulo Radar v2 — Agente 1 RADAR (Claude Sonnet 4.6 + web_search) */

export type VerificationFlag = 'verificada' | 'no_verificable' | 'pendiente' | 'no_aplica';

export interface RadarV2Company {
  id: number;
  name: string;
  country: string;
  tier?: string;
  linea?: string;
}

export interface RadarV2ScanRequest {
  companies: RadarV2Company[];
  provider?: string;  // e.g. 'claude' | 'openai' | 'gemini'
  line: string;
}

export interface RadarV2Result {
  id?: string;
  session_id?: string;
  empresa_id?: number | null;
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
  tokens_input?:       number;
  tokens_output?:      number;
  cost_usd?:           number;
  created_at?:         string;
  // Verification fields (v2)
  fuente_verificada?:           VerificationFlag | null;
  verificacion_http_status?:    number | null;
  verificacion_fecha_valida?:   boolean | null;
  verificacion_monto_coincide?: boolean | null;
  verificacion_notas?:          string | null;
}

export interface RadarV2Session {
  id:               string;
  user_id?:         string | null;
  linea_negocio:    string;
  empresas_count:   number;
  total_cost_usd?:  number | null;
  created_at:       string;
  duration_ms?:     number | null;
  activas_count?:   number;
  descartadas_count?: number;
}

export interface RadarV2Metrics {
  range: 'day' | 'week' | 'month';
  totals: {
    scans:                number;
    activas:              number;
    descartadas:          number;
    costo_usd:            number;
    tokens_in:            number;
    tokens_out:           number;
    duracion_promedio_ms: number;
  };
  promedios: {
    costo_por_scan:   number;
    tokens_por_scan:  number;
  };
  ratio_activas: number;
  por_linea: Array<{ linea: string; scans: number; activas: number; descartadas: number; costo: number }>;
  serie:     Array<{ bucket: string; scans: number; costo: number }>;
}

export interface InformeSesion {
  session_id:       string;
  linea_negocio:    string;
  created_at:       string;
  duration_ms:      number | null;
  empresas_count:   number;
  total_cost_usd:   number;
  activas_count:    number;
  descartadas_count: number;
}

export interface Informe {
  session:    InformeSesion;
  activas:    Array<{
    empresa:           string;
    fuente_link:       string | null;
    fuente_verificada: string | null;
    monto:             string | null;
    fecha:             string | null;
    ventana:           string | null;
    tipo_senal:        string | null;
  }>;
  descartes:  Array<{
    empresa:             string;
    motivo_descarte:     string | null;
    descripcion_resumen: string | null;
  }>;
  markdown: string;
}

export interface RadarV2ScanResponse {
  session_id: string;
  results:    RadarV2Result[];
  total_cost_usd: number;
  errors:     Array<{ empresa: string; error: string }>;
}

/** Filters for the results view */
export interface RadarV2ResultsFilter {
  linea?:        string;
  radar_activo?: 'Sí' | 'No';
  ventana?:      string;
  from?:         string;
  to?:           string;
  limit?:        number;
  offset?:       number;
}

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

export interface CompanyScanState {
  company:  RadarV2Company;
  status:   ScanStatus;
  result?:  RadarV2Result;
  error?:   string;
}

// ---------------------------------------------------------------------------
// Alias and extension types for v2 production consumers
// ---------------------------------------------------------------------------

/** Alias for consumers that import MetricsRange from this module. */
export type MetricsRange = 'day' | 'week' | 'month';

/** RadarV2Result with all verification fields guaranteed present. */
export type RadarV2ResultWithVerification = RadarV2Result & {
  fuente_verificada:           VerificationFlag | null;
  verificacion_http_status:    number | null;
  verificacion_fecha_valida:   boolean | null;
  verificacion_monto_coincide: boolean | null;
  verificacion_notas:          string | null;
  verificado_en?:              string | null;
};

/** RadarV2Session with all extended session stats guaranteed present. */
export type RadarV2SessionExtended = RadarV2Session & {
  duration_ms:       number | null;
  activas_count:     number;
  descartadas_count: number;
};
