// app/api/admin/roles/[id]/permisos/route.ts
//
// GET    /api/admin/roles/[id]/permisos          — all permisos with asignado flag
// POST   /api/admin/roles/[id]/permisos          — assign permiso to role  { permiso_id }
// DELETE /api/admin/roles/[id]/permisos?permiso_id=X — remove permiso from role
//
// Protected: ADMIN only.
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  const db = getAdminDb();

  // Get all permissions + which are assigned to this role
  const [allPermisos, assigned] = await Promise.all([
    db.from('system_permisos').select('*').order('modulo').order('clave'),
    db.from('roles_permisos').select('permiso_id').eq('role_id', id),
  ]);

  if (allPermisos.error) {
    return NextResponse.json({ error: allPermisos.error.message }, { status: 500 });
  }
  if (assigned.error) {
    return NextResponse.json({ error: assigned.error.message }, { status: 500 });
  }

  const assignedIds = new Set((assigned.data ?? []).map((r) => r.permiso_id));

  const result = (allPermisos.data ?? []).map((p) => ({
    ...p,
    asignado: assignedIds.has(p.id),
  }));

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { permiso_id } = body ?? {};

  if (!permiso_id) {
    return NextResponse.json({ error: 'permiso_id es requerido' }, { status: 400 });
  }

  const db = getAdminDb();
  const { error } = await db
    .from('roles_permisos')
    .insert({ role_id: Number(id), permiso_id: Number(permiso_id) });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true }); // already assigned — idempotent
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  const permiso_id = req.nextUrl.searchParams.get('permiso_id');

  if (!permiso_id) {
    return NextResponse.json({ error: 'permiso_id query param es requerido' }, { status: 400 });
  }

  const db = getAdminDb();
  const { error } = await db
    .from('roles_permisos')
    .delete()
    .eq('role_id', Number(id))
    .eq('permiso_id', Number(permiso_id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
