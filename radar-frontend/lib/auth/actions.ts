'use server';
import { redirect } from 'next/navigation';
import { loginSchema } from './schema';
import {
  resolveSessionFromSupabaseUser,
  setAppSession,
  clearSession,
} from './session';
import { createSupabaseServerClient } from '@/lib/db/supabase/server';
import { logActividad } from './audit';

export type AuthActionState = { error?: string; success?: boolean; redirectTo?: string };

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  // ── Dev bypass (solo en NODE_ENV=development) ──────────────────────────────
  if (
    process.env.NODE_ENV === 'development' &&
    parsed.data.email === 'demo@matec.com' &&
    parsed.data.password === 'demo123'
  ) {
    await setAppSession({
      id: 'dev-user-001',
      name: 'Demo Admin',
      email: 'demo@matec.com',
      role: 'ADMIN',
      accessState: 'ACTIVO',
    });
    // NO redirect() here — let the client navigate after the POST completes
    // so Set-Cookie headers are processed before useLayoutEffect fires.
    return { success: true, redirectTo: '/admin' };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return { error: 'Supabase no configurado. Contacta al administrador.' };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      void logActividad(null, 'login', `Intento fallido: ${parsed.data.email}`, 'error', { reason: error.message });
      return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !user.email) {
      return { error: 'No se pudo obtener el usuario autenticado.' };
    }

    const appSession = await resolveSessionFromSupabaseUser({
      authUserId:   user.id,
      email:        user.email,
      nameFallback: user.user_metadata?.name as string | undefined,
    });

    if (!appSession) {
      await supabase.auth.signOut();
      void logActividad(null, 'login', `Usuario no registrado: ${user.email}`, 'warn', { auth_user_id: user.id });
      return { error: 'Tu cuenta no está registrada en el sistema. Solicita acceso al administrador.' };
    }

    if (appSession.accessState !== 'ACTIVO') {
      await supabase.auth.signOut();
      void logActividad(appSession, 'login', `Acceso denegado (estado: ${appSession.accessState})`, 'warn');
      return { error: 'Tu cuenta está pendiente de activación. Contacta al administrador.' };
    }

    await setAppSession(appSession);
    void logActividad(appSession, 'login', `Login exitoso`, 'ok');
  } catch {
    return { error: 'Error de conexión con el servidor. Intenta nuevamente.' };
  }

  // Return success — client navigates after the POST response is fully
  // processed, ensuring Set-Cookie headers are stored before useLayoutEffect.
  return { success: true, redirectTo: '/admin' };
}

export async function logoutAction(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Swallow — we'll clear the session cookie regardless
    }
  }
  await clearSession();
  redirect('/login');
}
