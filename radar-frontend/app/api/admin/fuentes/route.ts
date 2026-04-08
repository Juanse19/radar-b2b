// app/api/admin/fuentes/route.ts — GET + POST
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET() {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const db = getAdminDb();
  const { data, error } = await db
    .from('fuentes')
    .select('*')
    .order('priority_score', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const { nombre, url_base, tipo, lineas, priority_score, notas } = body ?? {};
  if (!nombre) return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 });

  const db = getAdminDb();
  const { data, error } = await db
    .from('fuentes')
    .insert({ nombre, url_base, tipo, lineas: lineas ?? [], priority_score: priority_score ?? 5, notas })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
