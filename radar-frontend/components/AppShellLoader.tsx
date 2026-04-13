'use client';

/**
 * AppShellLoader — client wrapper que lee la sesión desde la cookie httpOnly
 * sin necesidad de un layout server-component async.
 *
 * Usa useSyncExternalStore para leer la cookie de forma idiomática en React 18+:
 * - getServerSnapshot devuelve null (SSR / primer frame)
 * - getSnapshot lee la cookie del navegador tras la hidratación
 *
 * La seguridad real viene del proxy.ts que bloquea las rutas sin sesión.
 * Este componente solo resuelve qué UI mostrar (sidebar visible vs oculto).
 */

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/AppShell';
import type { SessionUser } from '@/lib/auth/types';

const SESSION_COOKIE = 'matec_session';

function readSessionFromCookie(): SessionUser | null {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(SESSION_COOKIE + '='));
  if (!match) return null;
  try {
    const raw = match.slice(SESSION_COOKIE.length + 1);
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}

// Cookies have no native event system — subscribe is a no-op.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subscribe(_onStoreChange: () => void) {
  return () => {};
}

export function AppShellLoader({ children }: { children: React.ReactNode }) {
  // SSR/first-frame snapshot is null; client snapshot reads the cookie.
  const session = useSyncExternalStore(
    subscribe,
    readSessionFromCookie,
    () => null,
  );

  return (
    <AppShell session={session}>
      {children}
    </AppShell>
  );
}
