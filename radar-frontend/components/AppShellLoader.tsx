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
 *  2. useIsomorphicLayoutEffect keyed on pathname — se dispara sincrónicamente
 *     ANTES del primer paint en CADA navegación (incluido redirect post-login).
 *     Resuelve el bug donde el effect con [] no volvía a correr cuando el
 *     AppShellLoader ya estaba montado en /login y Next.js hacía client-side
 *     navigation al dashboard sin remontar el root layout.
 *  3. useEffect (async fallback) llama /api/session-pub si la cookie no existe.
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  // ── Paso 2: sincronización por pathname ───────────────────────────────────
  // Corre sincrónicamente ANTES del primer paint en cada navegación.
  // Usar pathname como dep resuelve el caso principal del bug:
  //   /login (session=null) → Server Action login → redirect '/' (client-nav)
  // El root layout ya estaba montado; useState ignora el nuevo initialSession
  // prop del server re-render; sin pathname dep el effect no vuelve a correr.
  // Con pathname dep: al cambiar la ruta se re-lee la cookie → sidebar aparece
  // antes del paint, sin flash visible.
  useIsomorphicLayoutEffect(() => {
    const fromCookie = readSessionFromCookie();
    if (fromCookie) {
      setSession(fromCookie);
    } else if (initialSession) {
      // Server proporcionó session pero cookie aún no está disponible en el
      // cliente (SSR first-paint). Usar initialSession como fallback.
      setSession(initialSession);
    } else {
      // Logout: cookie borrada → limpiar session del estado para ocultar sidebar.
      setSession(null);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paso 3: fallback async ────────────────────────────────────────────────
  // SIEMPRE re-intenta leer la cookie aquí. useEffect corre DESPUÉS del paint,
  // cuando el browser ya procesó los headers Set-Cookie de la respuesta del
  // Server Action. Esto cubre la race condition donde useLayoutEffect disparó
  // antes de que el browser almacenara la cookie (el bug principal).
  // Si la cookie ya está (layoutEffect la encontró), simplemente sobreescribe
  // con el mismo valor — sin flicker, sin efecto visible.
  useEffect(() => {
    const fromCookie = readSessionFromCookie();
    if (fromCookie) {
      setSession(fromCookie);
      return;
    }
    if (session) return;
    // Último recurso: pedir al servidor (requiere SESSION_SECRET configurado)
    fetch('/api/session-pub')
      .then(r => (r.ok ? r.json() : null))
      .then((s: SessionUser | null) => { if (s) setSession(s); })
      .catch(() => {});
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AppShell session={session}>{children}</AppShell>;
}
