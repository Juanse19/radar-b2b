'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CompanySelector } from '../../components/CompanySelector';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';
import type { ComercialCompany } from '@/lib/comercial/types';

interface EstimateResponse {
  cost_usd_est: number;
}

function useCostEstimate(linea: string, count: number) {
  const [cost, setCost] = useState<number | null>(null);
  useEffect(() => {
    if (!linea || count < 1) { setCost(null); return; }
    let cancelled = false;
    fetch('/api/comercial/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ linea, empresas_count: count, provider: 'claude' }),
    })
      .then(r => r.ok ? r.json() as Promise<EstimateResponse> : null)
      .then(d => { if (!cancelled && d) setCost(d.cost_usd_est); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [linea, count]);
  return cost;
}

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

export function CalStep2Configure({ state, onChange }: Props) {
  const [selectedCompanies, setSelectedCompanies] = useState<ComercialCompany[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const displayCount  = state.mode === 'manual' ? selectedCompanies.length : state.count;
  const costEstimate  = useCostEstimate(state.linea, displayCount);

  // Hydrate manual selection from URL IDs
  useEffect(() => {
    if (state.mode !== 'manual' || !state.linea || hydrated) return;
    let cancelled = false;

    if (state.selectedIds.length === 0) {
      Promise.resolve().then(() => { if (!cancelled) setHydrated(true); });
      return () => { cancelled = true; };
    }

    const params = new URLSearchParams({ linea: state.linea, limit: '200' });
    fetch(`/api/comercial/companies?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((all: ComercialCompany[]) => {
        if (cancelled) return;
        setSelectedCompanies(all.filter(c => state.selectedIds.includes(c.id)));
        setHydrated(true);
      })
      .catch(() => { if (!cancelled) setHydrated(true); });

    return () => { cancelled = true; };
  }, [state.linea, state.mode, state.selectedIds, hydrated]);

  const handleCompaniesChange = (cs: ComercialCompany[]) => {
    setSelectedCompanies(cs);
    onChange({ selectedIds: cs.map(c => c.id) });
  };

  return (
    <div className="space-y-6">
      {state.mode === 'auto' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige cuántas empresas de{' '}
            <strong className="text-foreground">{state.linea || '—'}</strong> calificar.
            Se tomarán las de mayor prioridad de la base de datos.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Empresas a calificar</span>
              <span className="font-bold tabular-nums text-primary">{state.count}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={state.count}
              onChange={(e) => onChange({ count: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>1</span>
              <span>25</span>
              <span>50</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona las empresas a calificar de{' '}
            <strong className="text-foreground">{state.linea || '—'}</strong>.
          </p>
          {!state.linea ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Selecciona la línea de negocio en el paso anterior.
            </p>
          ) : (
            <CompanySelector
              line={state.linea}
              selected={selectedCompanies}
              onChange={handleCompaniesChange}
              maxSelect={50}
            />
          )}

          {selectedCompanies.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">País</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCompanies.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cost estimate */}
      {displayCount > 0 && (
        <div className={cn(
          'flex items-center justify-between rounded-lg border px-3 py-2',
          'border-border bg-muted/30 text-sm',
        )}>
          <span className="text-muted-foreground">Costo estimado</span>
          <span className="font-mono font-semibold">
            {costEstimate !== null
              ? `~$${costEstimate.toFixed(4)} USD`
              : <span className="text-muted-foreground">calculando…</span>}
          </span>
        </div>
      )}

      {/* RAG toggle */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <input
          type="checkbox"
          id="rag-toggle"
          checked={state.ragEnabled}
          onChange={e => onChange({ ragEnabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <label htmlFor="rag-toggle" className="cursor-pointer">
          <p className="text-sm font-medium">Contexto RAG</p>
          <p className="text-xs text-muted-foreground">
            Añade contexto de calificaciones pasadas para mejorar precisión
          </p>
          {state.ragEnabled && (
            <Badge variant="secondary" className="mt-1 h-5 text-[10px]">
              Activo
            </Badge>
          )}
        </label>
      </div>
    </div>
  );
}
