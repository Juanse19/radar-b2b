'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { RunningExecutionsTray } from '@/components/tracker/RunningExecutionsTray';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth/types';
import { logoutAction } from '@/lib/auth/actions';

/**
 * Client wrapper that owns the mobile-drawer state for the sidebar.
 *
 * Layout breakpoints:
 *   <md  (≤767px)   Sidebar is hidden off-canvas, top bar with hamburger.
 *   md+  (≥768px)   Sidebar is visible inline, top bar hidden.
 *
 * The drawer auto-closes whenever the route changes so navigation feels native.
 */
export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionUser | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cerrar el drawer automáticamente al navegar.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloquear el scroll del body mientras el drawer está abierto.
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [mobileOpen]);

  // No session → render only the main content area (login page, public routes)
  if (!session) {
    return (
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Sidebar — desktop inline, mobile off-canvas drawer ─────────────── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-full transform transition-transform duration-300 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Navigation session={session} />
      </div>

      {/* ── Backdrop solo en mobile cuando el drawer está abierto ──────────── */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ── Contenido principal — columna vertical que ocupa el viewport ───── */}
      <div className="flex h-screen flex-1 flex-col min-w-0">
        {/* Top bar — visible solo en mobile (altura fija, no hace scroll) */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex min-w-0 flex-col items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              MATEC
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              Radar B2B
            </span>
          </div>
        </header>

        {/*
          <main> es el contenedor de scroll interno.
          - flex-1 + min-h-0  →  permite que encoja por debajo del contenido (truco flexbox)
          - overflow-y-auto   →  scroll vertical interno (fuera del document, como manda globals.css)
          - overflow-x-hidden →  evita scroll horizontal accidental
        */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 md:p-6">
          {children}
        </main>
      </div>

      {/* Global tracker — appears bottom-right whenever any agent is running
          or has finished within the last 10 minutes. See `useInflightExecutions`. */}
      <RunningExecutionsTray />
    </div>
  );
}

/**
 * Role badge variant colors.
 * Exported so Navigation can reuse.
 */
export const roleBadgeClass: Record<string, string> = {
  ADMIN:       'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  COMERCIAL: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  AUXILIAR:    'bg-white/10 text-white/55 border border-white/15',
};

/**
 * User section rendered at the bottom of the sidebar.
 * Receives `session` from AppShell (already passed down via Navigation).
 */
export function SidebarUserSection({
  session,
  collapsed,
}: {
  session: SessionUser | null;
  collapsed: boolean;
}) {
  if (!session) return null;

  // Derive initials from first two words of the name
  const initials = session.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const badgeClass = roleBadgeClass[session.role] ?? roleBadgeClass.AUXILIAR;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
      {collapsed ? (
        /* Collapsed: show only avatar */
        <div className="flex justify-center">
          <div
            aria-label={session.name}
            title={session.name}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/30 text-xs font-bold text-white"
          >
            {initials}
          </div>
        </div>
      ) : (
        /* Expanded: show full user info + logout */
        <div className="flex flex-col gap-2">
          {/* Avatar + name row */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/30 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white leading-tight">
                {session.name}
              </p>
              <span
                className={cn(
                  'mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none',
                  badgeClass,
                )}
              >
                {session.role}
              </span>
            </div>
          </div>

          {/* Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

