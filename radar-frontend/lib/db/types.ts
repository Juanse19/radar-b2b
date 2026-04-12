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
  estado: string; // 'running' | 'success' | 'error' | 'waiting'
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
  status: 'running' | 'success' | 'error' | 'partial' | 'waiting';
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
