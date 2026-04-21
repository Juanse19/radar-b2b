// app/api/admin/usuarios/route.ts
//
// GET  /api/admin/usuarios?page=1&limit=10  — paginated list of users
// POST /api/admin/usuarios                  — create user in Supabase Auth + public.usuarios
//
// Protected: only ADMIN role. Uses service-role client to bypass RLS.
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
  const offset = (page - 1) * limit;

  try {
    const db = getAdminDb();
    const { data, error, count } = await db
      .from('usuarios')
      .select('id, nombre, email, rol, estado_acceso, created_at, aprobado_en, daily_token_limit, weekly_token_limit', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      usuarios:   data ?? [],
      total:      count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], usuarios: [], total: 0, page, totalPages: 0, _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
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

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}
