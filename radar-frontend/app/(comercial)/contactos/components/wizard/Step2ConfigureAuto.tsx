'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, RefreshCw } from 'lucide-react';
import { JobTitleEditor } from './JobTitleEditor';
import { getDefaultTitles } from '@/lib/apollo/job-titles';
import type { ProspectorWizardState, Tier, EmpresaTarget } from './state';

interface Props {
  state:    ProspectorWizardState;
  onChange: (updates: Partial<ProspectorWizardState>) => void;
}

const ACCENT = 'var(--agent-contactos)';

const TIER_OPTIONS: Array<{ value: Tier; label: string; description: string }> = [
  { value: 'A-ORO',         label: 'A · ORO',     description: 'Máxima prioridad' },
  { value: 'A',             label: 'Tier A',      description: 'Alta prioridad' },
  { value: 'B',             label: 'Tier B',      description: 'Media prioridad' },
  { value: 'C',             label: 'Tier C',      description: 'Baja prioridad' },
  { value: 'sin_calificar', label: 'Sin calificar', description: 'Aún sin tier asignado' },
];

interface AutoSelectEmpresaRow {
  id:               number;
  nombre:           string;
  dominio:          string | null;
  pais:             string | null;
  tier:             string;
  sub_linea_id:     number | null;
  sub_linea_codigo: string | null;
}

export function Step2ConfigureAuto({ state, onChange }: Props) {
  const [picks,    setPicks]    = useState<EmpresaTarget[]>(state.empresas);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const tiersKey = state.tiers.join(',');
  const sublineasKey = state.sublineaIds.join(',');
  const countKey = state.count;

  // Cargar selección automática de empresas
  async function fetchAutoSelection() {
    if (state.sublineaIds.length === 0) {
      setError('Selecciona al menos una sub-línea en el paso anterior');
      return;
    }
    if (state.tiers.length === 0) {
      setError('Selecciona al menos un tier');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prospector/v2/auto-select', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sublineaIds: state.sublineaIds,
          tiers:       state.tiers,
          count:       state.count,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      }
      const json = await res.json();
      const rows: AutoSelectEmpresaRow[] = json.data ?? [];
      const targets: EmpresaTarget[] = rows.map(r => ({
        id:       r.id,
        empresa:  r.nombre,
        pais:     r.pais ?? '',
        dominio:  r.dominio,
        sublinea: r.sub_linea_codigo,
        tier:     r.tier,
      }));
      setPicks(targets);
      onChange({ empresas: targets });
      setHasFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on mount o cuando cambian los inputs clave
  useEffect(() => {
    void fetchAutoSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersKey, sublineasKey, countKey]);

  function toggleTier(t: Tier) {
    const next = state.tiers.includes(t)
      ? state.tiers.filter(x => x !== t)
      : [...state.tiers, t];
    onChange({ tiers: next });
  }

  function removeEmpresa(id?: number) {
    if (id == null) return;
    const next = picks.filter(p => p.id !== id);
    setPicks(next);
    onChange({ empresas: next });
  }

  return (
    <div className="space-y-6">
      {/* Tier filter */}
      <div>
        <Label className="mb-2 block">
          Tier de empresas a buscar
          <span className="ml-1 text-xs font-normal text-muted-foreground">(multi-select)</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {TIER_OPTIONS.map(opt => {
            const active = state.tiers.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTier(opt.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs transition-all duration-150 text-left',
                  active ? 'font-medium' : 'border-border text-muted-foreground hover:text-foreground',
                )}
                style={active
                  ? { borderColor: ACCENT, color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 12%, transparent)` }
                  : undefined
                }
                title={opt.description}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <Label htmlFor="count-slider">Cantidad de empresas</Label>
          <span className="text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>
            {state.count}
          </span>
        </div>
        <input
          id="count-slider"
          type="range"
          min={1}
          max={20}
          step={1}
          value={state.count}
          onChange={e => onChange({ count: Number(e.target.value) })}
          className="w-full accent-current"
          style={{ accentColor: ACCENT }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>1</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      {/* Lista de empresas auto-seleccionadas */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Empresas seleccionadas
              <span className="ml-1 text-muted-foreground">({picks.length})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {hasFetched
                ? 'Puedes quitar cualquiera con la X'
                : 'Cargando selección…'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchAutoSelection()}
            disabled={loading}
          >
            {loading
              ? <><Loader2 size={14} className="mr-1 animate-spin" /> Cargando</>
              : <><RefreshCw size={14} className="mr-1" /> Re-elegir</>
            }
          </Button>
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive mb-2">
            {error}
          </div>
        )}

        {!loading && picks.length === 0 && !error && (
          <p className="text-xs text-muted-foreground italic py-4 text-center">
            No hay empresas para los criterios seleccionados.
          </p>
        )}

        <ul className="divide-y divide-border/60">
          {picks.map((p) => (
            <li key={p.id ?? p.empresa} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate font-medium">{p.empresa}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.pais || '—'}
                  {p.tier && <> · <span className="font-medium">{p.tier}</span></>}
                  {p.dominio ? <> · {p.dominio}</> : <span className="text-amber-600"> · sin dominio</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeEmpresa(p.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Quitar ${p.empresa}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Job titles */}
      <SharedConfigBlock state={state} onChange={onChange} />
    </div>
  );
}

// ─── Shared block (también usado en Manual) ─────────────────────────────────

interface SharedProps {
  state:    ProspectorWizardState;
  onChange: (updates: Partial<ProspectorWizardState>) => void;
}

export function SharedConfigBlock({ state, onChange }: SharedProps) {
  const sublineaForDefaults = state.sublineas[0] ?? null;

  const resetTitles = () => {
    onChange({ jobTitles: getDefaultTitles(sublineaForDefaults) });
  };

  // Si está vacío, llenar con defaults una sola vez (mount).
  useEffect(() => {
    if (state.jobTitles.length === 0) {
      onChange({ jobTitles: getDefaultTitles(sublineaForDefaults) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <JobTitleEditor
        jobTitles={state.jobTitles}
        onChange={titles => onChange({ jobTitles: titles })}
        onResetToDefaults={resetTitles}
        defaultsLabel={sublineaForDefaults ? `Default ${sublineaForDefaults}` : 'Default'}
      />

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <Label htmlFor="contactos-por-empresa">Contactos por empresa</Label>
          <span className="text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>
            {state.maxContactos}
          </span>
        </div>
        <input
          id="contactos-por-empresa"
          type="range"
          min={1}
          max={10}
          step={1}
          value={state.maxContactos}
          onChange={e => onChange({ maxContactos: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: ACCENT }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
}
