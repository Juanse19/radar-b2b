'use client';

/**
 * LineaSelectorCards — selector unificado de líneas + sublíneas.
 *
 * Muestra 4 cards grandes: BHS, Cartón, Intralogística + "Todas".
 * Sublíneas se cargan dinámicamente del DB vía useLineasTree.
 *
 * Reusable en: Escanear (Step1), Señales, Calificar, Contactos, Portafolio.
 *
 * Modo single: una línea seleccionable a la vez.
 * Modo multi:  múltiples líneas seleccionables (excluye 'todas').
 */

import { Plane, Package, Truck, LayoutGrid, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLineasTree, getSubLineasFor } from '@/lib/comercial/useLineasTree';
import { getMainLineas } from '@/lib/comercial/lineas-config';

const ICON_MAP: Record<string, typeof Plane> = {
  Plane,
  Package,
  Truck,
};

interface BaseProps {
  /** Sub-línea actualmente seleccionada (o undefined). */
  sublinea?: string;
  /** Callback cuando cambia la sub-línea. */
  onSublineaChange?: (sub: string | undefined) => void;
  /** Mostrar la card "Todas". Default: true. */
  showAll?: boolean;
  /** Permitir selección múltiple. Default: false. */
  multi?: boolean;
}

interface SingleProps extends BaseProps {
  multi?: false;
  /** '' = ninguna, 'ALL' = todas, o el key de la línea (BHS / Cartón / Intralogística). */
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multi: true;
  /** Array de keys seleccionadas (sin 'ALL'). */
  value: string[];
  onChange: (value: string[]) => void;
}

type Props = SingleProps | MultiProps;

export function LineaSelectorCards(props: Props) {
  const { data: tree } = useLineasTree();
  const mainLineas = getMainLineas();

  const isSelected = (key: string): boolean => {
    if (props.multi) return props.value.includes(key);
    return props.value === key;
  };

  const isAllSelected = !props.multi && props.value === 'ALL';

  function toggle(key: string) {
    if (props.multi) {
      const next = props.value.includes(key)
        ? props.value.filter((k) => k !== key)
        : [...props.value, key];
      props.onChange(next);
    } else {
      props.onChange(props.value === key ? '' : key);
    }
    // Reset sublínea cuando cambia la línea
    props.onSublineaChange?.(undefined);
  }

  function selectAll() {
    if (props.multi) {
      props.onChange(mainLineas.map((l) => l.key));
    } else {
      props.onChange('ALL');
    }
    props.onSublineaChange?.(undefined);
  }

  // Sublíneas a mostrar: solo cuando hay exactamente UNA línea seleccionada (no 'ALL')
  const singleSelected =
    !props.multi && props.value && props.value !== 'ALL'
      ? props.value
      : props.multi && props.value.length === 1
      ? props.value[0]
      : null;

  const sublineas = singleSelected ? getSubLineasFor(tree, singleSelected) : [];

  const allActive = Boolean(
    isAllSelected || (props.multi && props.value.length === mainLineas.length && mainLineas.length > 0),
  );

  return (
    <div className="space-y-4">
      <div className={cn(
        'grid gap-3',
        props.showAll === false ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4',
      )}>
        {mainLineas.map((l) => {
          const Icon = ICON_MAP[l.iconName] ?? Package;
          const selected = isSelected(l.key) && !isAllSelected;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => toggle(l.key)}
              aria-pressed={selected}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all',
                selected
                  ? `${l.borderClass} ${l.bgClass} shadow-lg ring-2 ring-offset-1 ring-offset-background`
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm',
              )}
            >
              {selected && (
                <span className={cn(
                  'absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full',
                  l.bgClass,
                )}>
                  <Check size={12} className={l.colorClass} strokeWidth={3} />
                </span>
              )}
              <Icon
                size={32}
                className={cn(
                  'transition-transform group-hover:scale-110',
                  selected ? l.colorClass : 'text-muted-foreground',
                )}
              />
              <span className={cn(
                'text-sm font-semibold',
                selected ? l.colorClass : 'text-foreground',
              )}>
                {l.label}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground line-clamp-2">
                {l.description}
              </span>
            </button>
          );
        })}

        {props.showAll !== false && (
          <button
            type="button"
            onClick={selectAll}
            aria-pressed={allActive}
            className={cn(
              'group relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-all',
              allActive
                ? 'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/40'
                : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
            )}
          >
            <LayoutGrid
              size={32}
              className={cn(
                'transition-transform group-hover:scale-110',
                allActive ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span className="text-sm font-semibold">Todas</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              LATAM completo · {mainLineas.length} líneas
            </span>
          </button>
        )}
      </div>

      {/* Sub-línea chips — solo visible cuando hay una sola línea seleccionada */}
      {sublineas.length > 0 && props.onSublineaChange && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Sub-línea <span className="font-normal">(opcional)</span>
            </span>
            {props.sublinea && (
              <button
                type="button"
                onClick={() => props.onSublineaChange?.(undefined)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sublineas.map((sub) => {
              const isActive = props.sublinea === sub.value;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => props.onSublineaChange?.(isActive ? undefined : sub.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-all',
                    isActive
                      ? 'border-primary bg-primary/20 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
