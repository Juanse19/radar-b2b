// app/api/admin/roles/[id]/route.ts
//
// PATCH  /api/admin/roles/[id] — update label, descripcion, color (not slug, not es_sistema)
// DELETE /api/admin/roles/[id] — delete role if es_sistema = false
//
// Protected: ADMIN only.
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

  if (typeof body.label === 'string' && body.label.trim()) {
    updates.label = body.label.trim();
  }
  if (typeof body.descripcion === 'string') {
    updates.descripcion = body.descripcion.trim();
  }
  if (typeof body.color === 'string' && body.color.trim()) {
    updates.color = body.color.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const { data, error } = await db
      .from('system_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tablas de roles no creadas aún. Ejecuta la migración SQL en Supabase.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 },
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

    // Verify role exists and is not a system role
    const { data: role, error: fetchError } = await db
      .from('system_roles')
      .select('es_sistema')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tablas de roles no creadas aún. Ejecuta la migración SQL en Supabase.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!role) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    if (role.es_sistema) {
      return NextResponse.json(
        { error: 'No se pueden eliminar roles de sistema' },
        { status: 403 },
      );
    }

    const { error } = await db.from('system_roles').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 },
    );
  }
}
