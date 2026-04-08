// app/api/admin/lineas/route.ts
//
// GET  /api/admin/lineas  — all business lines
// POST /api/admin/lineas  — create new line
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET() {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const db = getAdminDb();
  const { data, error } = await db
    .from('lineas_negocio')
    .select('*')
    .order('orden', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { nombre, descripcion, color_hex, icono, orden } = body ?? {};

  if (!nombre) return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 });

  const db = getAdminDb();
  const { data, error } = await db
    .from('lineas_negocio')
    .insert({ nombre, descripcion, color_hex, icono, orden: orden ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
