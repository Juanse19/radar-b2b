'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, LayoutGrid, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { WizardState } from '@/lib/comercial/wizard-state';

const LINEAS = [
  { value: 'BHS',            label: 'BHS',           sub: 'Aeropuertos' },
  { value: 'Intralogística', label: 'Intralogística', sub: 'CEDI / WMS' },
  { value: 'Cartón',         label: 'Cartón',         sub: 'Corrugado' },
  { value: 'Final de Línea', label: 'Final de Línea', sub: 'Alimentos / Bebidas' },
  { value: 'Motos',          label: 'Motos',          sub: 'Ensambladoras' },
  { value: 'SOLUMAT',        label: 'Solumat',        sub: 'Plásticos' },
];

const ALL_VALUES = LINEAS.map((l) => l.value);

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step1Target({ state, onChange }: Props) {
  // Multi-line: state.line is comma-separated (e.g. "BHS,Cartón")
  const selectedLines: string[] = state.line
    ? state.line.split(',').filter(Boolean)
    : [];

  const allSelected = ALL_VALUES.every((v) => selectedLines.includes(v));

  function toggleLine(value: string) {
    const next = selectedLines.includes(value)
      ? selectedLines.filter((x) => x !== value)
      : [...selectedLines, value];
    onChange({ line: next.join(',') });
  }

  function selectAll() {
    onChange({ line: ALL_VALUES.join(',') });
  }

  function clearAll() {
    onChange({ line: '' });
  }

  return (
    <div className="space-y-6">
      {/* Líneas */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Línea de negocio</Label>
          <div className="flex items-center gap-3 text-xs">
            {selectedLines.length > 0 && (
              <span className="text-muted-foreground">
                {selectedLines.length} seleccionada{selectedLines.length !== 1 ? 's' : ''}
              </span>
            )}
            {!allSelected && (
              <button
                type="button"
                onClick={selectAll}
                className="flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <LayoutGrid size={12} />
                Todas
              </button>
            )}
            {selectedLines.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {LINEAS.map((l) => {
            const selected = selectedLines.includes(l.value);
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => toggleLine(l.value)}
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
                <span
                  className={cn(
                    'block text-[11px] leading-tight',
                    selected ? 'text-primary/80' : 'text-muted-foreground',
                  )}
                >
                  {l.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* "Todas" shortcut card — shown when nothing selected */}
        {selectedLines.length === 0 && (
          <button
            type="button"
            onClick={selectAll}
            className="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/20 hover:text-foreground transition-all text-center"
          >
            Seleccionar todas las líneas (LATAM completo)
          </button>
        )}
      </div>

      {/* Modo */}
      <div>
        <Label className="mb-2 block">Modo de escaneo</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.mode === 'auto'}
            onClick={() => onChange({ mode: 'auto' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange({ mode: 'auto' });
              }
            }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.mode === 'auto'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.mode === 'auto' && (
              <span
                aria-hidden
                className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Zap size={24} className="mx-auto mb-1 text-primary" />
            <p className={cn('text-sm font-semibold', state.mode === 'auto' && 'text-primary')}>Automático</p>
            <p className="text-xs text-muted-foreground">Seleccionar N empresas</p>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.mode === 'manual'}
            onClick={() => onChange({ mode: 'manual' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange({ mode: 'manual' });
              }
            }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.mode === 'manual'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.mode === 'manual' && (
              <span
                aria-hidden
                className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Target
              size={24}
              className={cn('mx-auto mb-1', state.mode === 'manual' ? 'text-primary' : 'text-foreground')}
            />
            <p className={cn('text-sm font-semibold', state.mode === 'manual' && 'text-primary')}>Manual</p>
            <p className="text-xs text-muted-foreground">Elegir empresas</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
