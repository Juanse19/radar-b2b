// app/api/admin/permisos/route.ts
//
// GET  /api/admin/permisos — list all permissions ordered by module
// POST /api/admin/permisos — create a new permission
//
// Protected: ADMIN only.
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
    .from('system_permisos')
    .select('*')
    .order('modulo')
    .order('clave');

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
  const { clave, label, modulo, descripcion } = body ?? {};

  if (!clave || typeof clave !== 'string' || !clave.trim()) {
    return NextResponse.json({ error: 'El campo clave es requerido' }, { status: 400 });
  }
  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'El campo label es requerido' }, { status: 400 });
  }
  if (!modulo || typeof modulo !== 'string' || !modulo.trim()) {
    return NextResponse.json({ error: 'El campo modulo es requerido' }, { status: 400 });
  }

  const db = getAdminDb();
  const { data, error } = await db
    .from('system_permisos')
    .insert({
      clave:       clave.trim().toLowerCase(),
      label:       label.trim(),
      modulo:      modulo.trim().toLowerCase(),
      descripcion: descripcion?.trim() ?? null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json({ error: `La clave '${clave.trim()}' ya existe` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
