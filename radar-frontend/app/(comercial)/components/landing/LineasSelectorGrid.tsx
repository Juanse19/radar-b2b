'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plane,
  Package,
  Truck,
  Boxes,
  Bike,
  Layers,
  Zap,
  Target,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LINEAS_CONFIG, type LineaNegocioConfig } from '@/lib/comercial/lineas-config';

const ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Package,
  Truck,
  Boxes,
  Bike,
  Layers,
  Zap,
  Target,
};

const MAX_VISIBLE_SUBLINEAS = 3;

interface Props {
  counts: Record<string, number>;
}

function LineaCard({
  config,
  count,
  selected,
  onToggle,
}: {
  config: LineaNegocioConfig;
  count: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = ICON_MAP[config.iconName] ?? Zap;
  const visibleSubs = config.sublineas.slice(0, MAX_VISIBLE_SUBLINEAS);
  const hiddenCount = config.sublineas.length - MAX_VISIBLE_SUBLINEAS;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-150',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? cn('border-2 bg-background/60', config.borderClass)
          : 'border-border bg-background/40 hover:border-primary/40',
      )}
      aria-pressed={selected}
      aria-label={`${selected ? 'Deseleccionar' : 'Seleccionar'} ${config.label}`}
    >
      {/* Checkmark badge — top right */}
      {selected && (
        <span
          className={cn(
            'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full',
            config.bgClass,
            config.colorClass,
          )}
          aria-hidden
        >
          <CheckCircle2 size={14} />
        </span>
      )}

      {/* Icon + name */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            config.bgClass,
            config.colorClass,
          )}
          aria-hidden
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{config.label}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* Sublíneas chips + count */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {visibleSubs.map((sub) => (
            <span
              key={sub}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-tight text-muted-foreground"
            >
              {sub}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-tight text-muted-foreground">
              +{hiddenCount}
            </span>
          )}
        </div>
        {count > 0 && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight',
              config.bgClass,
              config.colorClass,
            )}
          >
            {count} empresas
          </span>
        )}
      </div>
    </button>
  );
}

export function LineasSelectorGrid({ counts }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allKeys = LINEAS_CONFIG.map((l) => l.key);
  const allSelected = allKeys.every((k) => selected.has(k));

  function toggleLinea(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allKeys));
    }
  }

  function buildLineasParam() {
    return [...selected].join(',');
  }

  function handleAuto() {
    if (selected.size === 0) return;
    router.push(`/escanear?lineas=${buildLineasParam()}&mode=auto&step=1`);
  }

  function handleManual() {
    if (selected.size === 0) return;
    router.push(`/escanear?lineas=${buildLineasParam()}&mode=manual&step=2`);
  }

  const noneSelected = selected.size === 0;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selecciona las líneas a escanear
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allSelected ? 'Ninguna' : 'Seleccionar todas'}
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {LINEAS_CONFIG.map((linea) => (
          <LineaCard
            key={linea.key}
            config={linea}
            count={counts[linea.key] ?? 0}
            selected={selected.has(linea.key)}
            onToggle={() => toggleLinea(linea.key)}
          />
        ))}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={handleAuto}
          disabled={noneSelected}
          title={noneSelected ? 'Selecciona al menos una línea' : undefined}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all',
            noneSelected
              ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
              : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]',
          )}
        >
          <Zap size={16} />
          Escaneo Automático
          {!noneSelected && (
            <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold">
              {selected.size}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleManual}
          disabled={noneSelected}
          title={noneSelected ? 'Selecciona al menos una línea' : undefined}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all',
            noneSelected
              ? 'cursor-not-allowed border-border text-muted-foreground opacity-50'
              : 'border-border text-foreground hover:border-primary hover:text-primary active:scale-[0.98]',
          )}
        >
          <Target size={16} />
          Selección Manual
        </button>
      </div>
    </div>
  );
}
