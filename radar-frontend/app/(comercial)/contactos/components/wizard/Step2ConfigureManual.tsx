'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SharedConfigBlock } from './Step2ConfigureAuto';
import type { ProspectorWizardState, EmpresaTarget } from './state';

interface Props {
  state:    ProspectorWizardState;
  onChange: (updates: Partial<ProspectorWizardState>) => void;
}

const ACCENT = 'var(--agent-contactos)';

interface CandidateRow {
  id:               number;
  nombre:           string;
  dominio:          string | null;
  pais:             string | null;
  tier:             string;
  sub_linea_id:     number | null;
  sub_linea_codigo: string | null;
}

const TIER_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  'A':             { bg: '#FEF3C7', fg: '#7C2D12', label: 'A' },
  'B':             { bg: '#FCE7F3', fg: '#831843', label: 'B' },
  'C':             { bg: '#EDE9FE', fg: '#4C1D95', label: 'C' },
  'D':             { bg: '#E5E7EB', fg: '#374151', label: 'D' },
  'sin_calificar': { bg: '#F3F4F6', fg: '#6B7280', label: '—' },
};

export function Step2ConfigureManual({ state, onChange }: Props) {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  const sublineaIdsKey = state.sublineaIds.join(',');
  const tiersKey       = state.tiers.join(',');

  // Debounce server-side search por nombre/dominio/país.
  // Si state.sublineaIds está vacío, mostramos catálogo completo (no [-1]).
  useEffect(() => {
    let alive = true;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/prospector/v2/empresas-search', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sublineaIds: state.sublineaIds.length > 0 ? state.sublineaIds : undefined,
            search:      search.trim() || undefined,
            tiers:       state.tiers.length > 0 ? state.tiers : undefined,
            limit:       200,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
        }
        const json = await res.json();
        if (!alive) return;
        setCandidates(json.data ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (alive) setLoading(false);
      }
    }, search ? 350 : 0); // debounce solo cuando hay search (typing); inmediato en cambio de sublineaIds
    return () => { alive = false; clearTimeout(handle); };
  }, [sublineaIdsKey, tiersKey, search]);

  const selectedIds = useMemo(
    () => new Set(state.empresas.map(e => e.id).filter((x): x is number => x != null)),
    [state.empresas],
  );

  function toggle(c: CandidateRow) {
    if (selectedIds.has(c.id)) {
      onChange({ empresas: state.empresas.filter(e => e.id !== c.id) });
      return;
    }
    const target: EmpresaTarget = {
      id:       c.id,
      empresa:  c.nombre,
      pais:     c.pais ?? '',
      dominio:  c.dominio,
      sublinea: c.sub_linea_codigo,
      tier:     c.tier,
    };
    onChange({ empresas: [...state.empresas, target] });
  }

  function clear() {
    onChange({ empresas: [] });
  }

  function selectAll() {
    const targets: EmpresaTarget[] = filtered.map(c => ({
      id:       c.id,
      empresa:  c.nombre,
      pais:     c.pais ?? '',
      dominio:  c.dominio,
      sublinea: c.sub_linea_codigo,
      tier:     c.tier,
    }));
    onChange({ empresas: targets });
  }

  // Búsqueda server-side: candidates ya viene filtrado por el endpoint.
  const filtered = candidates;

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">
          Empresas
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({state.empresas.length} seleccionadas · de {filtered.length} disponibles)
          </span>
        </Label>

        {/* Filtro por Tier — chips multi-select. Vacío = todos los tiers. */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
            Tier:
          </span>
          {(['A', 'B', 'C', 'D', 'sin_calificar'] as const).map(t => {
            const active = state.tiers.includes(t);
            const isGold = t === 'A';
            const colors = {
              A:             { bg: '#FBBF24', fg: '#451A03', border: '#F59E0B' },
              B:             { bg: '#FCE7F3', fg: '#831843', border: '#FBCFE8' },
              C:             { bg: '#EDE9FE', fg: '#4C1D95', border: '#DDD6FE' },
              D:             { bg: '#E5E7EB', fg: '#374151', border: '#D1D5DB' },
              sin_calificar: { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB' },
            }[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const next = active
                    ? state.tiers.filter(x => x !== t)
                    : [...state.tiers, t];
                  onChange({ tiers: next });
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-all',
                  active ? 'font-semibold shadow-sm' : 'opacity-65 hover:opacity-100',
                )}
                style={{
                  background:  active ? (isGold ? `linear-gradient(135deg, ${colors.bg} 0%, #FCD34D 100%)` : colors.bg) : 'transparent',
                  color:       active ? colors.fg : undefined,
                  borderColor: active ? colors.border : 'var(--border)',
                }}
              >
                {t === 'sin_calificar' ? 'Sin calificar' : `Tier ${t}`}
              </button>
            );
          })}
          {state.tiers.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ tiers: [] })}
              className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
            >
              Mostrar todas
            </button>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {state.tiers.length === 0
              ? 'Sin filtro · todas las empresas'
              : `${state.tiers.length} tier${state.tiers.length !== 1 ? 's' : ''} seleccionado${state.tiers.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="mb-2 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa, país o dominio…"
              className="pl-8 text-sm"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={loading}>
            Seleccionar todas
          </Button>
          {state.empresas.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={clear}>
              Limpiar
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Cargando empresas…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            {state.sublineaIds.length === 0
              ? 'Selecciona al menos una sub-línea en el paso anterior.'
              : 'No hay empresas para los criterios seleccionados.'}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                <tr>
                  <th className="w-10 p-2 text-left text-xs font-medium text-muted-foreground"></th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Empresa</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">País</th>
                  <th className="w-16 p-2 text-left text-xs font-medium text-muted-foreground">Tier</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Dominio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const checked = selectedIds.has(c.id);
                  const tier = TIER_BADGE[c.tier] ?? TIER_BADGE.sin_calificar;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => toggle(c)}
                      className={cn(
                        'cursor-pointer border-t border-border/30 transition-colors',
                        checked ? '' : 'hover:bg-muted/30',
                      )}
                      style={checked
                        ? { background: `color-mix(in srgb, ${ACCENT} 8%, transparent)` }
                        : undefined
                      }
                    >
                      <td className="p-2">
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border',
                            checked ? 'text-white' : 'border-border bg-background',
                          )}
                          style={checked ? { background: ACCENT, borderColor: ACCENT } : undefined}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                      </td>
                      <td className="p-2 font-medium">{c.nombre}</td>
                      <td className="p-2 text-muted-foreground">{c.pais ?? '—'}</td>
                      <td className="p-2">
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: tier.bg, color: tier.fg }}
                        >
                          {tier.label}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {c.dominio ?? <span className="text-amber-600">sin dominio</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SharedConfigBlock state={state} onChange={onChange} />
    </div>
  );
}
