'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radar,
  Calendar,
  Table2,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  Signal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/scan',      label: 'Escanear',    icon: Radar },
  { href: '/schedule',  label: 'Cronograma',  icon: Calendar },
  { href: '/results',   label: 'Resultados',  icon: Table2 },
  { href: '/empresas',  label: 'Empresas',    icon: Building2 },
  { href: '/contactos', label: 'Contactos',   icon: Users },
];

export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Header / Branding */}
      <div className="space-y-5 px-3 pt-4">
        <div className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/6 p-3">
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
                MATEC
              </p>
              <h1 className="page-heading mt-1 text-xl font-semibold text-white leading-tight">
                Radar B2B
              </h1>
              <p className="mt-1.5 text-xs leading-5 text-white/60">
                Inteligencia Comercial LATAM
              </p>
            </div>
          )}

          {/* Ícono cuando está colapsado */}
          {collapsed && (
            <div className="mx-auto">
              <Signal size={22} className="text-sidebar-primary" />
            </div>
          )}

          {/* Botón colapsar/expandir */}
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

        {/* Navegación */}
        <nav className="grid gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
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
                  'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
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

      {/* Footer */}
      <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
        {!collapsed ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Sistema</p>
            <p className="mt-1 text-xs font-semibold text-white">Matec LATAM</p>
            <p className="text-[11px] text-white/55">v2.0 · Agentes IA</p>
          </>
        ) : (
          <div className="flex justify-center">
            <span className="text-[10px] font-bold text-white/40">M</span>
          </div>
        )}
      </div>
    </aside>
  );
}
