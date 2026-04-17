'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Rocket, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WizardState } from '@/lib/radar-v2/wizard-state';
import type { RadarV2Company } from '@/lib/radar-v2/types';

interface EstimateResponse {
  tokens_in_est:          number;
  tokens_out_est:         number;
  cost_usd_est:           number;
  cached_percentage?:     number;
  budget_recommended_usd: number;
  provider?:              string;
  model?:                 string;
}

interface ProviderOption {
  name:        string;
  model:       string;
  implemented: boolean;
}

// Remote shape returned by /api/admin/api-keys?active=true
interface ApiKeyConfig {
  id:                 string;
  provider:           string;
  label:              string;
  model:              string;
  is_default:         boolean;
  monthly_budget_usd: number | null;
}

const FALLBACK_PROVIDERS: ProviderOption[] = [
  { name: 'claude', model: 'Claude Sonnet 4.6', implemented: true  },
  { name: 'openai', model: 'GPT-4o',            implemented: false },
  { name: 'gemini', model: 'Gemini 3 Pro',      implemented: false },
];

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step3Review({ state, onChange }: Props) {
  const router = useRouter();
  const [estimate,       setEstimate]       = useState<EstimateResponse | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [firing,         setFiring]         = useState(false);
  const [fireError,      setFireError]      = useState<string | null>(null);
  const [providers,      setProviders]      = useState<ProviderOption[]>(FALLBACK_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const empresasCount = state.mode === 'auto'
    ? state.count
    : state.selectedIds.length;

  // Fetch active provider configs from admin API
  useEffect(() => {
    let cancelled = false;
    setLoadingProviders(true);
    fetch('/api/admin/api-keys?active=true')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiKeyConfig[]>;
      })
      .then((configs) => {
        if (cancelled) return;
        if (configs.length === 0) {
          setProviders(FALLBACK_PROVIDERS);
          return;
        }
        const mapped: ProviderOption[] = configs.map((c) => ({
          name:        c.provider === 'anthropic' ? 'claude' : c.provider,
          model:       c.label,
          implemented: true,
        }));
        setProviders(mapped);
        // If current provider not in list, switch to default
        const defaultCfg = configs.find((c) => c.is_default);
        if (defaultCfg) {
          const defaultName = defaultCfg.provider === 'anthropic' ? 'claude' : defaultCfg.provider;
          const currentInList = mapped.some((p) => p.name === state.provider);
          if (!currentInList) {
            onChange({ provider: defaultName });
          }
        }
      })
      .catch(() => {
        // On fetch failure keep fallback providers
        if (!cancelled) setProviders(FALLBACK_PROVIDERS);
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch estimate whenever provider / line / count changes
  useEffect(() => {
    if (!state.line || empresasCount < 1) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/radar-v2/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        linea:          state.line,
        empresas_count: empresasCount,
        provider:       state.provider,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
        return r.json() as Promise<EstimateResponse>;
      })
      .then((est) => {
        if (cancelled) return;
        setEstimate(est);
        // initialise budget if not set by user
        if (!state.budgetUsd || state.budgetUsd <= 0) {
          onChange({ budgetUsd: est.budget_recommended_usd });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Error estimando costo';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.line, empresasCount, state.provider]);

  const budgetRange = useMemo(() => {
    if (!estimate) return { min: 0, max: 0 };
    const min = Math.max(0.01, +(estimate.cost_usd_est * 1.2).toFixed(2));
    const max = Math.max(min + 0.01, +(estimate.cost_usd_est * 3).toFixed(2));
    return { min, max };
  }, [estimate]);

  const effectiveBudget = state.budgetUsd > 0
    ? state.budgetUsd
    : estimate?.budget_recommended_usd ?? 0;

  async function handleFire() {
    if (firing) return;
    setFiring(true);
    setFireError(null);
    try {
      let companies: RadarV2Company[] = [];

      if (state.mode === 'auto') {
        const autoRes = await fetch('/api/radar-v2/auto-select', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ linea: state.line, cantidad: state.count }),
        });
        if (!autoRes.ok) throw new Error(await autoRes.text() || 'auto-select falló');
        const autoData = await autoRes.json();
        companies = (autoData.empresas ?? []).map((e: {
          id:       number;
          name?:    string;
          nombre?:  string;
          country?: string;
          pais?:    string;
          tier?:    string;
          linea?:   string;
        }) => ({
          id:      e.id,
          name:    e.name ?? e.nombre ?? '',
          country: e.country ?? e.pais ?? '',
          tier:    e.tier,
          linea:   e.linea,
        }));
        if (companies.length === 0) {
          throw new Error('No hay empresas disponibles para esa línea');
        }
      } else {
        // Manual mode — re-hydrate full name/country from companies endpoint
        const qs = new URLSearchParams({ linea: state.line, limit: '200' });
        const lookupRes = await fetch(`/api/radar-v2/companies?${qs}`);
        const all: RadarV2Company[] = lookupRes.ok ? await lookupRes.json() : [];
        companies = all.filter((c) => state.selectedIds.includes(c.id));
        if (companies.length === 0) {
          throw new Error('No se encontraron las empresas seleccionadas');
        }
      }

      // Generate a session id client-side and navigate to /vivo immediately.
      // The SSE stream endpoint (/api/radar-v2/stream) runs the actual scan —
      // the browser connects and starts receiving events right away.
      const sessionId = crypto.randomUUID();
      const vivoParams = new URLSearchParams({
        sessionId,
        line:     state.line,
        provider: state.provider,
        empresas: JSON.stringify(
          companies.map(c => ({ id: c.id, name: c.name, country: c.country })),
        ),
      });
      router.push(`/radar-v2/vivo?${vivoParams.toString()}`);
    } catch (e) {
      setFireError(e instanceof Error ? e.message : 'Error ejecutando escaneo');
      setFiring(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Resumen del escaneo</h3>
        <dl className="grid grid-cols-2 gap-y-1.5 text-xs sm:grid-cols-3">
          <dt className="text-muted-foreground">Línea(s)</dt>
          <dd className="col-span-1 font-medium sm:col-span-2">
            {state.line ? state.line.split(',').filter(Boolean).join(', ') : '—'}
          </dd>

          <dt className="text-muted-foreground">Modo</dt>
          <dd className="col-span-1 font-medium capitalize sm:col-span-2">
            {state.mode === 'auto' ? 'Automático' : 'Manual'}
          </dd>

          <dt className="text-muted-foreground">Empresas</dt>
          <dd className="col-span-1 font-medium sm:col-span-2">{empresasCount}</dd>
        </dl>
      </Card>

      {/* Provider selector */}
      <div>
        <Label className="mb-2 block">Proveedor IA</Label>
        {loadingProviders ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {providers.map((p) => {
              const isActive = state.provider === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => p.implemented && onChange({ provider: p.name })}
                  disabled={!p.implemented}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-left text-xs transition-colors',
                    isActive && p.implemented
                      ? 'border-primary bg-primary/10'
                      : 'border-border',
                    p.implemented ? 'hover:border-primary/50' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <p className="font-semibold capitalize">{p.name}</p>
                  <p className="text-muted-foreground">{p.model}</p>
                  {!p.implemented && (
                    <Badge variant="secondary" className="mt-1 h-4 text-[9px]">
                      Próximamente
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cost estimate */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Estimación de costo</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span>Calculando...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : estimate ? (
          <>
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Tokens entrada</dt>
              <dd className="text-right font-mono">
                {estimate.tokens_in_est.toLocaleString()}
              </dd>
              <dt className="text-muted-foreground">Tokens salida</dt>
              <dd className="text-right font-mono">
                {estimate.tokens_out_est.toLocaleString()}
              </dd>
              <dt className="text-muted-foreground">Costo estimado</dt>
              <dd className="text-right font-mono font-semibold text-foreground">
                ${estimate.cost_usd_est.toFixed(4)}
              </dd>
              <dt className="text-muted-foreground">Presupuesto recomendado</dt>
              <dd className="text-right font-mono">
                ${estimate.budget_recommended_usd.toFixed(2)}
              </dd>
            </dl>

            {/* Budget slider */}
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-xs">Presupuesto máximo</Label>
                <span className="text-sm font-semibold text-foreground">
                  ${effectiveBudget.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={budgetRange.min}
                max={budgetRange.max}
                step={0.01}
                value={effectiveBudget}
                onChange={(e) => onChange({ budgetUsd: Number(e.target.value) })}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                aria-label="Presupuesto máximo"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${budgetRange.min.toFixed(2)}</span>
                <span>${budgetRange.max.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos para estimar.</p>
        )}
      </Card>

      {/* Fire button */}
      {fireError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{fireError}</span>
        </div>
      )}
      <Button
        size="lg"
        className="w-full"
        onClick={handleFire}
        disabled={firing || loading || !!error || empresasCount < 1 || !state.line}
      >
        {firing ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Ejecutando escaneo...
          </>
        ) : (
          <>
            <Rocket size={16} className="mr-2" />
            Ejecutar escaneo
            {estimate ? ` — $${estimate.cost_usd_est.toFixed(4)}` : ''}
          </>
        )}
      </Button>
    </div>
  );
}
