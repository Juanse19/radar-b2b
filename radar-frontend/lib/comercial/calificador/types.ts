/**
 * calificador/types.ts — Shared types for Calificador v2.
 * server-only: referenced by engine, providers, and API route.
 */

// V3 (Fase A1): tier es resultado calculado (no dimensión que el LLM elija).
// El LLM califica 8 dimensiones; el backend deriva score_total + tier de ellas.
// Sub-tiers (B-Alta/B-Baja) postergados — pendiente validación de umbrales
// con Felipe y Paola.
export type Tier = 'A' | 'B' | 'C' | 'D';

export type Dimension =
  | 'impacto_presupuesto'
  | 'multiplanta'
  | 'recurrencia'
  | 'referente_mercado'
  | 'acceso_al_decisor'
  | 'anio_objetivo'
  | 'prioridad_comercial'
  | 'cuenta_estrategica';

// ── Categorical value sets per dimension (single source of truth) ──────────
export type ImpactoCat        = 'Muy Alto' | 'Alto' | 'Medio' | 'Bajo' | 'Muy Bajo';
export type MultiplantaCat    = 'Presencia internacional' | 'Varias sedes regionales' | 'Única sede';
export type RecurrenciaCat    = 'Muy Alto' | 'Alto' | 'Medio' | 'Bajo' | 'Muy Bajo';
export type ReferenteCat      = 'Referente internacional' | 'Referente país' | 'Baja visibilidad';
export type AccesoDecisorCat  =
  | 'Sin Contacto'
  | 'Contacto Líder o Jefe'
  | 'Contacto Gerente o Directivo'
  | 'Contacto con 3 o más áreas';
export type AnioCat           = '2026' | '2027' | '2028' | 'Sin año';
export type PrioridadCat      = 'Muy Alta' | 'Alta' | 'Media' | 'Baja' | 'Muy Baja';
export type CuentaEstratCat   = 'Sí' | 'No';

export interface CalificacionInput {
  empresa: string;
  pais: string;
  /** Nombre de línea (ej. "BHS", "Intralogística") */
  lineaNombre: string;
  /** FK a sub_lineas_negocio.id — opcional si no se conoce */
  subLineaId?: number | null;
  company_domain?: string;
  ragContext?: RagContext;
  sessionId: string;
  /** API key resuelta desde ai_provider_configs (preferencia) o env var. */
  apiKey?: string;
  /** Override del modelo (ej. 'gpt-4o-mini'). */
  model?: string;
}

export interface RagContext {
  similares: Array<{ empresa: string; tier: string; score: number; linea: string }>;
  criterios: string[];
  rawBlock: string;
}

export interface DimScores {
  impacto_presupuesto: number;
  multiplanta: number;
  recurrencia: number;
  referente_mercado: number;
  acceso_al_decisor: number;
  anio_objetivo: number;
  prioridad_comercial: number;
  cuenta_estrategica: number;
}

/** v5: per-dimension detail produced by the Calificador prompt (optional). */
export interface DimensionDetail {
  valor:         string;
  justificacion: string;
}
export type DimensionDetails = Partial<Record<Dimension, DimensionDetail>>;

export interface CalificacionOutput {
  scores: DimScores;
  /** v5: optional rich per-dimension explanation. */
  dimensiones?: DimensionDetails;
  scoreTotal: number;
  tier: Tier;
  razonamiento: string;
  perfilWeb: { summary: string; sources: string[] };
  rawJson: unknown;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  model: string;
}

/** Minimal shape persisted to matec_radar.calificaciones */
export interface CalificacionRow {
  empresa_id?: number | null;
  session_id?: string;
  sub_linea_id?: number | null;
  linea_negocio?: string;
  provider?: string;
  score_impacto: number;
  score_multiplanta: number;
  score_recurrencia: number;
  score_referente: number;
  score_acceso_al_decisor: number;
  score_anio: number;
  score_prioridad: number;
  score_cuenta_estrategica: number;
  /** Legacy V2 column — kept nullable for backwards compat with old rows. */
  score_ticket?: number | null;
  score_total: number;
  tier_calculado: Tier;
  razonamiento_agente?: string;
  perfil_web_summary?: string;
  perfil_web_sources?: unknown;
  rag_context_used?: unknown;
  raw_llm_json?: unknown;
  /** V2: array of {dim, valor, score, justificacion} for UI rendering. */
  dimensiones?: unknown;
  modelo_llm?: string;
  tokens_input?: number;
  tokens_output?: number;
  costo_usd?: number;
  is_v2: true;
}
