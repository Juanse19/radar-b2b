'use client';

import { Plane, Package, Truck, Boxes, Bike, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Package,
  Truck,
  Boxes,
  Bike,
  Layers,
};

interface Props {
  onSelect: (linea: string) => void;
  title?: string;
  subtitle?: string;
}

export function LineaLandingCards({ onSelect, title, subtitle }: Props) {
  return (
    <div className="space-y-6">
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LINEAS_CONFIG.map((line) => {
          const Icon = ICON_MAP[line.iconName] ?? Layers;
          return (
            <button
              key={line.key}
              type="button"
              onClick={() => onSelect(line.key)}
              className={cn(
                'group flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
                'border-border bg-muted/20 hover:bg-muted/40',
                `hover:${line.borderClass}`,
              )}
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', line.bgClass)}>
                <Icon size={18} className={line.colorClass} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{line.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{line.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect('ALL')}
        className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/20 hover:text-foreground"
      >
        Todas las líneas (LATAM completo)
      </button>
    </div>
  );
}
