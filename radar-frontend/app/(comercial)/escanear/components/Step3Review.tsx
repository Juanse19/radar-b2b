'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Rocket, Loader2, AlertCircle, Check, Radar, Sparkles, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WizardState } from '@/lib/comercial/wizard-state';
import type { ComercialCompany } from '@/lib/comercial/types';
import { scanActivityStore } from '@/lib/comercial/scan-activity-store';

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
  { name: 'claude', model: 'Claude Sonnet 4.6', implemented: true },
  { name: 'openai', model: 'GPT-4o',            implemented: true },
  { name: 'gemini', model: 'Gemini 2.0 Flash',  implemented: true },
];

interface SignalResult {
  id: string;
  empresa_id: number | null;
  empresa_nombre: string;
  empresa_es_nueva: boolean;
  tipo_senal: string | null;
  descripcion: string | null;
  ventana_compra: string | null;
  nivel_confianza: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  pais: string | null;
}

interface ScanSignalsResponse {
  session_id: string | null;
  total_senales: number;
  empresas_nuevas: number;
  signals: SignalResult[];
  resumen_busqueda: string;
  cost?: { tokens_input: number; tokens_output: number; cost_usd: number; search_calls: number; model: string };
}

interface Props {
  state:      WizardState;
  onChange:   (updates: Partial<WizardState>) => void;
  agentMode?: 'empresa' | 'signals';
}

export function Step3Review({ state, onChange, agentMode = 'empresa' }: Props) {
  const router = useRouter();

  // ── Signals mode local state ──────────────────────────────────────────────
  const [sigRunning, setSigRunning] = useState(false);
  const [sigResult,  setSigResult]  = useState<ScanSignalsResponse | null>(null);
  const [sigError,   setSigError]   = useState<string | null>(null);
  const allFuentesRef = useRef<Array<{ nombre: string; url_base?: string | null }>>([]);

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

  // Number of lines selected (e.g. 'BHS,Cartón' → 2)
  const lineCount = state.line
    ? state.line.split(',').map(l => l.trim()).filter(Boolean).length || 1
    : 1;

  // Total scans = empresas × lines (each company is scanned once per line)
  const totalScans = empresasCount * lineCount;

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
        // Normalize provider aliases from the DB to the canonical names used by the registry
        const normalizeProvider = (p: string): string => {
          if (p === 'anthropic') return 'claude';
          if (p === 'google')    return 'gemini';
          return p;
        };
        const mapped: ProviderOption[] = configs.map((c) => ({
          name:        normalizeProvider(c.provider),
          model:       c.label,
          implemented: true,
        }));
        setProviders(mapped);
        // If current provider not in list, switch to default
        const defaultCfg = configs.find((c) => c.is_default);
        if (defaultCfg) {
          const defaultName = normalizeProvider(defaultCfg.provider);
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
    fetch('/api/comercial/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        linea:          state.line,
        empresas_count: totalScans,
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

  // Clamp effectiveBudget to valid slider range (W6)
  const clampedBudget = budgetRange.min > 0
    ? Math.min(Math.max(effectiveBudget, budgetRange.min), budgetRange.max)
    : effectiveBudget;

  async function handleFire() {
    if (firing) return;
    setFiring(true);
    setFireError(null);
    try {
      let companies: ComercialCompany[] = [];

      if (state.mode === 'auto') {
        const autoRes = await fetch('/api/comercial/auto-select', {
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
        // Do NOT filter by sublinea here: we need all companies for the line
        // so we can match the selected IDs regardless of sublinea context.
        const qs = new URLSearchParams({ linea: state.line, limit: '200' });
        const lookupRes = await fetch(`/api/comercial/companies?${qs}`);
        const all: ComercialCompany[] = lookupRes.ok ? await lookupRes.json() : [];
        companies = all.filter((c) => state.selectedIds.includes(c.id));
        if (companies.length === 0) {
          throw new Error('No se encontraron las empresas seleccionadas');
        }
      }

      // Generate a session id client-side and navigate to /en-vivo immediately.
      // The SSE stream endpoint (/api/comercial/stream) runs the actual scan —
      // the browser connects and starts receiving events right away.
      const sessionId = crypto.randomUUID();

      // Pre-register scan in global activity store so the floating widget
      // appears immediately and survives navigation to /en-vivo.
      scanActivityStore.startScan(
        sessionId,
        state.line,
        companies.map(c => c.name),
        state.provider,
      );

      // Keywords priority: custom textarea > DB keywords fetched in Step2 > nothing
      const effectiveKeywords = state.customKeywords?.trim()
        || (() => { try { return sessionStorage.getItem('wizard-db-keywords') ?? ''; } catch { return ''; } })();

      const vivoParams = new URLSearchParams({
        sessionId,
        line:     state.line,
        provider: state.provider,
        empresas: JSON.stringify(
          companies.map(c => ({ id: c.id, name: c.name, country: c.country })),
        ),
      });
      if (effectiveKeywords) vivoParams.set('keywords', effectiveKeywords);
      if (state.sublineas && state.sublineas.length > 0) {
        vivoParams.set('sublineas', state.sublineas.join(','));
      } else if (state.sublinea) {
        vivoParams.set('sublinea', state.sublinea);
      }
      // Default ragEnabled is true; only forward when explicitly disabled
      if (state.ragEnabled === false) vivoParams.set('rag', 'false');
      router.push(`/en-vivo?${vivoParams.toString()}`);
    } catch (e) {
      setFireError(e instanceof Error ? e.message : 'Error ejecutando escaneo');
      setFiring(false);
    }
  }

  // ── Signals mode render ────────────────────────────────────────────────────
  if (agentMode === 'signals') {
    async function handleSignalsFire() {
      setSigError(null);
      setSigResult(null);
      setSigRunning(true);
      try {
        const customKws = (state.customKeywords ?? '')
          .split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        const dbKws = (() => { try { return (sessionStorage.getItem('wizard-db-keywords') ?? '').split(',').filter(Boolean); } catch { return []; } })();
        const keywords = customKws.length > 0 ? customKws : dbKws;

        const resp = await fetch('/api/radar/scan-signals', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            linea_negocio: state.line,
            sub_linea:     state.sublineas?.length === 1 ? state.sublineas[0] : undefined,
            paises:        state.paises ?? [],
            keywords,
            fuentes:       allFuentesRef.current,
            provider:      state.provider,
            max_senales:   state.maxSenales ?? 10,
          }),
        });
        const data = await resp.json() as ScanSignalsResponse | { error: string };
        if (!resp.ok || 'error' in data) {
          setSigError(('error' in data && data.error) || `HTTP ${resp.status}`);
          return;
        }
        setSigResult(data as ScanSignalsResponse);
      } catch (err) {
        setSigError(err instanceof Error ? err.message : String(err));
      } finally {
        setSigRunning(false);
      }
    }

    const canRun = !!state.line && (state.paises ?? []).length > 0 && !sigRunning;

    return (
      <div className="space-y-5">
        {/* Resumen */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Resumen del escaneo de señales</h3>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs sm:grid-cols-3">
            <dt className="text-muted-foreground">Línea(s)</dt>
            <dd className="col-span-1 font-medium sm:col-span-2">
              {state.line ? state.line.split(',').filter(Boolean).join(', ') : '—'}
            </dd>
            <dt className="text-muted-foreground">Países</dt>
            <dd className="col-span-1 font-medium sm:col-span-2">
              {(state.paises ?? []).length > 0 ? state.paises.join(', ') : '—'}
            </dd>
            <dt className="text-muted-foreground">Máx. señales</dt>
            <dd className="col-span-1 font-medium sm:col-span-2">{state.maxSenales ?? 10}</dd>
          </dl>
        </Card>

        {/* Provider cards — same UI as empresa mode */}
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
                      'relative rounded-lg border-2 p-3 text-left text-xs transition-all duration-200',
                      isActive && p.implemented
                        ? 'border-primary bg-primary/25 ring-2 ring-primary/60 shadow-lg shadow-primary/20'
                        : 'border-border hover:border-primary/60 hover:bg-muted/40',
                      p.implemented ? '' : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {isActive && p.implemented && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                    <p className={cn('font-semibold capitalize', isActive && p.implemented && 'text-primary')}>
                      {p.name}
                    </p>
                    <p className="mt-0.5 leading-tight text-muted-foreground">{p.model}</p>
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

        {sigError && (
          <Card className="flex items-start gap-3 border-destructive bg-destructive/5 p-4 text-sm">
            <AlertTriangle size={16} className="mt-0.5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Error</p>
              <p className="text-muted-foreground">{sigError}</p>
            </div>
            <button onClick={() => setSigError(null)} aria-label="Cerrar"><X size={14} /></button>
          </Card>
        )}

        <Button size="lg" className="w-full" onClick={handleSignalsFire} disabled={!canRun}>
          {sigRunning ? (
            <><Loader2 size={16} className="mr-2 animate-spin" /> Escaneando señales…</>
          ) : (
            <><Radar size={16} className="mr-2" /> Ejecutar Modo Señales</>
          )}
        </Button>

        {sigResult && <SignalsResultsBlock data={sigResult} />}
      </div>
    );
  }

  // ── Empresa mode render ────────────────────────────────────────────────────
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
            {state.mode === 'auto' ? 'Automático' : state.mode === 'manual' ? 'Manual' : '—'}
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
              const costPerCompany = estimate && empresasCount > 0
                ? estimate.cost_usd_est / Math.max(empresasCount, 1)
                : null;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => p.implemented && onChange({ provider: p.name })}
                  disabled={!p.implemented}
                  className={cn(
                    'relative rounded-lg border-2 p-3 text-left text-xs transition-all duration-200',
                    isActive && p.implemented
                      ? 'border-primary bg-primary/25 ring-2 ring-primary/60 shadow-lg shadow-primary/20'
                      : 'border-border hover:border-primary/60 hover:bg-muted/40',
                    p.implemented ? '' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  {isActive && p.implemented && (
                    <span
                      aria-hidden
                      className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                  <p className={cn('font-semibold capitalize', isActive && p.implemented && 'text-primary')}>
                    {p.name}
                  </p>
                  <p className="mt-0.5 leading-tight text-muted-foreground">{p.model}</p>
                  {isActive && p.implemented && costPerCompany !== null ? (
                    <Badge
                      variant="secondary"
                      className="mt-1.5 h-4 bg-primary/15 px-1 text-[9px] text-primary"
                    >
                      ~${costPerCompany.toFixed(4)}/emp
                    </Badge>
                  ) : !p.implemented ? (
                    <Badge variant="secondary" className="mt-1 h-4 text-[9px]">
                      Próximamente
                    </Badge>
                  ) : null}
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
              {lineCount > 1 && (
                <>
                  <dt className="text-muted-foreground">Scans totales</dt>
                  <dd className="text-right font-mono">
                    {empresasCount} emp. × {lineCount} líneas = {totalScans}
                  </dd>
                </>
              )}
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
                  ${clampedBudget.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={budgetRange.min}
                max={budgetRange.max}
                step={0.01}
                value={clampedBudget}
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

// ── Signals results ────────────────────────────────────────────────────────
function SignalsResultsBlock({ data }: { data: ScanSignalsResponse }) {
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">
            <Sparkles size={14} className="mr-1 inline text-primary" />
            {data.total_senales} señal{data.total_senales !== 1 ? 'es' : ''} encontrada{data.total_senales !== 1 ? 's' : ''}
            {data.empresas_nuevas > 0 && (
              <Badge variant="outline" className="ml-2">
                {data.empresas_nuevas} empresa{data.empresas_nuevas !== 1 ? 's' : ''} nueva{data.empresas_nuevas !== 1 ? 's' : ''}
              </Badge>
            )}
          </p>
          {data.resumen_busqueda && (
            <p className="mt-1 text-xs text-muted-foreground">{data.resumen_busqueda}</p>
          )}
        </div>
        {data.cost && (
          <div className="text-right text-xs text-muted-foreground">
            <p>{data.cost.search_calls} búsquedas · {data.cost.tokens_input + data.cost.tokens_output} tokens</p>
            <p className="font-mono">USD {data.cost.cost_usd.toFixed(4)}</p>
          </div>
        )}
      </Card>
      <div className="space-y-3">
        {data.signals.map((s) => {
          const color =
            s.nivel_confianza === 'ALTA'  ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
            : s.nivel_confianza === 'MEDIA' ? 'border-amber-500 text-amber-600 bg-amber-500/10'
            : 'border-muted-foreground text-muted-foreground bg-muted/40';
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{s.empresa_nombre}</h3>
                    {s.empresa_es_nueva && (
                      <Badge variant="outline" className="border-primary text-primary">Empresa nueva</Badge>
                    )}
                    {s.pais && <span className="text-xs text-muted-foreground">· {s.pais}</span>}
                  </div>
                  {s.tipo_senal && <p className="mt-1 text-xs font-medium text-primary">{s.tipo_senal}</p>}
                  {s.descripcion && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{s.descripcion}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {s.nivel_confianza && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
                      {s.nivel_confianza}
                    </span>
                  )}
                  {s.ventana_compra && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {s.ventana_compra}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
