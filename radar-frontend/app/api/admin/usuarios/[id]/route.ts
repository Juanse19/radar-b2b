// app/api/admin/usuarios/[id]/route.ts
//
// PATCH  /api/admin/usuarios/[id] — update nombre, rol, and/or estado_acceso
// DELETE /api/admin/usuarios/[id] — permanently delete user from Auth + public.usuarios
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, string> = {};

  if (typeof body.nombre === 'string' && body.nombre.trim()) {
    updates.nombre = body.nombre.trim();
  }
  if (body.rol && ['ADMIN', 'COMERCIAL', 'AUXILIAR'].includes(body.rol)) {
    updates.rol = body.rol;
  }
  if (body.estado_acceso && ['ACTIVO', 'PENDIENTE', 'INACTIVO'].includes(body.estado_acceso)) {
    updates.estado_acceso = body.estado_acceso;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const { data, error } = await db
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const db = getAdminDb();

    // Fetch the auth_user_id before deleting the DB record
    const { data: usuario, error: fetchError } = await db
      .from('usuarios')
      .select('auth_user_id')
      .eq('id', id)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    // Delete from public.usuarios
    const { error: dbError } = await db.from('usuarios').delete().eq('id', id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    // Delete from Supabase Auth if auth_user_id is available
    if (usuario?.auth_user_id) {
      await db.auth.admin.deleteUser(usuario.auth_user_id).catch(() => {
        // Non-fatal: DB record already removed
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}
