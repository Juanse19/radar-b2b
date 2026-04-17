/**
 * stream-events.ts — Event taxonomy for Radar v2 live timeline (Fase G).
 *
 * These types describe the payload of each SSE event emitted during a scan.
 * The server emits; the client consumes via EventSource. Events are ephemeral
 * — they live in memory during the session only (no DB persistence).
 */

export type StreamEventType =
  | 'scan_started'
  | 'thinking'
  | 'search_query'
  | 'reading_source'
  | 'criteria_eval'
  | 'signal_detected'
  | 'signal_discarded'
  | 'token_tick'
  | 'company_done'
  | 'company_error'
  | 'session_done'
  | 'error';

export interface ScanStartedPayload {
  sessionId:  string;
  empresas:   string[];
  linea:      string;
  provider:   string;
}

export interface ThinkingPayload {
  empresa: string;
  linea:   string;
}

export interface SearchQueryPayload {
  empresa: string;
  query:   string;
}

export interface ReadingSourcePayload {
  empresa: string;
  url:     string;
  title?:  string;
}

export interface CriteriaEvalPayload {
  empresa:   string;
  criterio:  string;
  cumplido:  boolean;
}

export interface SignalDetectedPayload {
  empresa:          string;
  tipo_senal?:      string;
  monto_inversion?: string;
  ventana_compra?:  string;
  fuente_link?:     string;
}

export interface SignalDiscardedPayload {
  empresa:          string;
  motivo_descarte?: string;
}

export interface TokenTickPayload {
  empresa?:       string;
  tokens_in:      number;
  tokens_out:     number;
  cost_usd_delta: number;
  cost_usd_total: number;
}

export interface CompanyDonePayload {
  empresa:       string;
  radar_activo:  'Sí' | 'No';
  duration_ms:   number;
  tokens_in:     number;
  tokens_out:    number;
  cost_usd:      number;
  search_calls?: number;
}

export interface CompanyErrorPayload {
  empresa: string;
  error:   string;
}

export interface SessionDonePayload {
  sessionId:         string;
  total_empresas:    number;
  activas_count:     number;
  descartadas_count: number;
  errors_count:      number;
  duration_ms:       number;
  total_cost_usd:    number;
}

export interface ErrorPayload {
  message: string;
}

export type StreamEventPayload =
  | { type: 'scan_started';     data: ScanStartedPayload }
  | { type: 'thinking';         data: ThinkingPayload }
  | { type: 'search_query';     data: SearchQueryPayload }
  | { type: 'reading_source';   data: ReadingSourcePayload }
  | { type: 'criteria_eval';    data: CriteriaEvalPayload }
  | { type: 'signal_detected';  data: SignalDetectedPayload }
  | { type: 'signal_discarded'; data: SignalDiscardedPayload }
  | { type: 'token_tick';       data: TokenTickPayload }
  | { type: 'company_done';     data: CompanyDonePayload }
  | { type: 'company_error';    data: CompanyErrorPayload }
  | { type: 'session_done';     data: SessionDonePayload }
  | { type: 'error';            data: ErrorPayload };

export interface StreamEvent {
  id:   number;
  type: StreamEventType;
  data: unknown;
  ts:   number;
}
