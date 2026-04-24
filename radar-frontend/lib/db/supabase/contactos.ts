// lib/db/supabase/contactos.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { ContactoRow, GetContactosFilter, ActualizarContactoData } from '../types';

const S = SCHEMA;

export async function getContactos(opts: GetContactosFilter = {}): Promise<ContactoRow[]> {
  const { empresaId, hubspotStatus, busqueda, limit = 100, offset = 0 } = opts;
  const where: string[] = [];

  if (empresaId)    where.push(`c.empresa_id = ${pgLit(empresaId)}`);
  if (hubspotStatus) where.push(`c.hubspot_status = ${pgLit(hubspotStatus)}`);
  if (busqueda) {
    const b = pgLit('%' + busqueda + '%');
    where.push(`(c.first_name ILIKE ${b} OR c.last_name ILIKE ${b} OR c.full_name ILIKE ${b} OR c.title ILIKE ${b})`);
  }

  return pgQuery<ContactoRow>(
    `SELECT c.* FROM ${S}.contactos c
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.created_at DESC
     LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}`
  );
}

export async function getContactosCount(opts: Omit<GetContactosFilter, 'limit' | 'offset'> = {}): Promise<number> {
  const { empresaId, hubspotStatus, busqueda } = opts;
  const where: string[] = [];

  if (empresaId)    where.push(`empresa_id = ${pgLit(empresaId)}`);
  if (hubspotStatus) where.push(`hubspot_status = ${pgLit(hubspotStatus)}`);
  if (busqueda) {
    const b = pgLit('%' + busqueda + '%');
    where.push(`(first_name ILIKE ${b} OR last_name ILIKE ${b} OR full_name ILIKE ${b})`);
  }

  const [row] = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${S}.contactos
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`
  );
  return parseInt(row?.count ?? '0', 10);
}

export async function getContactosByEmpresa(empresaId: number): Promise<ContactoRow[]> {
  return getContactos({ empresaId, limit: 200 });
}

export async function crearContacto(data: {
  empresa_id?: number; prospeccion_id?: number;
  first_name?: string; last_name?: string; title?: string;
  email?: string; email_status?: string;
  phone_work_direct?: string; phone_mobile?: string; linkedin_url?: string;
  apollo_id?: string; apollo_person_raw?: Record<string, unknown>;
  // legacy
  nombre?: string; cargo?: string; telefono?: string;
}): Promise<ContactoRow> {
  const row = {
    empresa_id:       data.empresa_id       ?? null,
    prospeccion_id:   data.prospeccion_id   ?? null,
    first_name:       data.first_name       ?? data.nombre?.split(' ')[0] ?? null,
    last_name:        data.last_name        ?? data.nombre?.split(' ').slice(1).join(' ') ?? null,
    title:            data.title            ?? data.cargo ?? null,
    email:            data.email            ?? null,
    email_status:     data.email_status     ?? null,
    phone_work_direct: data.phone_work_direct ?? data.telefono ?? null,
    phone_mobile:     data.phone_mobile     ?? null,
    linkedin_url:     data.linkedin_url     ?? null,
    apollo_id:        data.apollo_id        ?? null,
    apollo_person_raw: data.apollo_person_raw ? JSON.stringify(data.apollo_person_raw) : null,
    hubspot_status:   'pendiente',
  };
  const cols = Object.keys(row);
  const vals = cols.map((c) => pgLit((row as unknown as Record<string, unknown>)[c]));
  const [inserted] = await pgQuery<ContactoRow>(
    `INSERT INTO ${S}.contactos (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!inserted) throw new Error('crearContacto: no row returned');
  return inserted;
}

export async function importarContactos(
  contactos: Parameters<typeof crearContacto>[0][],
): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const c of contactos) {
    try {
      await crearContacto(c);
      inserted++;
    } catch {
      // skip duplicates (apollo_id unique)
    }
  }
  return { inserted };
}

export async function actualizarContacto(id: number, data: ActualizarContactoData): Promise<ContactoRow> {
  const payload: Record<string, unknown> = {};
  if (data.first_name !== undefined)       payload.first_name       = data.first_name;
  if (data.last_name  !== undefined)       payload.last_name        = data.last_name;
  if (data.title      !== undefined)       payload.title            = data.title;
  if (data.email      !== undefined)       payload.email            = data.email;
  if (data.email_status !== undefined)     payload.email_status     = data.email_status;
  if (data.phone_work_direct !== undefined) payload.phone_work_direct = data.phone_work_direct;
  if (data.phone_mobile !== undefined)     payload.phone_mobile     = data.phone_mobile;
  if (data.linkedin_url !== undefined)     payload.linkedin_url     = data.linkedin_url;
  if (data.hubspot_status !== undefined)   payload.hubspot_status   = data.hubspot_status;
  if (data.hubspot_id !== undefined)       payload.hubspot_id       = data.hubspot_id;
  if (data.notas !== undefined)            payload.notas            = data.notas;
  // legacy
  if (data.nombre   !== undefined) payload.first_name       = data.nombre;
  if (data.cargo    !== undefined) payload.title            = data.cargo;
  if (data.telefono !== undefined) payload.phone_work_direct = data.telefono;

  const sets = Object.entries(payload).map(([k, v]) => `${k} = ${pgLit(v)}`);
  const [row] = await pgQuery<ContactoRow>(
    `UPDATE ${S}.contactos SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = ${pgLit(id)} RETURNING *`
  );
  if (!row) throw new Error('actualizarContacto: not found');
  return row;
}

export async function actualizarHubSpotStatus(id: number, status: string, hubspotId?: string): Promise<void> {
  await pgQuery(
    `UPDATE ${S}.contactos SET
       hubspot_status = ${pgLit(status)},
       hubspot_id     = ${pgLit(hubspotId ?? null)},
       hubspot_synced_at = NOW()
     WHERE id = ${pgLit(id)}`
  );
}

export async function eliminarContacto(id: number): Promise<void> {
  await pgQuery(`DELETE FROM ${S}.contactos WHERE id = ${pgLit(id)}`);
}
