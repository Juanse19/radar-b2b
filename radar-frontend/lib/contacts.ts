// lib/contacts.ts — Capa de acceso a datos para Contacto (Prisma)
import { prisma } from './db';
import type { HubSpotStatus } from './types';

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
  created_at: Date;
  updated_at: Date;
}

export interface GetContactosOptions {
  empresaId?: number;
  linea?: string;
  hubspotStatus?: HubSpotStatus;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

export async function getContactos(opts: GetContactosOptions = {}): Promise<ContactoRow[]> {
  const { empresaId, linea, hubspotStatus, busqueda, limit = 100, offset = 0 } = opts;

  return prisma.contacto.findMany({
    where: {
      ...(empresaId ? { empresa_id: empresaId } : {}),
      ...(linea && linea !== 'ALL' ? { linea_negocio: linea } : {}),
      ...(hubspotStatus ? { hubspot_status: hubspotStatus } : {}),
      ...(busqueda ? {
        OR: [
          { nombre:         { contains: busqueda } },
          { cargo:          { contains: busqueda } },
          { empresa_nombre: { contains: busqueda } },
        ],
      } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  }) as unknown as ContactoRow[];
}

export async function getContactosCount(opts: Omit<GetContactosOptions, 'limit' | 'offset'> = {}): Promise<number> {
  const { empresaId, linea, hubspotStatus, busqueda } = opts;

  return prisma.contacto.count({
    where: {
      ...(empresaId ? { empresa_id: empresaId } : {}),
      ...(linea && linea !== 'ALL' ? { linea_negocio: linea } : {}),
      ...(hubspotStatus ? { hubspot_status: hubspotStatus } : {}),
      ...(busqueda ? {
        OR: [
          { nombre:         { contains: busqueda } },
          { cargo:          { contains: busqueda } },
          { empresa_nombre: { contains: busqueda } },
        ],
      } : {}),
    },
  });
}

export async function getContactosByEmpresa(empresaId: number): Promise<ContactoRow[]> {
  return getContactos({ empresaId, limit: 200 });
}

export async function crearContacto(data: {
  nombre: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  linkedin_url?: string;
  empresa_id?: number;
  empresa_nombre?: string;
  linea_negocio?: string;
  fuente?: string;
  apollo_id?: string;
}): Promise<ContactoRow> {
  return prisma.contacto.create({
    data: {
      nombre:         data.nombre,
      cargo:          data.cargo ?? null,
      email:          data.email ?? null,
      telefono:       data.telefono ?? null,
      linkedin_url:   data.linkedin_url ?? null,
      empresa_id:     data.empresa_id ?? null,
      empresa_nombre: data.empresa_nombre ?? null,
      linea_negocio:  data.linea_negocio ?? null,
      fuente:         data.fuente ?? 'apollo',
      apollo_id:      data.apollo_id ?? null,
      hubspot_status: 'pendiente',
    },
  }) as unknown as ContactoRow;
}

export async function importarContactos(
  contactos: Parameters<typeof crearContacto>[0][],
): Promise<{ inserted: number }> {
  const rows = contactos.map(c => ({
    nombre:         c.nombre,
    cargo:          c.cargo ?? null,
    email:          c.email ?? null,
    telefono:       c.telefono ?? null,
    linkedin_url:   c.linkedin_url ?? null,
    empresa_id:     c.empresa_id ?? null,
    empresa_nombre: c.empresa_nombre ?? null,
    linea_negocio:  c.linea_negocio ?? null,
    fuente:         c.fuente ?? 'apollo',
    apollo_id:      c.apollo_id ?? null,
    hubspot_status: 'pendiente',
    updated_at:     new Date(),
  }));

  const result = await prisma.contacto.createMany({ data: rows });
  return { inserted: result.count };
}

export async function actualizarHubSpotStatus(
  id: number,
  status: HubSpotStatus,
  hubspotId?: string,
): Promise<void> {
  await prisma.contacto.update({
    where: { id },
    data: { hubspot_status: status, ...(hubspotId ? { hubspot_id: hubspotId } : {}) },
  });
}

export async function eliminarContacto(id: number): Promise<void> {
  await prisma.contacto.delete({ where: { id } });
}
