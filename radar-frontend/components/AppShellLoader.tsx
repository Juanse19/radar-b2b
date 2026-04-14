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

export function AppShellLoader({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  // Read cookie once after hydration — this pattern is intentional.
  // Cookies are a synchronous external store with no native event API,
  // so useEffect is the correct mechanism for a one-time post-mount read.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSession(readSessionFromCookie());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Durante SSR y primer frame: renderiza AppShell sin sesión para evitar
  // flash de layout incorrecto. El proxy garantiza que solo usuarios
  // autenticados llegan aquí.
  return (
    <AppShell session={ready ? session : null}>
      {children}
    </AppShell>
  );
}
