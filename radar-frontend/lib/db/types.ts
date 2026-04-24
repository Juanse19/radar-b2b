// lib/db/types.ts
// Canonical DB row types — timestamps are strings (ISO 8601).
// Prisma impl converts Date → string at the boundary.
// Supabase returns strings natively.

export interface EmpresaRow {
  id: number;
  company_name: string;
  company_domain: string | null;
  company_url: string | null;
  pais: string | null;
  ciudad: string | null;
  linea_negocio: string;
  linea_raw: string | null;
  tier: string;
  status: string;
  prioridad: number;
  keywords: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One row in the `ejecuciones` table. Pipeline-tracking fields added in
 *  Sprint 1 of the agent tracker — see `prisma/schema.prisma`. */
export interface EjecucionRow {
  id: number;
  n8n_execution_id: string | null;
  linea_negocio: string | null;
  batch_size: number | null;
  estado: string; // 'running' | 'success' | 'error' | 'timeout'
  trigger_type: string; // 'manual' | 'scheduled' | 'cascade'
  parametros: Record<string, unknown> | null;
  error_msg: string | null;
  started_at: string;
  finished_at: string | null;
  /** 'calificador' | 'radar' | 'prospector' */
  agent_type: AgentType;
  /** uuid v4 grouping all executions of one logical pipeline run */
  pipeline_id: string | null;
  /** Self-FK to the parent ejecución when this row is part of a cascade */
  parent_execution_id: number | null;
  /** Latest n8n node label finished, derived server-side from runData */
  current_step: string | null;
}

export type AgentType = 'calificador' | 'radar' | 'prospector';

/** Composite DTO returned by GET /api/executions — groups all rows of one
 *  pipeline_id together so the tray can render them as a single unit. */
export interface PipelineDTO {
  pipeline_id: string;
  started_at: string;
  status: 'running' | 'success' | 'error' | 'partial' | 'timeout';
  agents: Array<EjecucionRow & { elapsed_seconds: number }>;
}

export interface SenalRow {
  id: number;
  empresa_id: number | null;
  ejecucion_id: number | null;
  empresa_nombre: string;
  empresa_pais: string | null;
  linea_negocio: string;
  tier: string | null;
  radar_activo: boolean;
  tipo_senal: string | null;
  descripcion: string | null;
  fuente: string | null;
  fuente_url: string | null;
  score_radar: number;
  ventana_compra: string | null;
  prioridad_comercial: string | null;
  motivo_descarte: string | null;
  ticket_estimado: string | null;
  razonamiento_agente: string | null;
  created_at: string;
  /** ID of the user (from matec_session) who triggered the scan — populated by WF02. */
  ejecutado_por_id?:     string | null;
  /** Display name of the user who triggered the scan — populated by WF02. */
  ejecutado_por_nombre?: string | null;
}

export interface ContactoRow {
  id: number;
  empresa_id: number | null;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  linkedin_url: string | null;
  empresa_nombre: string | null;
  linea_negocio: string | null;
  fuente: string;
  hubspot_status: string;
  hubspot_id: string | null;
  apollo_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspeccionLogRow {
  id: number;
  empresa_nombre: string;
  linea: string;
  n8n_execution_id: string | null;
  estado: string;
  contactos_encontrados: number;
  created_at: string;
  finished_at: string | null;
}

// Filter types used by index.ts dispatcher

export interface GetEmpresasFilter {
  linea?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  subLineaId?: number;
  tierActual?: string;
  pais?: string;
  pipeline?: string;
  radarActivo?: boolean;
  scoreMin?: number;
  busqueda?: string;
}

// Stub types for empresas.ts references (extended schema)
export interface EmpresaSubLineaRow {
  id: number;
  empresa_id: number;
  sub_linea_id: number;
  prioridad?: number;
}

export interface EmpresaTerminalRow {
  id: number;
  empresa_id: number;
  codigo_terminal?: string;
  nombre_terminal?: string;
}

export interface CrearEmpresaData {
  nombre?: string;
  company_name?: string;
  pais?: string;
  ciudad?: string;
  linea?: string;
  linea_negocio?: string;
  dominio?: string;
  company_domain?: string;
  company_url?: string;
  tier?: string;
  sub_lineas?: number[];
  sub_linea_principal_id?: number;
}

export interface GetSenalesFilter {
  linea?: string;
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
  empresaId?: number;
  /** Optional audit filter: only return rows triggered by this user ID. */
  ejecutadoPorId?: string;
}

export interface GetContactosFilter {
  empresaId?: number;
  linea?: string;
  hubspotStatus?: string;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

export interface GetProspeccionLogsFilter {
  linea?: string;
  estado?: string;
  limit?: number;
}

export interface ImportarEmpresaData {
  company_name: string;
  company_domain?: string;
  pais?: string;
  ciudad?: string;
  linea_negocio: string;
  prioridad?: number;
  tier?: string;
}

export interface ActualizarContactoData {
  nombre?: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  linkedin_url?: string;
  empresa_nombre?: string;
  linea_negocio?: string;
  hubspot_status?: string;
  hubspot_id?: string;
  // Apollo field names used internally
  first_name?: string;
  last_name?: string;
  title?: string;
  email_status?: string;
  phone_work_direct?: string;
  phone_mobile?: string;
  notas?: string;
}

export interface CrearProspeccionLogData {
  empresa_nombre: string;
  linea: string;
  n8n_execution_id?: string;
}

export interface ActualizarProspeccionLogData {
  estado?: string;
  contactos_encontrados?: number;
  finished_at?: string;
}

// ── Calificaciones ────────────────────────────────────────────────────────────

export type TierEnum = 'ORO' | 'MONITOREO' | 'ARCHIVO';

export interface CalificacionRow {
  id: number;
  empresa_id: number;
  score_total: number;
  tier_calculado: TierEnum;
  impacto_presupuesto: string | null;
  anio_objetivo: string | null;
  recurrencia: string | null;
  multiplanta: string | null;
  ticket_estimado: string | null;
  referente_mercado: string | null;
  prioridad_comercial: string | null;
  razonamiento: string | null;
  n8n_execution_id: string | null;
  created_at: string;
}

export interface CrearCalificacionData {
  empresa_id: number;
  score_total: number;
  tier_calculado: TierEnum;
  impacto_presupuesto?: string | null;
  anio_objetivo?: string | null;
  recurrencia?: string | null;
  multiplanta?: string | null;
  ticket_estimado?: string | null;
  referente_mercado?: string | null;
  prioridad_comercial?: string | null;
  razonamiento?: string | null;
  n8n_execution_id?: string | null;
}

export interface GetCalificacionesFilter {
  empresaId?: number;
  tierCalculado?: TierEnum;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── Radar Scans ───────────────────────────────────────────────────────────────

export interface RadarScanRow {
  id: number;
  empresa_id: number | null;
  empresa_nombre: string;
  empresa_pais: string | null;
  linea_negocio: string | null;
  score_radar: number;
  tier_compuesto: string | null;
  radar_activo: boolean;
  ventana_compra: string | null;
  capex_detectado: boolean;
  monto_estimado: string | null;
  horizonte_meses: number | null;
  fuentes_count: number;
  resumen: string | null;
  razonamiento_agente: string | null;
  n8n_execution_id: string | null;
  created_at: string;
}

export interface RadarFuenteRow {
  id: number;
  radar_scan_id: number;
  url: string;
  titulo: string | null;
  snippet: string | null;
  tavily_score: number | null;
  tipo_fuente: string | null;
  created_at: string;
}

export interface CrearRadarScanData extends Partial<RadarScanRow> {
  empresa_nombre: string;
  score_radar: number;
  fuentes?: Array<Omit<RadarFuenteRow, 'id' | 'radar_scan_id' | 'created_at'>>;
}

export interface GetRadarScansFilter {
  empresaId?: number;
  radarActivo?: boolean;
  ventanaCompra?: string;
  scoreGte?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── Líneas de negocio ─────────────────────────────────────────────────────────

export interface LineaNegocioRow {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface SubLineaNegocioRow {
  id: number;
  linea_id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  linea?: LineaNegocioRow;
  created_at: string;
  updated_at: string;
}

// ── Catálogos ─────────────────────────────────────────────────────────────────

export interface SectorRow {
  id: number;
  nombre: string;
  descripcion: string | null;
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
  updated_at: string;
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

// ── Prospecciones ─────────────────────────────────────────────────────────────

export type EstadoProspeccionEnum = 'pendiente' | 'en_progreso' | 'completado' | 'fallido' | 'sin_contactos';

export interface ProspeccionRow {
  id: number;
  empresa_id: number;
  sub_linea_id: number | null;
  estado: EstadoProspeccionEnum;
  contactos_encontrados: number;
  max_contactos: number | null;
  tier: TierEnum | null;
  n8n_execution_id: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface CrearProspeccionData {
  empresa_id: number;
  sub_linea_id?: number | null;
  estado?: EstadoProspeccionEnum;
  contactos_encontrados?: number;
  max_contactos?: number | null;
  tier?: TierEnum | null;
  n8n_execution_id?: string | null;
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
