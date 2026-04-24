'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Coins, Activity, DollarSign, Gauge } from 'lucide-react';

interface TokensData {
  days:   number;
  totals: { scans: number; tokens_in: number; tokens_out: number; costo_usd: number };
  events: Array<{
    id:            string;
    empresa:       string;
    linea:         string | null;
    tokens_input:  number;
    tokens_output: number;
    cost_usd:      number;
    created_at:    string;
  }>;
  serie:  Array<{ day: string; costo: number; scans: number }>;
}

const RANGES: Array<{ value: string; label: string }> = [
  { value: '7',  label: 'Últimos 7 días'  },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export default function AdminTokensPage() {
  const [data,     setData]     = useState<TokensData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [range,    setRange]    = useState('30');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/tokens?days=${range}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TokensData;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const totalTokens = data ? data.totals.tokens_in + data.totals.tokens_out : 0;
  const avgCostPerScan = data && data.totals.scans > 0
    ? data.totals.costo_usd / data.totals.scans
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Coins size={20} className="text-primary" />
            Administración de Tokens
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consumo de tokens y costos del Radar v2 por período.
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v ?? '30')}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">Error al cargar los datos</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && data && data.totals.scans === 0 && (
        <Card className="p-12 text-center">
          <Coins size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">Sin consumo en este período</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ejecuta escaneos desde Radar v2 para ver estadísticas aquí.
          </p>
        </Card>
      )}

      {/* Dashboard */}
      {!loading && !error && data && data.totals.scans > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              icon={Activity}
              label="Scans"
              value={data.totals.scans.toLocaleString('es-CO')}
              subtitle={`últimos ${data.days} días`}
            />
            <KpiCard
              icon={Gauge}
              label="Tokens totales"
              value={totalTokens.toLocaleString('es-CO')}
              subtitle={`${data.totals.tokens_in.toLocaleString('es-CO')} in / ${data.totals.tokens_out.toLocaleString('es-CO')} out`}
            />
            <KpiCard
              icon={DollarSign}
              label="Costo total"
              value={`$${data.totals.costo_usd.toFixed(4)}`}
              subtitle="USD"
            />
            <KpiCard
              icon={Coins}
              label="Costo / scan"
              value={`$${avgCostPerScan.toFixed(4)}`}
              subtitle="promedio"
            />
          </div>

          {/* Serie diaria (bar visual simple) */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Costo diario (USD)</h2>
            {data.serie.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos en este período.</p>
            ) : (
              <div className="space-y-1.5">
                {data.serie.map((s) => {
                  const maxCost = Math.max(...data.serie.map((x) => x.costo), 0.0001);
                  const pct = Math.round((s.costo / maxCost) * 100);
                  const day = new Date(s.day).toLocaleDateString('es-CO', {
                    day: '2-digit', month: 'short',
                  });
                  return (
                    <div key={s.day} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-muted-foreground">{day}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-medium">
                        ${s.costo.toFixed(4)}
                      </span>
                      <span className="w-12 shrink-0 text-right text-muted-foreground">
                        {s.scans} sc
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Events table */}
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <h2 className="text-sm font-semibold">Últimos 50 escaneos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">Línea</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens in</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens out</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString('es-CO', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 font-medium">{e.empresa}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.linea ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{e.tokens_input.toLocaleString('es-CO')}</td>
                      <td className="px-3 py-2 text-right">{e.tokens_output.toLocaleString('es-CO')}</td>
                      <td className="px-3 py-2 text-right font-medium">${e.cost_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

interface KpiCardProps {
  icon:     React.ComponentType<{ size?: number; className?: string }>;
  label:    string;
  value:    string;
  subtitle: string;
}

function KpiCard({ icon: Icon, label, value, subtitle }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon size={14} className="text-muted-foreground/60" />
      </div>
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{subtitle}</p>
    </Card>
  );
}
