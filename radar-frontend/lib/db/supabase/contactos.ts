// lib/db/supabase/contactos.ts
import 'server-only';
import { adminDb } from './admin';
import type { ContactoRow, GetContactosFilter, ActualizarContactoData } from '../types';

export async function getContactos(opts: GetContactosFilter = {}): Promise<ContactoRow[]> {
  const { empresaId, linea, hubspotStatus, busqueda, limit = 100, offset = 0 } = opts;

  let q = adminDb.from('contactos').select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (empresaId)                       q = q.eq('empresa_id', empresaId);
  if (linea && linea !== 'ALL')        q = q.eq('linea_negocio', linea);
  if (hubspotStatus)                   q = q.eq('hubspot_status', hubspotStatus);
  if (busqueda) {
    // Supabase textSearch / ilike OR
    q = q.or(`nombre.ilike.%${busqueda}%,cargo.ilike.%${busqueda}%,empresa_nombre.ilike.%${busqueda}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Supabase getContactos: ${error.message}`);
  return (data ?? []) as ContactoRow[];
}

export async function getContactosCount(opts: Omit<GetContactosFilter, 'limit' | 'offset'> = {}): Promise<number> {
  const { empresaId, linea, hubspotStatus, busqueda } = opts;

  let q = adminDb.from('contactos').select('*', { count: 'exact', head: true });

  if (empresaId)                       q = q.eq('empresa_id', empresaId);
  if (linea && linea !== 'ALL')        q = q.eq('linea_negocio', linea);
  if (hubspotStatus)                   q = q.eq('hubspot_status', hubspotStatus);
  if (busqueda) {
    q = q.or(`nombre.ilike.%${busqueda}%,cargo.ilike.%${busqueda}%,empresa_nombre.ilike.%${busqueda}%`);
  }

  const { count, error } = await q;
  if (error) throw new Error(`Supabase getContactosCount: ${error.message}`);
  return count ?? 0;
}

export async function getContactosByEmpresa(empresaId: number): Promise<ContactoRow[]> {
  return getContactos({ empresaId, limit: 200 });
}

export async function crearContacto(data: {
  nombre: string; cargo?: string; email?: string; telefono?: string;
  linkedin_url?: string; empresa_id?: number; empresa_nombre?: string;
  linea_negocio?: string; fuente?: string; apollo_id?: string;
}): Promise<ContactoRow> {
  const { data: row, error } = await adminDb.from('contactos').insert({
    nombre:         data.nombre,
    cargo:          data.cargo          ?? null,
    email:          data.email          ?? null,
    telefono:       data.telefono       ?? null,
    linkedin_url:   data.linkedin_url   ?? null,
    empresa_id:     data.empresa_id     ?? null,
    empresa_nombre: data.empresa_nombre ?? null,
    linea_negocio:  data.linea_negocio  ?? null,
    fuente:         data.fuente         ?? 'apollo',
    apollo_id:      data.apollo_id      ?? null,
    hubspot_status: 'pendiente',
  }).select().single();
  if (error) throw new Error(`Supabase crearContacto: ${error.message}`);
  return row as ContactoRow;
}

export async function importarContactos(
  contactos: Parameters<typeof crearContacto>[0][],
): Promise<{ inserted: number }> {
  const rows = contactos.map(c => ({
    nombre:         c.nombre,
    cargo:          c.cargo          ?? null,
    email:          c.email          ?? null,
    telefono:       c.telefono       ?? null,
    linkedin_url:   c.linkedin_url   ?? null,
    empresa_id:     c.empresa_id     ?? null,
    empresa_nombre: c.empresa_nombre ?? null,
    linea_negocio:  c.linea_negocio  ?? null,
    fuente:         c.fuente         ?? 'apollo',
    apollo_id:      c.apollo_id      ?? null,
    hubspot_status: 'pendiente',
  }));
  const { data, error } = await adminDb.from('contactos').insert(rows).select('id');
  if (error) throw new Error(`Supabase importarContactos: ${error.message}`);
  return { inserted: (data ?? []).length };
}

export async function actualizarContacto(id: number, data: ActualizarContactoData): Promise<ContactoRow> {
  const payload: Record<string, unknown> = {};
  if (data.nombre         !== undefined) payload.nombre         = data.nombre;
  if (data.cargo          !== undefined) payload.cargo          = data.cargo;
  if (data.email          !== undefined) payload.email          = data.email;
  if (data.telefono       !== undefined) payload.telefono       = data.telefono;
  if (data.linkedin_url   !== undefined) payload.linkedin_url   = data.linkedin_url;
  if (data.empresa_nombre !== undefined) payload.empresa_nombre = data.empresa_nombre;
  if (data.linea_negocio  !== undefined) payload.linea_negocio  = data.linea_negocio;
  if (data.hubspot_status !== undefined) payload.hubspot_status = data.hubspot_status;
  if (data.hubspot_id     !== undefined) payload.hubspot_id     = data.hubspot_id;

  const { data: row, error } = await adminDb.from('contactos').update(payload).eq('id', id).select().single();
  if (error) throw new Error(`Supabase actualizarContacto: ${error.message}`);
  return row as ContactoRow;
}

export async function actualizarHubSpotStatus(id: number, status: string, hubspotId?: string): Promise<void> {
  const { error } = await adminDb.from('contactos').update({
    hubspot_status: status,
    ...(hubspotId ? { hubspot_id: hubspotId } : {}),
  }).eq('id', id);
  if (error) throw new Error(`Supabase actualizarHubSpotStatus: ${error.message}`);
}

export async function eliminarContacto(id: number): Promise<void> {
  const { error } = await adminDb.from('contactos').delete().eq('id', id);
  if (error) throw new Error(`Supabase eliminarContacto: ${error.message}`);
}
