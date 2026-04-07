// lib/db/prisma/empresas.ts
import { prisma } from './client';
import type { EmpresaRow, ImportarEmpresaData } from '../types';

function toRow(r: {
  id: number; company_name: string; company_domain: string | null;
  company_url: string | null; pais: string | null; ciudad: string | null;
  linea_negocio: string; linea_raw?: string | null; tier: string; status: string;
  prioridad: number; keywords?: string | null;
  last_run_at: Date | null; created_at: Date; updated_at: Date;
}): EmpresaRow {
  return {
    id: r.id,
    company_name: r.company_name,
    company_domain: r.company_domain,
    company_url: r.company_url,
    pais: r.pais,
    ciudad: r.ciudad,
    linea_negocio: r.linea_negocio,
    linea_raw: r.linea_raw ?? null,
    tier: r.tier,
    status: r.status,
    prioridad: r.prioridad,
    keywords: r.keywords ?? null,
    last_run_at: r.last_run_at?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

export async function getEmpresasByLinea(linea: string, limit = 50, offset = 0): Promise<EmpresaRow[]> {
  const rows = await prisma.empresa.findMany({
    where: {
      status: 'pending',
      ...(linea !== 'ALL' ? { linea_negocio: linea } : {}),
    },
    orderBy: [{ company_name: 'asc' }],
    take: limit,
    skip: offset,
  });
  return rows.map(toRow);
}

export async function getEmpresasCount(): Promise<Record<string, number>> {
  const rows = await prisma.empresa.groupBy({
    by: ['linea_negocio'],
    where: { status: 'pending' },
    _count: { linea_negocio: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.linea_negocio] = r._count.linea_negocio;
  return counts;
}

export async function getEmpresasParaEscaneo(linea: string, limit: number): Promise<EmpresaRow[]> {
  const rows = await prisma.empresa.findMany({
    where: {
      status: 'pending',
      ...(linea !== 'ALL' ? { linea_negocio: linea } : {}),
    },
    orderBy: [{ last_run_at: 'asc' }, { company_name: 'asc' }],
    take: limit,
  });
  return rows.map(toRow);
}

export async function getEmpresaStatus(id: number): Promise<{ status: string } | null> {
  return prisma.empresa.findUnique({ where: { id }, select: { status: true } });
}

export async function crearEmpresa(data: {
  company_name: string;
  company_domain?: string;
  company_url?: string;
  pais?: string;
  ciudad?: string;
  linea_negocio: string;
  tier?: string;
}): Promise<EmpresaRow> {
  const row = await prisma.empresa.create({
    data: {
      company_name:   data.company_name,
      company_domain: data.company_domain ?? null,
      company_url:    data.company_url    ?? null,
      pais:           data.pais           ?? null,
      ciudad:         data.ciudad         ?? null,
      linea_negocio:  data.linea_negocio,
      tier:           data.tier           ?? 'Tier B',
      status:         'pending',
    },
  });
  return toRow(row);
}

export async function actualizarEmpresa(
  id: number,
  data: Partial<{
    company_name:   string;
    company_domain: string;
    company_url:    string;
    pais:           string;
    ciudad:         string;
    linea_negocio:  string;
    tier:           string;
  }>,
): Promise<EmpresaRow> {
  const row = await prisma.empresa.update({ where: { id }, data });
  return toRow(row);
}

export async function eliminarEmpresa(id: number): Promise<void> {
  await prisma.empresa.delete({ where: { id } });
}

export async function importarEmpresas(rows: ImportarEmpresaData[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0, skipped = 0;
  for (const e of rows) {
    const company_name  = String(e.company_name  ?? '').trim();
    const linea_negocio = String(e.linea_negocio ?? '').trim();
    if (!company_name || !linea_negocio) { skipped++; continue; }
    try {
      const existing = await prisma.empresa.findFirst({
        where: { company_name, linea_negocio },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }
      await prisma.empresa.create({
        data: {
          company_name,
          company_domain: e.company_domain ?? null,
          pais:           e.pais           ?? null,
          ciudad:         e.ciudad         ?? null,
          linea_negocio,
          tier:           e.tier           ?? 'Tier B',
          status:         'pending',
        },
      });
      inserted++;
    } catch {
      skipped++;
    }
  }
  return { inserted, skipped };
}
