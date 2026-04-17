'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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

      {/* Error / empty state */}
      {!loading && (error || !metrics || metrics.totals.scans === 0) && (
        <div className="rounded-lg border border-border bg-muted/20 py-16 text-center">
          <BarChart3 size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sin scans en el período seleccionado.
          </p>
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
            {/* Progress bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${pctActivas}%` }}
              />
            </div>
          </div>

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
