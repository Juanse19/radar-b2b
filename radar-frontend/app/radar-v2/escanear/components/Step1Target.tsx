'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target } from 'lucide-react';
import type { WizardState } from '@/lib/radar-v2/wizard-state';

const LINEAS = [
  { value: 'BHS',             label: 'BHS — Aeropuertos' },
  { value: 'Intralogística',  label: 'Intralogística — CEDI' },
  { value: 'Cartón',          label: 'Cartón Corrugado' },
  { value: 'Final de Línea',  label: 'Final de Línea' },
  { value: 'Motos',           label: 'Motos / Ensambladoras' },
  { value: 'SOLUMAT',         label: 'Solumat — Plásticos' },
];

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step1Target({ state, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LINEAS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => onChange({ line: l.value })}
              aria-pressed={state.line === l.value}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                state.line === l.value
                  ? 'border-primary bg-primary/20 font-semibold shadow-sm ring-2 ring-primary/30'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Modo de escaneo</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.mode === 'auto'}
            onClick={() => onChange({ mode: 'auto' })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ mode: 'auto' }); } }}
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
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ mode: 'manual' }); } }}
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
