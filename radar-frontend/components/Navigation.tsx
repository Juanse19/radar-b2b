'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radar,
  Calendar,
  Table2,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth/types';
import { SidebarUserSection } from '@/components/AppShell';

const navItems = [
  { href: '/',                  label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/scan',              label: 'Escanear',          icon: Radar },
  { href: '/agente-resultados', label: 'Resultados Agente', icon: ClipboardList },
  { href: '/calificacion',      label: 'Calificación',      icon: CheckCircle2 },
  { href: '/results',           label: 'Resultados',        icon: Table2 },
  { href: '/contactos',         label: 'Contactos',         icon: Users },
  { href: '/schedule',          label: 'Cronograma',        icon: Calendar },
];

const adminNavItem = { href: '/admin', label: 'Admin', icon: Shield };

export function Navigation({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = [
    ...navItems,
    ...(session?.role === 'ADMIN' ? [adminNavItem] : []),
  ];

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-screen flex-col justify-between bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0 border-r border-white/8',
        collapsed ? 'w-[72px]' : 'w-[240px] lg:w-[260px]'
      )}
    >
      {/* ── Branding (always visible) ───────────────────────────── */}
      <div className="shrink-0 px-3 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/6 p-3">
          {!collapsed && (
            <div className="min-w-0">
              <Image
                src="/matec-logo.png"
                alt="Matec"
                width={100}
                height={28}
                className="object-contain"
              />
              <p className="mt-1.5 text-xs leading-5 text-white/60">
                Inteligencia Comercial LATAM
              </p>
            </div>
          )}

          {collapsed && (
            <div className="mx-auto flex items-center justify-center">
              <Image
                src="/matec-isotipo.png"
                alt="Matec"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          )}

          <button
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              'rounded-lg border border-white/15 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white shrink-0',
              collapsed && 'mx-auto'
            )}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* ── Nav items (flex-1, scrollable if needed) ──────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        {!collapsed && (
          <p className="px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">
            Navegación
          </p>
        )}

        <nav className="grid gap-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/14 text-white'
                    : 'text-white/65 hover:bg-white/8 hover:text-white',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="ml-3 truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom: user section + system footer (always visible) ── */}
      <div className="shrink-0 flex flex-col gap-2 pb-2">
        <SidebarUserSection session={session} collapsed={collapsed} />

        {/* System footer */}
        <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/5 p-3">
          {!collapsed ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Sistema</p>
              <p className="mt-1 text-xs font-semibold text-white">Matec LATAM</p>
              <p className="text-[11px] text-white/55">v2.0 · 3 Agentes IA</p>
            </>
          ) : (
            <div className="flex justify-center">
              <span className="text-[10px] font-bold text-white/40">M</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
