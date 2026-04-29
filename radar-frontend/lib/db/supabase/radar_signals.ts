// lib/db/supabase/radar_signals.ts
// CRUD para tabla matec_radar.radar_signals (Modo Señales · v5).
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';

const S = SCHEMA;

export type NivelConfianza = 'ALTA' | 'MEDIA' | 'BAJA';

export interface SignalFuente {
  nombre: string;
  url:    string;
  tipo?:  string;
  peso?:  number;
}

export interface InsertSignalInput {
  session_id?:       string | null;
  empresa_id?:       number | null;
  empresa_es_nueva:  boolean;
  empresa_nombre:    string;
  pais?:             string | null;
  linea_negocio?:    string | null;
  sub_linea?:        string | null;
  tipo_senal?:       string | null;
  descripcion?:      string | null;
  ventana_compra?:   string | null;
  nivel_confianza?:  NivelConfianza | null;
  monto_inversion?:  string | null;
  fuentes?:          SignalFuente[];
  score_radar?:      number | null;
  raw_json?:         unknown;
}

export interface RadarSignalRow extends InsertSignalInput {
  id:          string;
  created_at:  string;
}

export async function insertRadarSignal(input: InsertSignalInput): Promise<RadarSignalRow> {
  const fuentesJson = JSON.stringify(input.fuentes ?? []);
  const rawJson = input.raw_json ? JSON.stringify(input.raw_json) : null;

  const row = await pgFirst<RadarSignalRow>(`
    INSERT INTO ${S}.radar_signals (
      session_id, empresa_id, empresa_es_nueva, empresa_nombre, pais,
      linea_negocio, sub_linea, tipo_senal, descripcion, ventana_compra,
      nivel_confianza, monto_inversion, fuentes, score_radar, raw_json
    ) VALUES (
      ${pgLit(input.session_id ?? null)},
      ${pgLit(input.empresa_id ?? null)},
      ${pgLit(input.empresa_es_nueva)},
      ${pgLit(input.empresa_nombre)},
      ${pgLit(input.pais ?? null)},
      ${pgLit(input.linea_negocio ?? null)},
      ${pgLit(input.sub_linea ?? null)},
      ${pgLit(input.tipo_senal ?? null)},
      ${pgLit(input.descripcion ?? null)},
      ${pgLit(input.ventana_compra ?? null)},
      ${pgLit(input.nivel_confianza ?? null)},
      ${pgLit(input.monto_inversion ?? null)},
      ${pgLit(fuentesJson)}::jsonb,
      ${pgLit(input.score_radar ?? null)},
      ${rawJson ? `${pgLit(rawJson)}::jsonb` : 'NULL'}
    )
    RETURNING *
  `);

  if (!row) throw new Error('insertRadarSignal: insert returned no row');
  return row;
}

export interface ListSignalsFilters {
  session_id?:      string;
  linea_negocio?:   string;
  pais?:            string;
  nivel_confianza?: NivelConfianza;
  empresa_es_nueva?: boolean;
  limit?:           number;
  offset?:          number;
}

export async function listRadarSignals(f: ListSignalsFilters = {}): Promise<RadarSignalRow[]> {
  const where: string[] = [];
  if (f.session_id)       where.push(`session_id = ${pgLit(f.session_id)}`);
  if (f.linea_negocio)    where.push(`linea_negocio = ${pgLit(f.linea_negocio)}`);
  if (f.pais)             where.push(`pais = ${pgLit(f.pais)}`);
  if (f.nivel_confianza)  where.push(`nivel_confianza = ${pgLit(f.nivel_confianza)}`);
  if (f.empresa_es_nueva !== undefined) where.push(`empresa_es_nueva = ${pgLit(f.empresa_es_nueva)}`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(f.limit ?? 100, 500);
  const offset = f.offset ?? 0;

  return pgQuery<RadarSignalRow>(`
    SELECT * FROM ${S}.radar_signals
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
}

/**
 * Find an existing empresa by normalized company_name (case + accent insensitive).
 * Returns null when there is no match — caller should INSERT a placeholder
 * empresa with source='radar_signal' and tier='sin_calificar'.
 */
export async function findEmpresaByNormName(
  empresaName: string,
): Promise<{ id: number; company_name: string } | null> {
  const trimmed = empresaName.trim();
  if (!trimmed) return null;

  const row = await pgFirst<{ id: number; company_name: string }>(`
    SELECT id, company_name
    FROM ${S}.empresas
    WHERE company_name_norm = lower(${S}.f_unaccent(${pgLit(trimmed)}))
    LIMIT 1
  `);
  return row ?? null;
}

/**
 * Insert an empresa placeholder discovered via radar signal.
 * Returns the new empresa id.
 */
export async function insertEmpresaFromSignal(input: {
  company_name: string;
  pais?:        string | null;
  linea_negocio?: string | null;
  sub_linea?:   string | null;
}): Promise<number> {
  const row = await pgFirst<{ id: number }>(`
    INSERT INTO ${S}.empresas (
      company_name, pais_nombre, meta
    ) VALUES (
      ${pgLit(input.company_name)},
      ${pgLit(input.pais ?? null)},
      ${pgLit(JSON.stringify({ source: 'radar_signal', tier: 'sin_calificar', linea: input.linea_negocio, sub_linea: input.sub_linea }))}::jsonb
    )
    RETURNING id
  `);
  if (!row) throw new Error('insertEmpresaFromSignal: insert returned no row');
  return row.id;
}
