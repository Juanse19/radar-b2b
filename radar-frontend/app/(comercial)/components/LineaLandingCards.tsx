'use client';

import { Plane, Package, Boxes, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMainLineas } from '@/lib/comercial/lineas-config';

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Package,
  Truck: Boxes,
  Boxes,
  Layers,
};

const LINE_ACCENT: Record<string, string> = {
  BHS:           'var(--agent-radar)',
  Cartón:        'var(--agent-calificador)',
  Intralogística: 'var(--agent-contactos)',
};

const LINE_TINT: Record<string, string> = {
  BHS:           'var(--agent-radar-tint)',
  Cartón:        'var(--agent-calificador-tint)',
  Intralogística: 'var(--agent-contactos-tint)',
};

interface Props {
  onSelect:  (linea: string) => void;
  selected?: string;
  title?:    string;
  subtitle?: string;
}

export function LineaLandingCards({ onSelect, selected, title, subtitle }: Props) {
  return (
    <div className="space-y-6">
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {getMainLineas().map((line) => {
          const Icon    = ICON_MAP[line.iconName] ?? Layers;
          const accent  = LINE_ACCENT[line.key];
          const tint    = LINE_TINT[line.key];
          const isActive = selected === line.key;
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => onSelect(line.key)}
              className={cn(
                'group flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
                isActive ? 'shadow-sm' : 'border-border bg-muted/20 hover:bg-muted/40',
              )}
              style={isActive
                ? { borderColor: accent, background: tint }
                : undefined
              }
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: isActive ? tint : undefined, backgroundColor: isActive ? undefined : undefined }}
              >
                <Icon
                  size={18}
                  style={{ color: isActive ? accent : undefined }}
                  className={isActive ? undefined : line.colorClass}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: isActive ? accent : undefined }}
                >
                  {line.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{line.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect('ALL')}
        className={cn(
          'w-full rounded-xl border border-dashed px-4 py-3 text-sm transition-all',
          selected === 'ALL'
            ? 'border-primary/60 bg-primary/10 text-foreground'
            : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/20 hover:text-foreground',
        )}
      >
        Todas las líneas (LATAM completo)
      </button>
    </div>
  );
}
