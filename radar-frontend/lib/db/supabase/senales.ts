// lib/db/supabase/senales.ts
import 'server-only';
import { adminDb } from './admin';
import type { SenalRow, GetSenalesFilter } from '../types';

const ALLOWED_SORT = new Set([
  'score_radar', 'created_at', 'empresa_nombre', 'linea_negocio',
]);

export async function getSenales(filter: GetSenalesFilter): Promise<SenalRow[]> {
  const {
    linea, pais, activos,
    scoreGte, scoreLt, from, to,
    sort = 'score_radar', order = 'desc',
    limit = 100, offset = 0,
  } = filter;

  const safeSort = ALLOWED_SORT.has(sort) ? sort : 'score_radar';

  let q = adminDb.from('senales').select('*')
    .order(safeSort, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);

  if (linea && linea !== 'ALL') q = q.eq('linea_negocio', linea);
  if (pais)                      q = q.ilike('empresa_pais', `%${pais}%`);
  if (activos)                   q = q.eq('radar_activo', true);
  if (scoreGte !== undefined)    q = q.gte('score_radar', scoreGte);
  if (scoreLt  !== undefined)    q = q.lt('score_radar',  scoreLt);
  if (from)                      q = q.gte('created_at',  from);
  if (to)                        q = q.lte('created_at',  to);

  const { data, error } = await q;
  if (error) throw new Error(`Supabase getSenales: ${error.message}`);
  return (data ?? []) as SenalRow[];
}

export async function crearSenal(data: {
  empresa_nombre:       string;
  empresa_pais?:        string | null;
  linea_negocio:        string;
  tier?:                string | null;
  radar_activo?:        boolean;
  tipo_senal?:          string | null;
  descripcion?:         string | null;
  fuente?:              string | null;
  fuente_url?:          string | null;
  score_radar?:         number;
  ventana_compra?:      string | null;
  prioridad_comercial?: string | null;
  motivo_descarte?:     string | null;
  ticket_estimado?:     string | null;
  razonamiento_agente?: string | null;
  empresa_id?:          number | null;
  ejecucion_id?:        number | null;
}): Promise<SenalRow> {
  const { data: row, error } = await adminDb.from('senales').insert({
    empresa_nombre:      data.empresa_nombre,
    empresa_pais:        data.empresa_pais        ?? null,
    linea_negocio:       data.linea_negocio,
    tier:                data.tier                ?? null,
    radar_activo:        data.radar_activo        ?? false,
    tipo_senal:          data.tipo_senal          ?? null,
    descripcion:         data.descripcion         ?? null,
    fuente:              data.fuente              ?? null,
    fuente_url:          data.fuente_url          ?? null,
    score_radar:         Number(data.score_radar  ?? 0),
    ventana_compra:      data.ventana_compra      ?? null,
    prioridad_comercial: data.prioridad_comercial ?? null,
    motivo_descarte:     data.motivo_descarte     ?? null,
    ticket_estimado:     data.ticket_estimado     ?? null,
    razonamiento_agente: data.razonamiento_agente ?? null,
    empresa_id:          data.empresa_id          ?? null,
    ejecucion_id:        data.ejecucion_id        ?? null,
  }).select().single();
  if (error) throw new Error(`Supabase crearSenal: ${error.message}`);
  return row as SenalRow;
}

export async function getSenalesSlim(): Promise<{ linea_negocio: string; score_radar: number; radar_activo: boolean }[]> {
  const { data, error } = await adminDb.from('senales').select('linea_negocio,score_radar,radar_activo');
  if (error) throw new Error(`Supabase getSenalesSlim: ${error.message}`);
  return (data ?? []) as { linea_negocio: string; score_radar: number; radar_activo: boolean }[];
}

export async function countSenalesOroHoy(): Promise<number> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const { count, error } = await adminDb.from('senales')
    .select('*', { count: 'exact', head: true })
    .gte('score_radar', 8)
    .gte('created_at', hoy.toISOString());
  if (error) throw new Error(`Supabase countSenalesOroHoy: ${error.message}`);
  return count ?? 0;
}
