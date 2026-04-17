'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Activity } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { KpiCard } from './components/KpiCard';
import { MetricsTable } from './components/MetricsTable';
import type { RadarV2Metrics } from '@/lib/radar-v2/types';

type Range = 'day' | 'week' | 'month';

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: 'day',   label: 'Hoy' },
  { value: 'week',  label: 'Últimos 7 días' },
  { value: 'month', label: 'Últimos 30 días' },
];

export default function MetricasV2Page() {
  const [range,   setRange]   = useState<Range>('week');
  const [metrics, setMetrics] = useState<RadarV2Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const fetchMetrics = useCallback(async (r: Range) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/radar-v2/metrics?range=${r}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as RadarV2Metrics;
      setMetrics(data);
    } catch {
      setError(true);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(range);
  }, [range, fetchMetrics]);

  const pctActivas = metrics
    ? metrics.totals.scans > 0
      ? ((metrics.ratio_activas) * 100).toFixed(1)
      : '0.0'
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BarChart3 size={20} className="text-primary" />
            Métricas v2
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rendimiento del Agente 1 RADAR por período
          </p>
        </div>

        {/* Range selector */}
        <Select value={range} onValueChange={v => setRange(v as Range)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Período..." />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {/* Error state (fetch failed) */}
      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 py-12 px-6 text-center">
          <BarChart3 size={32} className="mx-auto mb-3 text-destructive/60" />
          <p className="text-sm font-medium text-destructive">Error al cargar las métricas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifica que el endpoint <code className="rounded bg-muted px-1">/api/radar-v2/metrics</code> esté disponible.
          </p>
          <button
            onClick={() => fetchMetrics(range)}
            className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state (no scans in range) */}
      {!loading && !error && metrics && metrics.totals.scans === 0 && (
        <div className="rounded-xl border border-border bg-muted/10 py-16 px-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
            <Activity size={24} className="text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold">Sin actividad en este período</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto">
            No se registraron escaneos en el intervalo seleccionado. Ejecuta un escaneo para comenzar a ver métricas.
          </p>
          <a
            href="/radar-v2/escanear"
            className="mt-5 inline-block rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Ir a Escanear →
          </a>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && metrics && metrics.totals.scans > 0 && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              title="Total scans"
              value={metrics.totals.scans}
              subtitle={`${metrics.totals.tokens_in.toLocaleString()} tokens`}
            />
            <KpiCard
              title="Señales activas"
              value={metrics.totals.activas}
              subtitle={`${pctActivas}% del total`}
            />
            <KpiCard
              title="Costo total"
              value={`$${metrics.totals.costo_usd.toFixed(4)}`}
              subtitle="USD"
            />
            <KpiCard
              title="Costo / scan"
              value={`$${metrics.promedios.costo_por_scan.toFixed(4)}`}
              subtitle="promedio"
            />
          </div>

          {/* Ratio visual */}
          <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ratio señales activas
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold leading-none text-green-700 dark:text-green-400">
                {pctActivas}%
              </span>
              <span className="mb-0.5 text-sm text-muted-foreground">
                {metrics.totals.activas} activas de {metrics.totals.scans} scans
              </span>
            </div>
            {/* Progress bar with inline percentage label */}
            <div className="relative mt-3 h-5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${pctActivas}%` }}
              />
              {Number(pctActivas) >= 10 && (
                <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-white/90 mix-blend-normal">
                  {pctActivas}%
                </span>
              )}
            </div>
          </div>

          {/* Section divider */}
          {metrics.por_linea.length > 0 && <Separator />}

          {/* Breakdown by line */}
          {metrics.por_linea.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Desglose por línea</h2>
              <MetricsTable data={metrics.por_linea} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
