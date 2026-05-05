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

  try {
    const db = getAdminDb();

    // Fetch user record from the usuarios table
    const { data: usuario, error: fetchError } = await db
      .from('usuarios')
      .select('auth_user_id, email, nombre')
      .eq('id', id)
      .single();

    if (fetchError || !usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    let authUserId: string | null = usuario.auth_user_id ?? null;

    // If auth_user_id is missing or stale, resolve via email from Supabase Auth list
    if (!authUserId && usuario.email) {
      const { data: { users }, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
      if (!listError) {
        const match = users.find((u) => u.email === usuario.email);
        if (match) authUserId = match.id;
      }
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'El usuario no tiene cuenta de autenticación asociada. Contacta al administrador.' },
        { status: 422 },
      );
    }

    // Change password via Supabase Auth Admin API
    const { error: authError } = await db.auth.admin.updateUserById(authUserId, { password });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Keep auth_user_id in sync if it was missing
    if (!usuario.auth_user_id) {
      await db.from('usuarios').update({ auth_user_id: authUserId }).eq('id', id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { error: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}
