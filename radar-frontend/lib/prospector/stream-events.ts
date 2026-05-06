/**
 * lib/prospector/stream-events.ts — Event taxonomy para Apollo Prospector v2.
 *
 * Mismo patrón que `lib/comercial/stream-events.ts` (Radar v2): el server
 * emite eventos SSE durante la búsqueda; el cliente los consume vía
 * EventSource y renderiza la timeline + tarjetas en vivo.
 */

export type ProspectorEventType =
  | 'session_started'
  | 'company_started'
  | 'searching'
  | 'found'
  | 'no_results'
  | 'enriching'
  | 'contact'
  | 'saved'
  | 'skipped_duplicate'
  | 'phone_unlocked'
  | 'rate_limit'
  | 'company_done'
  | 'company_error'
  | 'session_done'
  | 'error';

import type { Nivel } from './levels';

export interface SessionStartedPayload {
  sessionId:   string;
  modo:        'auto' | 'manual';
  empresas:    Array<{ empresa: string; pais: string; sublinea?: string | null }>;
  sublineas:   string[];
  total_jobs:  number;
  estimated_credits: number;
}

export interface CompanyStartedPayload {
  empresa: string;
  pais:    string;
  sublinea?: string | null;
  index:   number;
  total:   number;
}

export interface SearchingPayload {
  empresa:       string;
  pais:          string;
  titles_count:  number;
}

export interface FoundPayload {
  empresa:    string;
  pais:       string;
  candidates: number;
}

export interface NoResultsPayload {
  empresa: string;
  pais:    string;
  motivo?: string;
}

export interface EnrichingPayload {
  empresa: string;
  pais:    string;
  nombre:  string;
  cargo:   string;
  nivel:   Nivel;
  reveal_phone: boolean;
}

export interface ContactResult {
  apollo_id:    string;
  nombre:       string;
  apellido:     string;
  cargo:        string;
  nivel:        Nivel;
  empresa:      string;
  pais:         string;
  sublinea?:    string | null;
  linkedin:     string;
  email:        string;
  estado_email: string;
  tel_empresa:  string | null;
  tel_movil:    string | null;
  phone_unlocked: boolean;
  es_principal: boolean;
}

export interface ContactPayload extends ContactResult {}

export interface SavedPayload {
  apollo_id:  string;
  contacto_id: number;
}

export interface SkippedDuplicatePayload {
  apollo_id: string;
  empresa:   string;
  motivo:    'already_enriched' | 'in_session';
}

export interface PhoneUnlockedPayload {
  apollo_id:  string;
  contacto_id: number;
  tel_movil:  string;
}

export interface RateLimitPayload {
  empresa:   string;
  pais:      string;
  attempt:   number;
  retry_in_ms: number;
}

export interface CompanyDonePayload {
  empresa:    string;
  pais:       string;
  found:      number;
  saved:      number;
  skipped:    number;
  duration_ms: number;
}

export interface CompanyErrorPayload {
  empresa: string;
  pais:    string;
  error:   string;
}

export interface SessionDonePayload {
  sessionId:    string;
  total_companies: number;
  total_contacts:  number;
  total_with_email: number;
  total_with_phone: number;
  credits_used:    number;
  duration_ms:     number;
  cancelled?:      boolean;
  reason?:         'cap_reached' | 'cancelled' | 'completed';
}

export interface ErrorPayload {
  message: string;
  scope?:  'session' | 'company';
}

export interface ProspectorStreamEvent {
  id:   number;
  type: ProspectorEventType;
  data: unknown;
  ts:   number;
}

/** Hard cap to avoid runaway sessions. */
export const SESSION_CONTACT_CAP = 50;
