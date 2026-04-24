'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, Check, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';
import type { ParentLineaItem } from '@/app/api/comercial/lineas-tree/route';

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

/** Returns the parent whose subLineas contains the given value, or null. */
function findParentCode(tree: ParentLineaItem[], lineaValue: string): string | null {
  for (const p of tree) {
    if (p.subLineas.some(s => s.value === lineaValue)) return p.code;
  }
  return null;
}

export function CalStep1Target({ state, onChange }: Props) {
  const [tree,    setTree]    = useState<ParentLineaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // expandedParent is derived from state.linea once the tree is loaded,
  // then driven by user clicks.
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/comercial/lineas-tree')
      .then(r => r.json())
      .then((data: ParentLineaItem[]) => {
        if (cancelled) return;
        setTree(data);
        // Re-open the parent of the already-selected linea (back-navigation).
        if (state.linea) {
          const code = findParentCode(data, state.linea);
          if (code) setExpandedParent(code);
        }
      })
      .catch(() => {
        // Network failure — tree stays empty, loading clears.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // Run once on mount — intentionally no deps on state.linea to avoid re-fetching on selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleParentClick = (parent: ParentLineaItem) => {
    if (expandedParent === parent.code) {
      setExpandedParent(null);
      return;
    }

    setExpandedParent(parent.code);

    // Clear sub-linea selection when switching to a different parent.
    const currentParent = findParentCode(tree, state.linea);
    if (currentParent !== parent.code) {
      onChange({ linea: '', subLineaId: null });
    }

    // Auto-select when the parent has exactly one sub-linea.
    if (parent.subLineas.length === 1) {
      const sl = parent.subLineas[0];
      onChange({ linea: sl.value, subLineaId: sl.id ?? null });
    }
  };

  const handleSubLineaClick = (parent: ParentLineaItem, slValue: string, slId: number | null) => {
    // If clicking the already-selected sub-linea, deselect it.
    if (state.linea === slValue) {
      onChange({ linea: '', subLineaId: null });
      return;
    }
    // Clear linea first if parent differs (edge-case guard).
    const currentParent = findParentCode(tree, state.linea);
    if (currentParent !== parent.code) {
      onChange({ linea: '', subLineaId: null });
    }
    onChange({ linea: slValue, subLineaId: slId ?? null });
  };

  return (
    <div className="space-y-6">
      {/* Línea selector — 2-level: parent → sub-lineas */}
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>

        {loading ? (
          /* Loading skeleton — 3 placeholder cards */
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-[52px] animate-pulse rounded-lg border-2 border-border bg-muted/30"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {tree.map((parent) => {
              const isExpanded     = expandedParent === parent.code;
              const selectedParent = findParentCode(tree, state.linea);
              const isParentActive = selectedParent === parent.code;

              return (
                <div key={parent.code}>
                  {/* Parent card */}
                  <button
                    type="button"
                    onClick={() => handleParentClick(parent)}
                    aria-expanded={isExpanded}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all duration-200',
                      isParentActive
                        ? 'border-primary bg-primary/10 font-semibold'
                        : isExpanded
                          ? 'border-primary/50 bg-muted/30'
                          : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <div>
                      <span className={cn('block text-sm font-semibold leading-tight', isParentActive && 'text-primary')}>
                        {parent.label}
                      </span>
                      <span className={cn('block text-[11px] leading-tight', isParentActive ? 'text-primary/80' : 'text-muted-foreground')}>
                        {parent.description}
                      </span>
                    </div>
                    <ChevronRight
                      size={16}
                      className={cn(
                        'shrink-0 text-muted-foreground transition-transform duration-200',
                        isExpanded && 'rotate-90',
                      )}
                    />
                  </button>

                  {/* Sub-lineas — visible when parent is expanded */}
                  {isExpanded && (
                    <div className="ml-4 mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {parent.subLineas.map((sl) => {
                        const selected = state.linea === sl.value;
                        return (
                          <button
                            key={sl.value}
                            type="button"
                            onClick={() => handleSubLineaClick(parent, sl.value, sl.id)}
                            aria-pressed={selected}
                            className={cn(
                              'relative rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all duration-200',
                              selected
                                ? 'border-primary bg-primary/30 font-semibold ring-2 ring-primary shadow-lg shadow-primary/20'
                                : 'border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50',
                            )}
                          >
                            {selected && (
                              <span
                                aria-hidden
                                className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                              >
                                <Check size={10} strokeWidth={3} />
                              </span>
                            )}
                            <span className={cn('block font-medium leading-tight text-xs', selected && 'text-primary')}>
                              {sl.label}
                            </span>
                            <span className={cn('block text-[10px] leading-tight', selected ? 'text-primary/80' : 'text-muted-foreground')}>
                              {sl.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mode selector — unchanged */}
      <div>
        <Label className="mb-2 block">Modo de calificación</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'auto',   icon: Zap,    label: 'Automático', sub: 'Seleccionar N empresas' },
            { value: 'manual', icon: Target, label: 'Manual',     sub: 'Elegir empresas' },
          ].map(({ value, icon: Icon, label, sub }) => {
            const selected = state.mode === value;
            return (
              <Card
                key={value}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => onChange({ mode: value as 'auto' | 'manual' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ mode: value as 'auto' | 'manual' });
                  }
                }}
                className={cn(
                  'relative cursor-pointer border-2 p-4 text-center transition-all',
                  selected
                    ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                    : 'border-border hover:border-primary/60 hover:bg-muted/40',
                )}
              >
                {selected && (
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <Icon size={24} className={cn('mx-auto mb-1', selected ? 'text-primary' : 'text-foreground')} />
                <p className={cn('text-sm font-semibold', selected && 'text-primary')}>{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
