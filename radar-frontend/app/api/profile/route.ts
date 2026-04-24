// app/api/profile/route.ts
//
// PATCH /api/profile — update own nombre
//
// Protected: any authenticated user can update their own profile.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';

  if (!nombre) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  const db = getAdminDb();
  const { error } = await db
    .from('usuarios')
    .update({ nombre })
    .eq('id', session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
