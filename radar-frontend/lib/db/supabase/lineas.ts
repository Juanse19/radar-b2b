// lib/db/supabase/lineas.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { LineaNegocioRow, SubLineaNegocioRow } from '../types';

const S = SCHEMA;

// ── Líneas de negocio ──────────────────────────────────────────────────────

export async function getLineas(): Promise<LineaNegocioRow[]> {
  return pgQuery<LineaNegocioRow>(
    `SELECT * FROM ${S}.lineas_negocio ORDER BY orden, nombre`
  );
}

export async function getLineaById(id: number): Promise<LineaNegocioRow | null> {
  return pgFirst<LineaNegocioRow>(
    `SELECT * FROM ${S}.lineas_negocio WHERE id = ${pgLit(id)} LIMIT 1`
  );
}

export async function crearLinea(
  data: Omit<LineaNegocioRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<LineaNegocioRow> {
  const cols = Object.keys(data);
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<LineaNegocioRow>(
    `INSERT INTO ${S}.lineas_negocio (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearLinea: no row returned');
  return row;
}

export async function actualizarLinea(id: number, data: Partial<LineaNegocioRow>): Promise<LineaNegocioRow> {
  const sets = Object.entries(data)
    .filter(([k]) => !['id', 'created_at'].includes(k))
    .map(([k, v]) => `${k} = ${pgLit(v)}`);
  const [row] = await pgQuery<LineaNegocioRow>(
    `UPDATE ${S}.lineas_negocio SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = ${pgLit(id)} RETURNING *`
  );
  if (!row) throw new Error('actualizarLinea: not found');
  return row;
}

export async function eliminarLinea(id: number): Promise<void> {
  await pgQuery(`DELETE FROM ${S}.lineas_negocio WHERE id = ${pgLit(id)}`);
}

// ── Sub-líneas ─────────────────────────────────────────────────────────────

export async function getSubLineas(lineaId?: number): Promise<SubLineaNegocioRow[]> {
  const where = lineaId ? `WHERE sl.linea_id = ${pgLit(lineaId)}` : '';
  return pgQuery<SubLineaNegocioRow>(
    `SELECT sl.*, row_to_json(ln.*) AS linea
     FROM ${S}.sub_lineas_negocio sl
     JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
     ${where}
     ORDER BY sl.orden, sl.nombre`
  );
}

export async function getSubLineaById(id: number): Promise<SubLineaNegocioRow | null> {
  return pgFirst<SubLineaNegocioRow>(
    `SELECT sl.*, row_to_json(ln.*) AS linea
     FROM ${S}.sub_lineas_negocio sl
     JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
     WHERE sl.id = ${pgLit(id)} LIMIT 1`
  );
}

export async function getSubLineaByCodigo(codigo: string): Promise<SubLineaNegocioRow | null> {
  return pgFirst<SubLineaNegocioRow>(
    `SELECT sl.*, row_to_json(ln.*) AS linea
     FROM ${S}.sub_lineas_negocio sl
     JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
     WHERE sl.codigo = ${pgLit(codigo)} LIMIT 1`
  );
}

export async function crearSubLinea(
  data: Omit<SubLineaNegocioRow, 'id' | 'created_at' | 'updated_at' | 'linea'>,
): Promise<SubLineaNegocioRow> {
  const cols = Object.keys(data);
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<{ id: number }>(
    `INSERT INTO ${S}.sub_lineas_negocio (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING id`
  );
  if (!row) throw new Error('crearSubLinea: no row returned');
  return (await getSubLineaById(row.id))!;
}

export async function actualizarSubLinea(id: number, data: Partial<SubLineaNegocioRow>): Promise<SubLineaNegocioRow> {
  const patch = { ...data } as Record<string, unknown>;
  delete patch.linea; delete patch.id; delete patch.created_at;
  const sets = Object.entries(patch).map(([k, v]) => `${k} = ${pgLit(v)}`);
  await pgQuery(
    `UPDATE ${S}.sub_lineas_negocio SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ${pgLit(id)}`
  );
  return (await getSubLineaById(id))!;
}

export async function eliminarSubLinea(id: number): Promise<void> {
  await pgQuery(`DELETE FROM ${S}.sub_lineas_negocio WHERE id = ${pgLit(id)}`);
}

export async function getSubLineaCodigoMap(): Promise<Record<string, number>> {
  const rows = await pgQuery<{ codigo: string; id: number }>(
    `SELECT codigo, id FROM ${S}.sub_lineas_negocio`
  );
  return Object.fromEntries(rows.map((r) => [r.codigo, r.id]));
}
