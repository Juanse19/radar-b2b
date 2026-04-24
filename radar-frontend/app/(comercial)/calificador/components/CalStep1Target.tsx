'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';

const LINEAS = [
  { value: 'BHS',            label: 'BHS',           sub: 'Aeropuertos' },
  { value: 'Intralogística', label: 'Intralogística', sub: 'CEDI / WMS' },
  { value: 'Cartón',         label: 'Cartón',         sub: 'Corrugado' },
  { value: 'Final de Línea', label: 'Final de Línea', sub: 'Alimentos / Bebidas' },
  { value: 'Motos',          label: 'Motos',          sub: 'Ensambladoras' },
  { value: 'SOLUMAT',        label: 'Solumat',        sub: 'Plásticos' },
];

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

export function CalStep1Target({ state, onChange }: Props) {
  function selectLinea(value: string) {
    if (state.linea === value) {
      onChange({ linea: '', subLineaId: null });
    } else {
      onChange({ linea: value, subLineaId: null });
    }
  }

  return (
    <div className="space-y-6">
      {/* Línea selector — flat grid of 6 */}
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>
        <div className="grid grid-cols-3 gap-2">
          {LINEAS.map((l) => {
            const selected = state.linea === l.value;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => selectLinea(l.value)}
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
                <span className={cn('block font-medium leading-tight', selected && 'text-primary')}>
                  {l.label}
                </span>
                <span className={cn('block text-[11px] leading-tight', selected ? 'text-primary/80' : 'text-muted-foreground')}>
                  {l.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modo de calificación */}
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
