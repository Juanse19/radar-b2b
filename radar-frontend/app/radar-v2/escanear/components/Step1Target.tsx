'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, LayoutGrid } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { WizardState } from '@/lib/radar-v2/wizard-state';

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
                  'rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-200',
                  selected
                    ? 'border-primary bg-primary/15 font-semibold ring-1 ring-primary/50 shadow-sm'
                    : 'border-border bg-muted/30 hover:border-primary/50',
                )}
              >
                <span className="block font-medium leading-tight">{l.label}</span>
                <span
                  className={cn(
                    'block text-[11px] leading-tight',
                    selected ? 'text-primary/70' : 'text-muted-foreground',
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
              'cursor-pointer p-4 text-center transition-all',
              state.mode === 'auto'
                ? 'border-primary bg-primary/15 shadow-md ring-2 ring-primary/40'
                : 'hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <Zap size={24} className="mx-auto mb-1 text-primary" />
            <p className="text-sm font-semibold">Automático</p>
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
              'cursor-pointer p-4 text-center transition-all',
              state.mode === 'manual'
                ? 'border-primary bg-primary/15 shadow-md ring-2 ring-primary/40'
                : 'hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <Target size={24} className="mx-auto mb-1 text-foreground" />
            <p className="text-sm font-semibold">Manual</p>
            <p className="text-xs text-muted-foreground">Elegir empresas</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
