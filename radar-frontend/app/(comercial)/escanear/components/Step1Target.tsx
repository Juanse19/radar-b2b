'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { WizardState } from '@/lib/comercial/wizard-state';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';
import { LineaLandingCards } from '@/app/(comercial)/components/LineaLandingCards';

interface Props {
  state:     WizardState;
  onChange:  (updates: Partial<WizardState>) => void;
  agentMode?: 'empresa' | 'signals';
}

export function Step1Target({ state, onChange, agentMode = 'empresa' }: Props) {
  // Multi-line: state.line is comma-separated (e.g. "BHS,Cartón")
  const selectedLines: string[] = state.line
    ? state.line.split(',').filter(Boolean)
    : [];

  const lineIsSet = selectedLines.length > 0;

  function toggleSublinea(sub: string) {
    const current = state.sublineas ?? [];
    const next = current.includes(sub)
      ? current.filter((s) => s !== sub)
      : [...current, sub];
    onChange({ sublineas: next });
  }

  function clearSublineas() {
    onChange({ sublineas: [] });
  }

  // Sublínea chips — only shown when exactly 1 line is selected
  const singleLineSubs: string[] = (() => {
    if (selectedLines.length !== 1) return [];
    const cfg = LINEAS_CONFIG.find(
      (c) => c.key.toLowerCase() === selectedLines[0]!.toLowerCase(),
    );
    return cfg?.sublineas ?? [];
  })();

  // ── Empty state: no line selected ──────────────────────────────────────────
  if (!lineIsSet) {
    return (
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">Línea de negocio</Label>
          <LineaLandingCards
            onSelect={(linea) => onChange({ line: linea, sublinea: undefined })}
          />
        </div>
      </div>
    );
  }

  // ── Line selected: compact bar + sub-líneas + mode ─────────────────────────
  const lineLabel = selectedLines.length === 1
    ? (LINEAS_CONFIG.find((c) => c.key === selectedLines[0])?.label ?? selectedLines[0])
    : selectedLines.length > 1
      ? selectedLines.join(', ')
      : 'Todas las líneas';

  return (
    <div className="space-y-6">
      {/* ── Compact line bar ── */}
      <div>
        <Label className="mb-2 block">Línea de negocio</Label>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{lineLabel}</span>
          <button
            type="button"
            onClick={() => onChange({ line: '', sublinea: undefined })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cambiar
          </button>
        </div>
      </div>

      {/* Sub-línea chips — multi-select cuando hay 1 línea seleccionada */}
      {singleLineSubs.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Sub-líneas <span className="font-normal">(opcional · multi-select)</span>
              {(state.sublineas?.length ?? 0) > 0 && (
                <span className="ml-2 text-foreground">
                  {state.sublineas.length} seleccionada{state.sublineas.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            {(state.sublineas?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={clearSublineas}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {singleLineSubs.map((sub) => {
              const isActive = (state.sublineas ?? []).includes(sub);
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSublinea(sub)}
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

      {/* Modo — hidden in signals mode (no company selection needed) */}
      {agentMode !== 'signals' && (
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
              <p className={cn('text-sm font-semibold', state.mode === 'auto' && 'text-primary')}>
                Automático
              </p>
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
              <p className={cn('text-sm font-semibold', state.mode === 'manual' && 'text-primary')}>
                Manual
              </p>
              <p className="text-xs text-muted-foreground">Elegir empresas</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
