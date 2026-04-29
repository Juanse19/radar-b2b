'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';
import { KeywordChips } from '@/app/(comercial)/components/KeywordChips';

const LINEAS = [
  { value: 'BHS',            label: 'BHS',            sub: 'Aeropuertos, Cargo' },
  { value: 'Cartón',         label: 'Cartón',          sub: 'Corrugado' },
  { value: 'Intralogística', label: 'Intralogística',  sub: 'Final de Línea, Motos, Solumat' },
];

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

export function CalStep1Target({ state, onChange }: Props) {
  // Sub-line chips — only shown when a line is selected
  const singleLineSubs: string[] = (() => {
    if (!state.linea) return [];
    const cfg = LINEAS_CONFIG.find(
      (c) => c.key.toLowerCase() === state.linea.toLowerCase(),
    );
    return cfg?.sublineas ?? [];
  })();

  function selectLinea(value: string) {
    if (state.linea === value) {
      onChange({ linea: '', subLineaId: null, sublinea: undefined });
    } else {
      onChange({ linea: value, subLineaId: null, sublinea: undefined });
    }
  }

  // When a line is already set (e.g. pre-selected from landing), show a compact
  // read-only bar instead of the full card grid.
  const lineIsPreset = !!state.linea;

  return (
    <div className="space-y-6">
      {/* Línea selector */}
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>

        {lineIsPreset ? (
          /* Compact read-only line display */
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">{state.linea}</span>
            <button
              type="button"
              onClick={() => onChange({ linea: '', subLineaId: null, sublinea: undefined })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cambiar
            </button>
          </div>
        ) : (
          /* Full card grid */
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
        )}

        {/* Sublínea chips — only when a line is selected */}
        {singleLineSubs.length > 0 && (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Sub-línea <span className="font-normal">(opcional)</span>
              </span>
              {state.sublinea && (
                <button
                  type="button"
                  onClick={() => onChange({ sublinea: undefined })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {singleLineSubs.map((sub) => {
                const isActive = state.sublinea === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => onChange({ sublinea: isActive ? undefined : sub })}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition-all duration-150',
                      isActive
                        ? 'border-primary bg-primary/20 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Keywords for selected line/sublinea */}
        {state.linea && (
          <div className="mt-2">
            <KeywordChips
              linea={state.linea}
              sublinea={state.sublinea}
            />
          </div>
        )}
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
