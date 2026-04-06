// lib/db.ts
// Capa de base de datos con Prisma (SQLite dev / PostgreSQL prod).
// Mismas firmas que el anterior lib/supabase.ts → las API routes no cambian.

import { PrismaClient } from '@prisma/client';
import type { Empresa, LineaNegocio, ResultadoRadar } from './types';

// Singleton: evita abrir múltiples conexiones en dev con hot-reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ── Tipos internos ────────────────────────────────────────────────────────────

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
  prioridad?: number;
  last_run_at: Date | null;
}

export interface EjecucionDB {
  id: number;
  n8n_execution_id: string | null;
  linea_negocio: string | null;
  batch_size: number | null;
  estado: string;
  trigger_type: string;
  started_at: Date;
  finished_at: Date | null;
}

// ── Mapeo DB → tipo UI ────────────────────────────────────────────────────────

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

// ── Empresas ──────────────────────────────────────────────────────────────────

export async function getEmpresasByLinea(
  linea: string,
  limit = 50,
  offset = 0,
): Promise<Empresa[]> {
  const rows = await prisma.empresa.findMany({
    where: {
      status: 'pending',
      ...(linea !== 'ALL' ? { linea_negocio: linea } : {}),
    },
    orderBy: [{ company_name: 'asc' }],
    take: limit,
    skip: offset,
    select: {
      id: true,
      company_name: true,
      company_domain: true,
      company_url: true,
      pais: true,
      ciudad: true,
      linea_negocio: true,
      tier: true,
      status: true,
      last_run_at: true,
    },
  });
  return rows.map(r => dbToEmpresa(r as EmpresaDB));
}

export async function getEmpresasCount(): Promise<Record<string, number>> {
  const rows = await prisma.empresa.groupBy({
    by: ['linea_negocio'],
    where: { status: 'pending' },
    _count: { linea_negocio: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.linea_negocio] = r._count.linea_negocio;
  }
  return counts;
}

export async function getEmpresasParaEscaneo(
  linea: string,
  limit: number,
): Promise<EmpresaDB[]> {
  const rows = await prisma.empresa.findMany({
    where: {
      status: 'pending',
      ...(linea !== 'ALL' ? { linea_negocio: linea } : {}),
    },
    orderBy: [
      { last_run_at: 'asc' },    // nunca escaneadas primero
      { company_name: 'asc' },
    ],
    take: limit,
  });
  return rows as unknown as EmpresaDB[];
}

// ── Ejecuciones ───────────────────────────────────────────────────────────────

export async function registrarEjecucion(params: {
  n8n_execution_id?: string;
  linea_negocio?: string;
  batch_size?: number;
  trigger_type?: string;
  parametros?: Record<string, unknown>;
}): Promise<number> {
  const row = await prisma.ejecucion.create({
    data: {
      n8n_execution_id: params.n8n_execution_id,
      linea_negocio:    params.linea_negocio,
      batch_size:       params.batch_size,
      trigger_type:     params.trigger_type ?? 'manual',
      parametros:       params.parametros ? JSON.stringify(params.parametros) : null,
      estado:           'running',
    },
  });
  return row.id;
}

export async function actualizarEjecucion(
  id: number,
  updates: Partial<{
    estado: string;
    finished_at: string;
    error_msg: string;
    n8n_execution_id: string;
  }>,
): Promise<void> {
  await prisma.ejecucion.update({
    where: { id },
    data: {
      ...updates,
      ...(updates.finished_at ? { finished_at: new Date(updates.finished_at) } : {}),
    },
  });
}

export async function getEjecucionesRecientes(limit = 10): Promise<EjecucionDB[]> {
  const rows = await prisma.ejecucion.findMany({
    orderBy: { started_at: 'desc' },
    take: limit,
  });
  return rows as unknown as EjecucionDB[];
}

// ── CRUD Empresas ──────────────────────────────────────────────────────────────

export async function crearEmpresa(data: {
  company_name: string;
  company_domain?: string;
  company_url?: string;
  pais?: string;
  ciudad?: string;
  linea_negocio: string;
  tier?: string;
}): Promise<EmpresaDB> {
  const row = await prisma.empresa.create({
    data: {
      company_name:   data.company_name,
      company_domain: data.company_domain ?? null,
      company_url:    data.company_url ?? null,
      pais:           data.pais ?? null,
      ciudad:         data.ciudad ?? null,
      linea_negocio:  data.linea_negocio,
      tier:           data.tier ?? 'Tier B',
      status:         'pending',
    },
  });
  return row as unknown as EmpresaDB;
}

export async function actualizarEmpresa(
  id: number,
  data: Partial<{
    company_name: string;
    company_domain: string;
    company_url: string;
    pais: string;
    ciudad: string;
    linea_negocio: string;
    tier: string;
  }>,
): Promise<EmpresaDB> {
  const row = await prisma.empresa.update({
    where: { id },
    data,
  });
  return row as unknown as EmpresaDB;
}

export async function eliminarEmpresa(id: number): Promise<void> {
  await prisma.empresa.delete({ where: { id } });
}
