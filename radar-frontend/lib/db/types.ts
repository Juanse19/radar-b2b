// lib/db/types.ts
// Canonical DB row types for the matec_radar Supabase schema.
// Timestamps are returned as ISO 8601 strings by PostgREST.

// ---------------------------------------------------------------------------
// Enum union types (mirror Postgres enums)
// ---------------------------------------------------------------------------
export type TierEnum = 'A' | 'B' | 'C' | 'D' | 'sin_calificar';
export type PrioridadEnum = 'muy_alta' | 'alta' | 'media' | 'baja' | 'muy_baja' | 'descartada';
export type VentanaCompraEnum = '0_6m' | '6_12m' | '12_18m' | '18_24m' | 'mas_24m' | 'desconocida';
export type ImpactoEnum = 'muy_alto' | 'alto' | 'medio' | 'bajo' | 'muy_bajo';
export type RecurrenciaEnum = 'muy_alta' | 'alta' | 'media' | 'baja' | 'muy_baja';
export type MultiplantaEnum = 'unica_sede' | 'varias_sedes_regionales' | 'presencia_internacional' | 'desconocido';
export type ReferenteEnum = 'internacional' | 'pais' | 'baja' | 'desconocido';
export type PipelineEnum =
  | 'core' | 'en_observacion' | 'descartar'
  | 'no_iniciado' | 'investigacion' | 'contacto_inicial'
  | 'calificado' | 'propuesta' | 'negociacion'
  | 'cerrado_ganado' | 'cerrado_perdido';
export type RadarActivoEnum = 'activo' | 'pausado' | 'inactivo';
export type PaisIsoEnum =
  | 'MX' | 'CO' | 'BR' | 'AR' | 'CL' | 'PE' | 'EC' | 'UY' | 'PY' | 'BO' | 'VE'
  | 'CR' | 'PA' | 'GT' | 'SV' | 'HN' | 'NI' | 'DO' | 'JM' | 'BS'
  | 'US' | 'CA' | 'ES' | 'Otro';
export type EstadoEjecucionEnum = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type EstadoProspeccionEnum = 'pendiente' | 'ejecutando' | 'encontrado' | 'sin_contactos' | 'error';
export type HubspotStatusEnum = 'pendiente' | 'sincronizado' | 'error' | 'omitido';
export type WorkflowEnum = 'wf01_calificador' | 'wf02_radar' | 'wf03_prospector' | 'manual' | 'import';
export type MetaSchemaVersionEnum = 'v1_compacto' | 'v2_amplio';

// ---------------------------------------------------------------------------
// Catálogos administrables
// ---------------------------------------------------------------------------

export interface LineaNegocioRow {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  color_hex: string | null;
  icono: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface SubLineaNegocioRow {
  id: number;
  linea_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  excel_sheet_name: string | null;
  excel_file_pattern: string | null;
  meta_schema_version: MetaSchemaVersionEnum;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
  // join
  linea?: LineaNegocioRow;
}

export interface SectorRow {
  id: number;
  codigo: string | null;
  nombre: string;
  nombre_en: string | null;
  parent_id: number | null;
  nivel: number;
  activo: boolean;
  created_at: string;
}

export interface JobTitleRow {
  id: number;
  sub_linea_id: number;
  titulo: string;
  nivel: number;
  idioma: string;
  prioridad: number;
  activo: boolean;
  created_at: string;
}

export interface ConfiguracionScoringRow {
  id: number;
  sub_linea_id: number | null;
  dimension: string;
  peso: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Empresa (core)
// ---------------------------------------------------------------------------

export interface EmpresaRow {
  id: number;
  owner_id: string | null;
  company_name: string;
  company_name_norm: string;
  company_domain: string | null;
  company_url: string | null;
  grupo_empresarial: string | null;
  marca: string | null;
  pais: PaisIsoEnum | null;
  pais_nombre: string | null;
  estado_region: string | null;
  ciudad: string | null;
  sector_id: number | null;
  industria_cliente: string | null;
  sub_linea_principal_id: number | null;
  // Cache fields
  tier_actual: TierEnum;
  score_total_ultimo: number | null;
  score_radar_ultimo: number | null;
  composite_score_ultimo: number | null;
  prioridad: PrioridadEnum;
  radar_activo: RadarActivoEnum;
  pipeline: PipelineEnum;
  ultima_calificacion_id: number | null;
  ultimo_radar_scan_id: number | null;
  ultima_prospeccion_id: number | null;
  ultimo_scan_at: string | null;
  ultima_calificacion_at: string | null;
  // Pipeline comercial
  responsable_comercial: string | null;
  cuenta_estrategica: boolean;
  semaforo: string | null;
  ultimo_contacto_at: string | null;
  proximo_contacto_at: string | null;
  observaciones: string | null;
  // Meta flexible
  meta: Record<string, unknown>;
  keywords: string[] | null;
  // Trazabilidad
  source_file: string | null;
  source_sheet: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionales
  sub_linea_principal?: SubLineaNegocioRow;
  sub_lineas?: EmpresaSubLineaRow[];
}

export interface EmpresaSubLineaRow {
  empresa_id: number;
  sub_linea_id: number;
  es_principal: boolean;
  created_at: string;
  sub_linea?: SubLineaNegocioRow;
}

export interface EmpresaTerminalRow {
  id: number;
  empresa_id: number;
  iata_code: string;
  icao_code: string | null;
  nombre: string | null;
  pais: PaisIsoEnum | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

export interface EjecucionRow {
  id: number;
  n8n_execution_id: string | null;
  workflow: WorkflowEnum;
  sub_linea_id: number | null;
  batch_size: number | null;
  estado: EstadoEjecucionEnum;
  trigger_type: string;
  parametros: Record<string, unknown> | null;
  error_msg: string | null;
  total_empresas_procesadas: number;
  tokens_totales: number | null;
  costo_total_usd: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface CalificacionRow {
  id: number;
  empresa_id: number;
  ejecucion_id: number | null;
  n8n_execution_id: string | null;
  // 7 sub-scores
  score_impacto: number | null;
  score_multiplanta: number | null;
  score_recurrencia: number | null;
  score_referente: number | null;
  score_anio: number | null;
  score_ticket: number | null;
  score_prioridad: number | null;
  // Enums cualitativos
  impacto: ImpactoEnum | null;
  multiplanta: MultiplantaEnum | null;
  recurrencia: RecurrenciaEnum | null;
  referente: ReferenteEnum | null;
  // Resultados
  score_total: number;
  tier_calculado: TierEnum;
  anio_objetivo: number | null;
  ticket_estimado_usd: number | null;
  rango_ticket: string | null;
  // Trazabilidad
  razonamiento_agente: string | null;
  prompt_version: string | null;
  modelo_llm: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  costo_usd: number | null;
  config_scoring_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface RadarScanRow {
  id: number;
  empresa_id: number;
  ejecucion_id: number | null;
  n8n_execution_id: string | null;
  tipo_senal: string | null;
  descripcion_senal: string | null;
  fecha_senal: string | null;
  criterio_fuente: number | null;
  criterio_capex: number | null;
  criterio_horizonte: number | null;
  criterio_monto: number | null;
  criterio_multi_fuentes: number | null;
  score_radar: number;
  composite_score: number | null;
  tier_compuesto: TierEnum | null;
  ventana_compra: VentanaCompraEnum;
  prioridad_comercial: PrioridadEnum | null;
  radar_activo: boolean;
  motivo_descarte: string | null;
  razonamiento_agente: string | null;
  prompt_version: string | null;
  modelo_llm: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tavily_queries: number | null;
  costo_usd: number | null;
  created_at: string;
  // Joins opcionales
  fuentes?: RadarFuenteRow[];
}

export interface RadarFuenteRow {
  id: number;
  radar_scan_id: number;
  url: string;
  titulo: string | null;
  snippet: string | null;
  dominio: string | null;
  publicado_en: string | null;
  tavily_score: number | null;
  es_oficial: boolean;
  es_premium: boolean;
  validado: boolean;
  motivo_validacion: string | null;
  created_at: string;
}

export interface ProspeccionRow {
  id: number;
  empresa_id: number;
  ejecucion_id: number | null;
  n8n_execution_id: string | null;
  sub_linea_id: number | null;
  estado: EstadoProspeccionEnum;
  apollo_search_body: Record<string, unknown> | null;
  apollo_search_url: string | null;
  job_titles_usados: string[] | null;
  paises_buscados: string[] | null;
  max_contacts: number | null;
  contactos_encontrados: number;
  motivo_sin_contactos: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  apollo_credits_usados: number | null;
  costo_usd: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface ContactoRow {
  id: number;
  empresa_id: number;
  prospeccion_id: number | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;  // computed column
  title: string | null;
  seniority: string | null;
  departamento: string | null;
  email: string | null;
  email_status: string | null;
  email_confidence: number | null;
  phone_work_direct: string | null;
  phone_mobile: string | null;
  corporate_phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: PaisIsoEnum | null;
  apollo_id: string | null;
  apollo_person_raw: Record<string, unknown> | null;
  hubspot_id: string | null;
  hubspot_status: HubspotStatusEnum;
  hubspot_synced_at: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Join
  empresa?: Pick<EmpresaRow, 'id' | 'company_name' | 'pais' | 'sub_linea_principal_id'>;
}

export interface ContactoSinEncontrarRow {
  id: number;
  empresa_id: number;
  prospeccion_id: number | null;
  motivo: string;
  job_titles_intentados: string[] | null;
  paises_intentados: string[] | null;
  re_escanear: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface GetEmpresasFilter {
  subLineaId?: number;
  lineaId?: number;
  linea?: string;             // legacy compat — mapped to subLineaId internally
  tierActual?: TierEnum;
  scoreMin?: number;
  pais?: PaisIsoEnum;
  pipeline?: PipelineEnum;
  radarActivo?: RadarActivoEnum;
  busqueda?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface GetSenalesFilter {
  linea?: string;
  subLineaId?: number;
  tier?: string;
  pais?: string;
  activos?: boolean;
  scoreGte?: number;
  scoreLt?: number;
  from?: string;
  to?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GetContactosFilter {
  empresaId?: number;
  linea?: string;
  subLineaId?: number;
  hubspotStatus?: HubspotStatusEnum;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

export interface GetCalificacionesFilter {
  empresaId?: number;
  tierCalculado?: TierEnum;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface GetRadarScansFilter {
  empresaId?: number;
  radarActivo?: boolean;
  ventanaCompra?: VentanaCompraEnum;
  scoreGte?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface GetProspeccionesFilter {
  empresaId?: number;
  estado?: EstadoProspeccionEnum;
  subLineaId?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Mutation data types
// ---------------------------------------------------------------------------

export interface ImportarEmpresaData {
  company_name: string;
  company_domain?: string;
  pais?: string;
  ciudad?: string;
  linea_negocio: string;      // legacy — mapped to sub_linea_principal_id
  prioridad?: number;
  tier?: string;
}

export interface CrearEmpresaData {
  company_name: string;
  company_domain?: string;
  company_url?: string;
  pais?: PaisIsoEnum;
  pais_nombre?: string;
  estado_region?: string;
  ciudad?: string;
  industria_cliente?: string;
  grupo_empresarial?: string;
  sub_linea_principal_id?: number;
  tier_actual?: TierEnum;
  prioridad?: PrioridadEnum;
  observaciones?: string;
  meta?: Record<string, unknown>;
}

export interface ActualizarContactoData {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  phone_work_direct?: string;
  phone_mobile?: string;
  linkedin_url?: string;
  hubspot_status?: HubspotStatusEnum;
  hubspot_id?: string;
  notas?: string;
  // legacy compat
  nombre?: string;
  cargo?: string;
  telefono?: string;
}

export interface CrearCalificacionData {
  empresa_id: number;
  ejecucion_id?: number;
  n8n_execution_id?: string;
  score_impacto?: number;
  score_multiplanta?: number;
  score_recurrencia?: number;
  score_referente?: number;
  score_anio?: number;
  score_ticket?: number;
  score_prioridad?: number;
  impacto?: ImpactoEnum;
  multiplanta?: MultiplantaEnum;
  recurrencia?: RecurrenciaEnum;
  referente?: ReferenteEnum;
  score_total: number;
  tier_calculado: TierEnum;
  anio_objetivo?: number;
  ticket_estimado_usd?: number;
  rango_ticket?: string;
  razonamiento_agente?: string;
  prompt_version?: string;
  modelo_llm?: string;
  tokens_input?: number;
  tokens_output?: number;
  costo_usd?: number;
  config_scoring_snapshot?: Record<string, unknown>;
}

export interface CrearRadarScanData {
  empresa_id: number;
  ejecucion_id?: number;
  n8n_execution_id?: string;
  tipo_senal?: string;
  descripcion_senal?: string;
  fecha_senal?: string;
  criterio_fuente?: number;
  criterio_capex?: number;
  criterio_horizonte?: number;
  criterio_monto?: number;
  criterio_multi_fuentes?: number;
  score_radar: number;
  composite_score?: number;
  tier_compuesto?: TierEnum;
  ventana_compra?: VentanaCompraEnum;
  prioridad_comercial?: PrioridadEnum;
  radar_activo?: boolean;
  motivo_descarte?: string;
  razonamiento_agente?: string;
  prompt_version?: string;
  modelo_llm?: string;
  tokens_input?: number;
  tokens_output?: number;
  tavily_queries?: number;
  costo_usd?: number;
  fuentes?: Omit<RadarFuenteRow, 'id' | 'radar_scan_id' | 'created_at'>[];
}

export interface CrearProspeccionData {
  empresa_id: number;
  ejecucion_id?: number;
  n8n_execution_id?: string;
  sub_linea_id?: number;
  estado?: EstadoProspeccionEnum;
  apollo_search_body?: Record<string, unknown>;
  apollo_search_url?: string;
  job_titles_usados?: string[];
  paises_buscados?: string[];
  max_contacts?: number;
  contactos_encontrados?: number;
  motivo_sin_contactos?: string;
  tokens_input?: number;
  tokens_output?: number;
  apollo_credits_usados?: number;
  costo_usd?: number;
}

// Legacy compat aliases
export type SenalRow = RadarScanRow;
export type ProspeccionLogRow = ProspeccionRow;

export interface ActualizarProspeccionLogData {
  estado?: string;
  contactos_encontrados?: number;
  finished_at?: string;
}

export interface CrearProspeccionLogData {
  empresa_nombre: string;
  linea: string;
  n8n_execution_id?: string;
}
