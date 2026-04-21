'use client';

/**
 * AppShellLoader — client wrapper que lee la sesión desde la cookie httpOnly
 * sin necesidad de un layout server-component async.
 *
 * Esto elimina el Suspense boundary del layout que causaba que todas las
 * páginas quedaran en estado "Cargando..." indefinidamente en Next.js 16.
 *
 * La seguridad real viene del proxy.ts que bloquea las rutas sin sesión.
 * Este componente solo resuelve qué UI mostrar (sidebar visible vs oculto).
 */

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import type { SessionUser } from '@/lib/auth/types';

/** Non-httpOnly companion of matec_session — readable by document.cookie. */
const SESSION_COOKIE_PUB = 'matec_session_pub';

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
  // Seed with the server-resolved session so SSR already renders the sidebar.
  // Eliminates the post-login "empty dashboard" flash.
  const [session, setSession] = useState<SessionUser | null>(initialSession);

  // Fallback for edge cases where the server couldn't resolve the session
  // but the non-httpOnly companion cookie is available client-side
  // (e.g. after /api/dev-login without a full page reload).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (session) return;
    const fromCookie = readSessionFromCookie();
    if (fromCookie) {
      setSession(fromCookie);
      return;
    }
    fetch('/api/session-pub')
      .then(r => (r.ok ? r.json() : null))
      .then((s: SessionUser | null) => { if (s) setSession(s); })
      .catch(() => {});
  }, [session]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return <AppShell session={session}>{children}</AppShell>;
}
