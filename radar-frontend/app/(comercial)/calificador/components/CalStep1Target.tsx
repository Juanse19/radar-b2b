'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, Check, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';

interface SubLinea {
  value: string;
  label: string;
  sub:   string;
}

interface ParentLinea {
  code:        string;
  label:       string;
  description: string;
  subLineas:   SubLinea[];
}

const PARENT_LINEAS: ParentLinea[] = [
  {
    code:        'BHS',
    label:       'BHS',
    description: 'Aeropuertos y terminales',
    subLineas: [
      { value: 'BHS', label: 'BHS', sub: 'Terminales, carruseles, sorters' },
    ],
  },
  {
    code:        'Intralogística',
    label:       'Intralogística',
    description: 'CEDI, WMS, Supply Chain',
    subLineas: [
      { value: 'Intralogística', label: 'Intralogística', sub: 'CEDI, WMS, ASRS' },
      { value: 'Motos',          label: 'Motos',          sub: 'Ensambladoras' },
    ],
  },
  {
    code:        'Cartón',
    label:       'Cartón',
    description: 'Corrugado, Empaque',
    subLineas: [
      { value: 'Cartón',         label: 'Cartón',         sub: 'Corrugadoras' },
      { value: 'Final de Línea', label: 'Final de Línea', sub: 'Alimentos, Bebidas' },
      { value: 'SOLUMAT',        label: 'Solumat',        sub: 'Plásticos, Materiales' },
    ],
  },
];

/** Reverse-map: given a sub-linea value, find which parent code owns it. */
function parentCodeOf(lineaValue: string): string | null {
  for (const p of PARENT_LINEAS) {
    if (p.subLineas.some(s => s.value === lineaValue)) return p.code;
  }
  return null;
}

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

export function CalStep1Target({ state, onChange }: Props) {
  const selectedParentCode = parentCodeOf(state.linea);
  // expandedParent drives the open sub-panel; defaults to the parent of any already-selected linea
  const [expandedParent, setExpandedParent] = useState<string | null>(selectedParentCode);

  const handleParentClick = (parent: ParentLinea) => {
    if (expandedParent === parent.code) {
      setExpandedParent(null);
      return;
    }
    setExpandedParent(parent.code);
    // Clear selected sub-linea if it doesn't belong to this parent
    if (selectedParentCode !== parent.code) {
      onChange({ linea: '' });
    }
  };

  const handleSubLineaClick = (value: string) => {
    onChange({ linea: value });
  };

  return (
    <div className="space-y-6">
      {/* Línea selector — 2-level: parent → sub-lineas */}
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>
        <div className="space-y-2">
          {PARENT_LINEAS.map((parent) => {
            const isExpanded     = expandedParent === parent.code;
            const isParentActive = selectedParentCode === parent.code;

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
                          onClick={() => handleSubLineaClick(sl.value)}
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
                            {sl.sub}
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
      </div>

      {/* Mode selector */}
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
