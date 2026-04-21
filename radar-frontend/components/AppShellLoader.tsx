'use client';

/**
 * AppShellLoader — client wrapper que lee la sesión desde la cookie httpOnly
 * sin necesidad de un layout server-component async.
 *
 * La seguridad real viene del proxy.ts que bloquea las rutas sin sesión.
 * Este componente solo resuelve qué UI mostrar (sidebar visible vs oculto).
 *
 * Estrategia anti-flash:
 *  1. initialSession (from server) = primer render sin flash (camino feliz).
 *  2. useIsomorphicLayoutEffect (síncrono antes del primer paint) lee la companion
 *     cookie cuando initialSession es null — elimina el salto visual post-login.
 *  3. useEffect (async fallback) llama /api/session-pub si la cookie no existe.
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import type { SessionUser } from '@/lib/auth/types';

/** Non-httpOnly companion of matec_session — readable by document.cookie. */
const SESSION_COOKIE_PUB = 'matec_session_pub';

// useLayoutEffect dispara SSR-warning en React. Usar versión isomorfa:
// en el servidor cae a useEffect (no-op visual), en el cliente usa useLayoutEffect
// para garantizar lectura ANTES del primer paint del navegador.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function readSessionFromCookie(): SessionUser | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(SESSION_COOKIE_PUB + '='));
  if (!match) return null;
  try {
    const raw = match.slice(SESSION_COOKIE_PUB.length + 1);
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}

export function AppShellLoader({
  children,
  initialSession = null,
}: {
  children: React.ReactNode;
  initialSession?: SessionUser | null;
}) {
  const [session, setSession] = useState<SessionUser | null>(initialSession);

  // ── Paso 2: lectura síncrona ANTES del primer paint ──────────────────────
  // Corre después de la hidratación pero ANTES de que el navegador pinte.
  // Elimina el flash de "dashboard sin sidebar" cuando el server component
  // no resolvió la sesión (race condition en redirect post-login).
  useIsomorphicLayoutEffect(() => {
    if (session) return;
    const fromCookie = readSessionFromCookie();
    if (fromCookie) setSession(fromCookie);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paso 3: fallback async si la cookie tampoco existe ────────────────────
  useEffect(() => {
    if (session) return;
    fetch('/api/session-pub')
      .then(r => (r.ok ? r.json() : null))
      .then((s: SessionUser | null) => { if (s) setSession(s); })
      .catch(() => {});
  }, [session]);

  return <AppShell session={session}>{children}</AppShell>;
}
