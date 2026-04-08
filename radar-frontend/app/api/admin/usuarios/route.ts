// app/api/admin/usuarios/route.ts
//
// GET  /api/admin/usuarios       — list all users from public.usuarios
// POST /api/admin/usuarios       — create user in Supabase Auth + public.usuarios
//
// Protected: only ADMIN role. Uses service-role client to bypass RLS.
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
    .from('usuarios')
    .select('id, nombre, email, rol, estado_acceso, created_at, aprobado_en')
    .order('created_at', { ascending: false });

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
  const { nombre, email, rol, password } = body ?? {};

  if (!nombre || !email || !rol) {
    return NextResponse.json({ error: 'nombre, email y rol son requeridos' }, { status: 400 });
  }

  if (!['ADMIN', 'COMERCIAL', 'AUXILIAR'].includes(rol)) {
    return NextResponse.json({ error: 'rol inválido' }, { status: 400 });
  }

  const db = getAdminDb();

  // 1. Create in Supabase Auth
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: password ?? crypto.randomUUID(), // random password if not provided
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // 2. Insert in public.usuarios
  const { data: usuario, error: dbError } = await db
    .from('usuarios')
    .insert({
      auth_user_id: authData.user.id,
      nombre,
      email,
      rol,
      estado_acceso: 'ACTIVO',
    })
    .select()
    .single();

  if (dbError) {
    // Rollback Auth user if DB insert fails
    await db.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(usuario, { status: 201 });
}
