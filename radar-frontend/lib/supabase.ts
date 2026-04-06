// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Empresa, LineaNegocio, ResultadoRadar } from './types';

const supabaseUrl  = process.env.SUPABASE_URL  || '';
const supabaseKey  = process.env.SUPABASE_ANON_KEY || '';

// Instancia singleton (reutilizada en toda la app)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'radar' },
});

// ── Tipos internos (alineados con radar.empresas) ────────────────────────────

export interface EmpresaDB {
  id: number;
  company_name: string;
  company_domain: string | null;
  company_url: string | null;
  pais: string | null;
  ciudad: string | null;
  linea_negocio: string;
  tier: string;
  status: string;
  last_run_at: string | null;
}

export interface EjecucionDB {
  id: number;
  n8n_execution_id: string | null;
  linea_negocio: string | null;
  batch_size: number | null;
  estado: string;
  trigger_type: string;
  empresas_procesadas: number | null;
  senales_encontradas: number;
  started_at: string;
  finished_at: string | null;
}

// ── Helpers de mapeo ─────────────────────────────────────────────────────────

function dbToEmpresa(row: EmpresaDB): Empresa {
  return {
    id:      String(row.id),
    nombre:  row.company_name,
    pais:    row.pais ?? '',
    linea:   row.linea_negocio as LineaNegocio,
    tier:    (row.tier as Empresa['tier']) || 'Tier B',
    dominio: row.company_domain ?? undefined,
  };
}

// ── Empresas ─────────────────────────────────────────────────────────────────

/**
 * Retorna empresas filtradas por línea de negocio.
 * Si linea = 'ALL' devuelve todas.
 */
export async function getEmpresasByLinea(
  linea: string,
  limit = 50,
  offset = 0
): Promise<Empresa[]> {
  let query = supabase
    .from('empresas')
    .select('id,company_name,company_domain,pais,linea_negocio,tier')
    .eq('status', 'pending')
    .order('company_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (linea !== 'ALL') {
    query = query.eq('linea_negocio', linea);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase getEmpresasByLinea: ${error.message}`);
  return (data as EmpresaDB[]).map(dbToEmpresa);
}

/**
 * Retorna el conteo de empresas agrupado por línea de negocio.
 * Ejemplo: { BHS: 130, Cartón: 150, Intralogística: 220 }
 */
export async function getEmpresasCount(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('empresas')
    .select('linea_negocio')
    .eq('status', 'pending');

  if (error) throw new Error(`Supabase getEmpresasCount: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of (data as { linea_negocio: string }[])) {
    counts[row.linea_negocio] = (counts[row.linea_negocio] || 0) + 1;
  }
  return counts;
}

/**
 * Retorna las N empresas que se van a escanear para una línea,
 * priorizando las que tienen last_run_at más antigua (rotación).
 */
export async function getEmpresasParaEscaneo(
  linea: string,
  limit: number
): Promise<EmpresaDB[]> {
  let query = supabase
    .from('empresas')
    .select('id,company_name,company_domain,company_url,pais,ciudad,linea_negocio,tier')
    .eq('status', 'pending')
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (linea !== 'ALL') {
    query = query.eq('linea_negocio', linea);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase getEmpresasParaEscaneo: ${error.message}`);
  return data as EmpresaDB[];
}

// ── Ejecuciones ───────────────────────────────────────────────────────────────

/**
 * Registra una nueva ejecución y retorna su ID.
 */
export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?: string;
  batch_size?: number;
  trigger_type?: string;
  parametros?: Record<string, unknown>;
}): Promise<number> {
  const { data, error } = await supabase
    .from('ejecuciones')
    .insert({
      n8n_execution_id: params.n8n_execution_id,
      linea_negocio:    params.linea_negocio,
      batch_size:       params.batch_size,
      trigger_type:     params.trigger_type ?? 'manual',
      parametros:       params.parametros,
      estado:           'running',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Supabase registrarEjecucion: ${error.message}`);
  return (data as { id: number }).id;
}

/**
 * Actualiza el estado de una ejecución existente.
 */
export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado: string;
    empresas_procesadas: number;
    senales_encontradas: number;
    finished_at: string;
    error_msg: string;
    n8n_execution_id: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('ejecuciones')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(`Supabase actualizarEjecucion: ${error.message}`);
}

/**
 * Retorna las últimas N ejecuciones para el historial.
 */
export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionDB[]> {
  const { data, error } = await supabase
    .from('ejecuciones')
    .select('id,n8n_execution_id,linea_negocio,batch_size,estado,trigger_type,empresas_procesadas,senales_encontradas,started_at,finished_at')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase getEjecucionesRecientes: ${error.message}`);
  return data as EjecucionDB[];
}

// ── Señales ───────────────────────────────────────────────────────────────────

/**
 * Inserta una señal detectada en la tabla radar.senales.
 */
export async function insertarSenal(senal: Omit<ResultadoRadar, 'fechaEscaneo'> & {
  empresa_id?: number;
  ejecucion_id?: number;
}): Promise<void> {
  const { error } = await supabase
    .from('senales')
    .insert({
      empresa_id:          senal.empresa_id,
      ejecucion_id:        senal.ejecucion_id,
      empresa_nombre:      senal.empresa,
      empresa_pais:        senal.pais,
      linea_negocio:       senal.linea,
      tier:                senal.tier,
      radar_activo:        senal.radarActivo === 'Sí',
      tipo_senal:          senal.tipoSenal,
      descripcion:         senal.descripcion,
      fuente:              senal.fuente,
      fuente_url:          senal.fuenteUrl,
      score_radar:         senal.scoreRadar,
      ventana_compra:      senal.ventanaCompra,
      prioridad_comercial: senal.prioridadComercial,
      motivo_descarte:     senal.motivoDescarte,
    });

  if (error) throw new Error(`Supabase insertarSenal: ${error.message}`);
}

// ── Configuración ─────────────────────────────────────────────────────────────

/**
 * Lee un valor de configuración del sistema.
 */
export async function getConfig<T = unknown>(clave: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', clave)
    .single();

  if (error || !data) return null;
  return (data as { valor: T }).valor;
}
