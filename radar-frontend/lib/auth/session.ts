'server-only';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/db/supabase/server';
import { pgFirst, pgQuery, pgLit } from '@/lib/db/supabase/pg_client';
import type { SessionUser, UserRole, AccessState } from './types';

// Row type returned by pgFirst queries on matec_radar.usuarios
interface UsuarioRow {
  id:            string;
  nombre:        string | null;
  email:         string | null;
  rol:           string | null;
  estado_acceso: string | null;
}

interface AppSessionData {
  user?: SessionUser;
}

const SESSION_COOKIE = 'matec_session';
/** Non-httpOnly companion cookie — readable by document.cookie for UI rendering.
 *  Security is unaffected: all server-side auth uses SESSION_COOKIE (signed httpOnly). */
const SESSION_COOKIE_PUB = 'matec_session_pub';
const MAX_AGE = 60 * 60 * 8; // 8 hours

function getSessionOptions() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET env var must be set to at least 32 characters');
  }
  return {
    cookieName: SESSION_COOKIE,
    password,
    cookieOptions: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path:     '/',
      maxAge:   MAX_AGE,
    },
  };
}

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
  const ironSession = await getIronSession<AppSessionData>(store, getSessionOptions());
  ironSession.user = session;
  await ironSession.save();

  // Non-httpOnly companion so AppShellLoader can read it via document.cookie.
  store.set(SESSION_COOKIE_PUB, JSON.stringify(session), {
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   MAX_AGE,
    httpOnly: false,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(SESSION_COOKIE_PUB);
}

export async function resolveSessionFromSupabaseUser(input: {
  authUserId: string;
  email: string;
  nameFallback?: string;
}): Promise<SessionUser | null> {
  // Use pgFirst (direct /pg/query HTTP, bypasses PostgREST PGRST_DB_SCHEMAS restriction)
  const S = 'matec_radar';

  // Try by auth_user_id first
  let row = await pgFirst<UsuarioRow>(
    `SELECT id, nombre, email, rol, estado_acceso
     FROM ${S}.usuarios
     WHERE auth_user_id = ${pgLit(input.authUserId)}
     LIMIT 1`
  );

  // Fallback: try by email and backfill auth_user_id
  if (!row) {
    row = await pgFirst<UsuarioRow>(
      `SELECT id, nombre, email, rol, estado_acceso
       FROM ${S}.usuarios
       WHERE email = ${pgLit(input.email)}
       LIMIT 1`
    );

    if (row) {
      // Link this auth identity to the existing user row
      await pgQuery(
        `UPDATE ${S}.usuarios
         SET auth_user_id = ${pgLit(input.authUserId)}, updated_at = now()
         WHERE id = ${pgLit(row.id)} AND auth_user_id IS NULL`
      ).catch(err => {
        // Non-fatal: may already be linked or column may be missing temporarily
        console.warn('[auth] backfill auth_user_id failed:', err instanceof Error ? err.message : err);
      });
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

  try {
    const ironSession = await getIronSession<AppSessionData>(store, getSessionOptions());
    if (ironSession.user) {
      const u = ironSession.user;
      return { ...u, role: normalizeRole(u.role) };
    }
  } catch {
    // Malformed or tampered cookie — fall through to Supabase validation
  }

  // No valid signed session — try Supabase auth
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
