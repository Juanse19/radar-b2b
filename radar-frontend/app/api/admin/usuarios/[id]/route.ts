// app/api/admin/usuarios/[id]/route.ts
//
// PATCH /api/admin/usuarios/[id] — update rol and/or estado_acceso
// DELETE /api/admin/usuarios/[id] — deactivate (set estado_acceso = INACTIVO)
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

  if (body.rol && ['ADMIN', 'COMERCIAL', 'AUXILIAR'].includes(body.rol)) {
    updates.rol = body.rol;
  }
  if (body.estado_acceso && ['ACTIVO', 'PENDIENTE', 'INACTIVO'].includes(body.estado_acceso)) {
    updates.estado_acceso = body.estado_acceso;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const db = getAdminDb();
  const { data, error } = await db
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
