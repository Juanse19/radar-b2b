// lib/db/supabase/empresas.ts
import 'server-only';
import { adminDb } from './admin';
import type { EmpresaRow, ImportarEmpresaData } from '../types';

function assert(data: EmpresaRow[] | null, error: { message: string } | null): EmpresaRow[] {
  if (error) throw new Error(`Supabase empresas: ${error.message}`);
  return data ?? [];
}

export async function getEmpresasByLinea(linea: string, limit = 50, offset = 0): Promise<EmpresaRow[]> {
  let q = adminDb.from('empresas').select('*').eq('status', 'pending').order('company_name').range(offset, offset + limit - 1);
  if (linea !== 'ALL') q = q.eq('linea_negocio', linea);
  const { data, error } = await q;
  return assert(data as EmpresaRow[], error);
}

export async function getEmpresasCount(): Promise<Record<string, number>> {
  const { data, error } = await adminDb
    .from('empresas')
    .select('linea_negocio')
    .eq('status', 'pending');
  if (error) throw new Error(`Supabase getEmpresasCount: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const r of (data as { linea_negocio: string }[])) {
    counts[r.linea_negocio] = (counts[r.linea_negocio] ?? 0) + 1;
  }
  return counts;
}

export async function getEmpresasParaEscaneo(linea: string, limit: number): Promise<EmpresaRow[]> {
  let q = adminDb.from('empresas')
    .select('*').eq('status', 'pending')
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .order('company_name', { ascending: true })
    .limit(limit);
  if (linea !== 'ALL') q = q.eq('linea_negocio', linea);
  const { data, error } = await q;
  return assert(data as EmpresaRow[], error);
}

export async function getEmpresaStatus(id: number): Promise<{ status: string } | null> {
  const { data, error } = await adminDb.from('empresas').select('status').eq('id', id).single();
  if (error) return null;
  return data as { status: string };
}

export async function crearEmpresa(data: {
  company_name: string; company_domain?: string; company_url?: string;
  pais?: string; ciudad?: string; linea_negocio: string; tier?: string;
}): Promise<EmpresaRow> {
  const { data: row, error } = await adminDb.from('empresas').insert({
    company_name:   data.company_name,
    company_domain: data.company_domain ?? null,
    company_url:    data.company_url    ?? null,
    pais:           data.pais           ?? null,
    ciudad:         data.ciudad         ?? null,
    linea_negocio:  data.linea_negocio,
    tier:           data.tier           ?? 'Tier B',
    status:         'pending',
  }).select().single();
  if (error) throw new Error(`Supabase crearEmpresa: ${error.message}`);
  return row as EmpresaRow;
}

export async function actualizarEmpresa(
  id: number,
  data: Partial<{
    company_name: string; company_domain: string; company_url: string;
    pais: string; ciudad: string; linea_negocio: string; tier: string;
  }>,
): Promise<EmpresaRow> {
  const { data: row, error } = await adminDb.from('empresas').update(data).eq('id', id).select().single();
  if (error) throw new Error(`Supabase actualizarEmpresa: ${error.message}`);
  return row as EmpresaRow;
}

export async function eliminarEmpresa(id: number): Promise<void> {
  const { error } = await adminDb.from('empresas').delete().eq('id', id);
  if (error) throw new Error(`Supabase eliminarEmpresa: ${error.message}`);
}

export async function importarEmpresas(rows: ImportarEmpresaData[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0, skipped = 0;
  for (const e of rows) {
    const company_name  = String(e.company_name  ?? '').trim();
    const linea_negocio = String(e.linea_negocio ?? '').trim();
    if (!company_name || !linea_negocio) { skipped++; continue; }
    const { data: existing } = await adminDb.from('empresas')
      .select('id').eq('company_name', company_name).eq('linea_negocio', linea_negocio).maybeSingle();
    if (existing) { skipped++; continue; }
    const { error } = await adminDb.from('empresas').insert({
      company_name,
      company_domain: e.company_domain ?? null,
      pais:           e.pais           ?? null,
      ciudad:         e.ciudad         ?? null,
      linea_negocio,
      tier:           e.tier           ?? 'Tier B',
      status:         'pending',
    });
    if (error) { skipped++; continue; }
    inserted++;
  }
  return { inserted, skipped };
}
