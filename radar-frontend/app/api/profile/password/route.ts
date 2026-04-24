// app/api/profile/password/route.ts
//
// POST /api/profile/password — change own password
//
// Does NOT require current password — the user is already authenticated via session cookie.
// The admin can always reset externally if needed.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { password_nuevo } = body;

  if (!password_nuevo || typeof password_nuevo !== 'string' || password_nuevo.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener mínimo 8 caracteres' }, { status: 400 });
  }

  const db = getAdminDb();

  // Fetch the auth_user_id for this app user
  const { data: usuario, error: fetchError } = await db
    .from('usuarios')
    .select('auth_user_id')
    .eq('id', session.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!usuario?.auth_user_id) {
    return NextResponse.json({ error: 'Usuario sin cuenta de autenticación vinculada' }, { status: 400 });
  }

  // Change password via Supabase Auth Admin API
  const { error: authError } = await db.auth.admin.updateUserById(
    usuario.auth_user_id,
    { password: password_nuevo },
  );

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
