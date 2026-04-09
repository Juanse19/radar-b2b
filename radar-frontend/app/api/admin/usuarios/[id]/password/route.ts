// app/api/admin/usuarios/[id]/password/route.ts
//
// PATCH /api/admin/usuarios/[id]/password — change a user's password via Supabase Auth Admin API
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
  const { password } = body;

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Contraseña inválida (mínimo 8 caracteres)' },
      { status: 400 },
    );
  }

  const db = getAdminDb();

  // Fetch auth_user_id from the usuarios table
  const { data: usuario, error: fetchError } = await db
    .from('usuarios')
    .select('auth_user_id, nombre')
    .eq('id', id)
    .single();

  if (fetchError || !usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  if (!usuario.auth_user_id) {
    return NextResponse.json(
      { error: 'El usuario no tiene cuenta de autenticación asociada' },
      { status: 422 },
    );
  }

  // Change password via Supabase Auth Admin API
  const { error: authError } = await db.auth.admin.updateUserById(
    usuario.auth_user_id,
    { password },
  );

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
