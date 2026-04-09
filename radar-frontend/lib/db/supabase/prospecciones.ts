// lib/db/supabase/prospecciones.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type {
  ProspeccionRow, CrearProspeccionData, GetProspeccionesFilter,
  ContactoSinEncontrarRow,
} from '../types';

const S = SCHEMA;

export async function crearProspeccion(data: CrearProspeccionData): Promise<ProspeccionRow> {
  const cols = Object.keys(data);
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<ProspeccionRow>(
    `INSERT INTO ${S}.prospecciones (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearProspeccion: no row returned');
  return row;
}

export async function actualizarProspeccion(id: number, data: Partial<ProspeccionRow>): Promise<ProspeccionRow> {
  const patch = { ...data } as Record<string, unknown>;
  delete patch.id; delete patch.created_at;
  const sets = Object.entries(patch).map(([k, v]) => `${k} = ${pgLit(v)}`);
  const [row] = await pgQuery<ProspeccionRow>(
    `UPDATE ${S}.prospecciones SET ${sets.join(', ')} WHERE id = ${pgLit(id)} RETURNING *`
  );
  if (!row) throw new Error('actualizarProspeccion: not found');
  return row;
}

export async function getProspeccionesByEmpresa(empresaId: number, limit = 10): Promise<ProspeccionRow[]> {
  return pgQuery<ProspeccionRow>(
    `SELECT * FROM ${S}.prospecciones
     WHERE empresa_id = ${pgLit(empresaId)}
     ORDER BY created_at DESC LIMIT ${pgLit(limit)}`
  );
}

export async function getPropecciones(filter: GetProspeccionesFilter): Promise<ProspeccionRow[]> {
  const where: string[] = [];
  if (filter.empresaId)  where.push(`empresa_id = ${pgLit(filter.empresaId)}`);
  if (filter.estado)     where.push(`estado = ${pgLit(filter.estado)}`);
  if (filter.subLineaId) where.push(`sub_linea_id = ${pgLit(filter.subLineaId)}`);
  if (filter.from)       where.push(`created_at >= ${pgLit(filter.from)}`);
  if (filter.to)         where.push(`created_at <= ${pgLit(filter.to)}`);

  const limit  = filter.limit  ?? 50;
  const offset = filter.offset ?? 0;

  return pgQuery<ProspeccionRow>(
    `SELECT * FROM ${S}.prospecciones
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function crearContactoSinEncontrar(data: {
  empresa_id: number;
  prospeccion_id?: number;
  motivo: string;
  job_titles_intentados?: string[];
  paises_intentados?: string[];
  re_escanear?: boolean;
}): Promise<ContactoSinEncontrarRow> {
  const row = {
    empresa_id:           data.empresa_id,
    prospeccion_id:       data.prospeccion_id ?? null,
    motivo:               data.motivo,
    job_titles_intentados: data.job_titles_intentados ?? null,
    paises_intentados:    data.paises_intentados ?? null,
    re_escanear:          data.re_escanear ?? true,
  };
  const cols = Object.keys(row);
  const vals = cols.map((c) => pgLit((row as unknown as Record<string, unknown>)[c]));
  const [inserted] = await pgQuery<ContactoSinEncontrarRow>(
    `INSERT INTO ${S}.contactos_sin_encontrar (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!inserted) throw new Error('crearContactoSinEncontrar: no row returned');
  return inserted;
}

// ── Legacy compat ─────────────────────────────────────────────────────────

export async function crearProspeccionLogs(
  entries: Array<{ empresa_nombre: string; linea: string; n8n_execution_id?: string }>,
): Promise<void> {
  for (const e of entries) {
    try {
      await pgQuery(
        `INSERT INTO ${S}.prospecciones (empresa_id, estado, n8n_execution_id)
         VALUES (0, 'pendiente', ${pgLit(e.n8n_execution_id ?? null)})`
      );
    } catch { /* skip */ }
  }
}

export async function getProspeccionLogs(filter: { linea?: string; estado?: string; limit?: number }): Promise<ProspeccionRow[]> {
  const where: string[] = [];
  if (filter.estado) where.push(`estado = ${pgLit(filter.estado)}`);
  const limit = filter.limit ?? 50;
  return pgQuery<ProspeccionRow>(
    `SELECT * FROM ${S}.prospecciones
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT ${pgLit(limit)}`
  );
}

export async function actualizarProspeccionLog(
  id: number,
  data: { estado?: string; contactos_encontrados?: number; finished_at?: string },
): Promise<ProspeccionRow> {
  return actualizarProspeccion(id, data as Partial<ProspeccionRow>);
}
