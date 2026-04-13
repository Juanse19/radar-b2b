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
  Activity,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/',          label: 'Dashboard',   icon: LayoutDashboard, desc: 'KPIs y señales ORO' },
  { href: '/scan',      label: 'Escanear',    icon: Radar,           desc: 'Lanzar agentes IA' },
  { href: '/agente-resultados', label: 'Resultados Agente', icon: ClipboardList, desc: 'Datos directos del agente' },
  { href: '/results',   label: 'Resultados',  icon: Table2,          desc: 'Señales detectadas' },
  { href: '/empresas',  label: 'Empresas',    icon: Building2,       desc: 'Base de datos' },
  { href: '/contactos', label: 'Contactos',   icon: Users,           desc: 'Prospectos Apollo' },
  { href: '/schedule',  label: 'Cronograma',  icon: Calendar,        desc: 'Scans automáticos' },
];

export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0 border-r border-white/8',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Header / Branding */}
      <div className="px-3 pt-4 pb-2">
        <div className={cn(
          'flex items-center rounded-xl border border-white/12 bg-white/5 p-3 gap-3',
          collapsed && 'justify-center'
        )}>
          {/* Logo mark */}
          <div className="shrink-0 w-8 h-8 rounded-lg bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center">
            <Signal size={16} className="text-sidebar-primary" />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/40">
                Matec S.A.S.
              </p>
              <h1 className="page-heading text-[15px] font-semibold text-white leading-tight mt-0.5">
                Radar B2B
              </h1>
            </div>
          )}

          {/* Toggle button */}
          <button
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              'rounded-lg border border-white/15 p-1 text-white/50 transition hover:bg-white/10 hover:text-white shrink-0',
              collapsed && 'mt-0 mx-auto'
            )}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pb-1.5 pt-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">Navegación</p>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-0.5">
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
                'group flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-primary/15 text-white shadow-sm'
                  : 'text-white/55 hover:bg-white/7 hover:text-white/90',
                collapsed && 'justify-center px-2'
              )}
            >
              {/* Active indicator bar */}
              {active && !collapsed && (
                <span className="absolute left-0 w-0.5 h-5 bg-sidebar-primary rounded-r-full" />
              )}
              <Icon
                size={17}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-sidebar-primary' : 'text-white/45 group-hover:text-white/70'
                )}
              />
              {!collapsed && (
                <span className="ml-2.5 truncate">{label}</span>
              )}
              {/* Active dot when collapsed */}
              {active && collapsed && (
                <span className="absolute right-1.5 top-1.5 w-1 h-1 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mx-2 mb-3 mt-2 rounded-xl border border-white/8 bg-white/4 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <Activity size={12} className="text-sidebar-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/80 leading-tight">3 Agentes IA</p>
              <p className="text-[10px] text-white/40">v2.0 · LATAM</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Activity size={14} className="text-sidebar-primary/60" />
          </div>
        )}
      </div>
    </aside>
  );
}
