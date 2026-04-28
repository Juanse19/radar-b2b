'use client';

/**
 * AgentModeTabs — Tabs reusables para los 3 agentes (Escanear/Calificar/Contactos).
 *
 * Cada agente tiene 3 modos:
 *   - Escanear:   [Empresa] [Señales]    [Chat]
 *   - Calificar:  [Empresa] [Automático] [Chat]
 *   - Contactos:  [Empresa] [Masivo]     [Chat]
 *
 * El tab activo se persiste en `?tab=` para preservar deep-links + back/forward.
 * Si el URL no tiene `?tab=`, se usa el primer tab como default.
 */

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AgentTab {
  id:    string;
  label: string;
  icon:  LucideIcon;
  /** Renderizado lazy: la función se llama solo cuando el tab está activo. */
  render: () => ReactNode;
  /** Mensaje opcional para el badge (ej: "v5", "Beta"). */
  badge?: string;
}

interface Props {
  tabs:        AgentTab[];
  /** Tab a mostrar cuando el URL no tiene ?tab= o el valor es inválido. */
  defaultTab?: string;
  /** Nombre del query param (default: 'tab'). Útil si la URL ya lo usa para otra cosa. */
  paramName?:  string;
}

export function AgentModeTabs({ tabs, defaultTab, paramName = 'tab' }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get(paramName);
  const activeId  =
    (requested && tabs.find((t) => t.id === requested)?.id) ??
    defaultTab ??
    tabs[0]?.id ??
    '';
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const onSelect = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === (defaultTab ?? tabs[0]?.id)) {
        params.delete(paramName);
      } else {
        params.set(paramName, id);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, paramName, defaultTab, tabs],
  );

  return (
    <div className="space-y-6">
      <div role="tablist" className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={14} className={cn(isActive && 'text-primary')} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    'ml-1 rounded-full border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide',
                    isActive
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={active?.id}>
        {active?.render()}
      </div>
    </div>
  );
}
