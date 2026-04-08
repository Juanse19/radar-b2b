'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/db/supabase/server';
import { getAdminDb } from '@/lib/db/supabase/admin';
import type { SessionUser, UserRole, AccessState } from './types';

const SESSION_COOKIE = 'matec_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours

function normalizeRole(role?: string | null): UserRole {
  if (role === 'ADMIN' || role === 'COMERCIAL' || role === 'AUXILIAR') return role;
  return 'AUXILIAR';
}

function normalizeAccessState(state?: string | null): AccessState {
  if (state === 'ACTIVO' || state === 'PENDIENTE' || state === 'INACTIVO') return state;
  return 'PENDIENTE';
}

export async function setAppSession(session: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function resolveSessionFromSupabaseUser(input: {
  authUserId: string;
  email: string;
  nameFallback?: string;
}): Promise<SessionUser | null> {
  const admin = getAdminDb();

  // Try by auth_user_id first
  const { data: byAuth } = await admin
    .from('usuarios')
    .select('id, nombre, email, rol, estado_acceso')
    .eq('auth_user_id', input.authUserId)
    .maybeSingle();

  let row = byAuth as {
    id: string;
    nombre: string | null;
    email: string | null;
    rol: string | null;
    estado_acceso: string | null;
  } | null;

  // Fallback: try by email and link the auth_user_id
  if (!row) {
    const { data: byEmail } = await admin
      .from('usuarios')
      .select('id, nombre, email, rol, estado_acceso')
      .eq('email', input.email)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row = byEmail as any;

    if (row) {
      await admin
        .from('usuarios')
        .update({ auth_user_id: input.authUserId })
        .eq('id', (row as { id: string }).id);
    }
  }

  if (!row) return null;

  return {
    id:          String(row.id),
    name:        row.nombre ?? input.nameFallback ?? input.email,
    email:       row.email  ?? input.email,
    role:        normalizeRole(row.rol),
    accessState: normalizeAccessState(row.estado_acceso),
  };
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE);

  if (cookie?.value) {
    try {
      const parsed = JSON.parse(cookie.value) as SessionUser;
      return { ...parsed, role: normalizeRole(parsed.role) };
    } catch {
      // invalid cookie — continue to Supabase validation
    }
  }

  // No cookie or invalid — try Supabase auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !user.email) return null;

    const session = await resolveSessionFromSupabaseUser({
      authUserId:   user.id,
      email:        user.email,
      nameFallback: user.user_metadata?.name as string | undefined,
    });

    if (session) await setAppSession(session);
    return session;
  } catch {
    return null;
  }
}

export async function ensureSession(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  return session;
}

export async function ensureAdmin(): Promise<SessionUser> {
  const session = await ensureSession();
  if (session.role !== 'ADMIN') redirect('/sin-acceso');
  return session;
}
