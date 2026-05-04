'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Download, Filter, RotateCcw, Zap, XCircle, BarChart3, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultadosTable } from './components/ResultadosTable';
import { ResultadosTabs } from './components/ResultadosTabs';
import { InformeEjecucion } from '@/app/(comercial)/components/InformeEjecucion';
import type { ComercialResult, ComercialResultsFilter } from '@/lib/comercial/types';

const LINEA_OPTIONS = [
  { value: 'ALL',            label: 'Todas las líneas' },
  { value: 'BHS',            label: 'BHS — Aeropuertos' },
  { value: 'Intralogística', label: 'Intralogística' },
  { value: 'Cartón',         label: 'Cartón Corrugado' },
  { value: 'Final de Línea', label: 'Final de Línea' },
  { value: 'Motos',          label: 'Motos' },
  { value: 'SOLUMAT',        label: 'Solumat' },
];

const VENTANA_OPTIONS = [
  { value: 'ALL',         label: 'Todas las ventanas' },
  { value: '0-6 Meses',   label: '0-6 meses' },
  { value: '6-12 Meses',  label: '6-12 meses' },
  { value: '12-18 Meses', label: '12-18 meses' },
  { value: '18-24 Meses', label: '18-24 meses' },
  { value: '> 24 Meses',  label: '> 24 meses' },
];

const PAGE_SIZE = 50;

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:   string;
  value:   number | string;
  sub?:    string;
  accent?: 'green' | 'muted' | 'default';
  icon?:   React.ReactNode;
  loading?: boolean;
}

function StatCard({ label, value, sub, accent = 'default', icon, loading }: StatCardProps) {
  const isSignal = accent === 'green';
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-5 py-4 min-w-[110px]',
        accent === 'muted'   && 'border-border bg-muted/20',
        accent === 'default' && 'border-border bg-card',
      )}
      style={isSignal ? { borderColor: 'var(--agent-radar)', background: 'var(--agent-radar-tint)' } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        {loading ? (
          <Skeleton className="h-8 w-14 rounded" />
        ) : (
          <span
            className={cn(
              'text-3xl font-bold tabular-nums leading-none tracking-tight',
              accent === 'muted'   && 'text-muted-foreground',
              accent === 'default' && 'text-foreground',
            )}
            style={isSignal ? { color: 'var(--agent-radar)' } : undefined}
          >
            {value}
          </span>
        )}
        {icon && (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              accent === 'muted'   && 'bg-muted text-muted-foreground',
              accent === 'default' && 'bg-muted/60 text-muted-foreground',
            )}
            style={isSignal ? { background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' } : undefined}
          >
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ResultadosV2Page() {
  const [results,      setResults]      = useState<ComercialResult[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [offset,       setOffset]       = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [totalCount,   setTotalCount]   = useState(0);
  const [totalActivas, setTotalActivas] = useState(0);
  const [totalDesc,    setTotalDesc]    = useState(0);

  // Filters
  const [linea,       setLinea]       = useState('ALL');
  const [radarActivo, setRadarActivo] = useState<'ALL' | 'Sí' | 'No'>('ALL');
  const [ventana,     setVentana]     = useState('ALL');

  // Derived: any filter active?
  const filtersActive = linea !== 'ALL' || radarActivo !== 'ALL' || ventana !== 'ALL';

  function resetFilters() {
    setLinea('ALL');
    setRadarActivo('ALL');
    setVentana('ALL');
  }

  // Informe dialog
  const [informeSessionId, setInformeSessionId] = useState('');
  const [showInforme,      setShowInforme]      = useState(false);

  const fetchResults = useCallback(async (newOffset = 0, append = false) => {
    setLoading(true);
    try {
      const filter: ComercialResultsFilter = {
        linea:        linea       !== 'ALL' ? linea       : undefined,
        radar_activo: radarActivo !== 'ALL' ? radarActivo : undefined,
        ventana:      ventana     !== 'ALL' ? ventana     : undefined,
        limit:        PAGE_SIZE + 1,
        offset:       newOffset,
      };

      const params = new URLSearchParams();
      if (filter.linea)        params.set('linea',        filter.linea);
      if (filter.radar_activo) params.set('radar_activo', filter.radar_activo);
      if (filter.ventana)      params.set('ventana',      filter.ventana);
      params.set('limit',  String(filter.limit));
      params.set('offset', String(filter.offset));

      const res = await fetch(`/api/comercial/results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json() as {
        results:     ComercialResult[];
        total_count: number;
        activas:     number;
        descartadas: number;
      };
      const page = data.results.slice(0, PAGE_SIZE);

      setHasMore(data.results.length > PAGE_SIZE);
      setResults(prev => append ? [...prev, ...page] : page);
      setOffset(newOffset);
      if (!append) {
        setTotalCount(data.total_count);
        setTotalActivas(data.activas);
        setTotalDesc(data.descartadas);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [linea, radarActivo, ventana]);

  useEffect(() => { fetchResults(0, false); }, [fetchResults]);

  const loadMore = () => fetchResults(offset + PAGE_SIZE, true);

  const buildExportParams = useCallback(() => {
    const p = new URLSearchParams();
    if (linea       !== 'ALL') p.set('linea',        linea);
    if (radarActivo !== 'ALL') p.set('radar_activo', radarActivo);
    if (ventana     !== 'ALL') p.set('ventana',      ventana);
    return p.toString();
  }, [linea, radarActivo, ventana]);

  const activaPct = totalCount > 0
    ? Math.round((totalActivas / totalCount) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' }}
          >
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-radar)' }}>
              Agente 02 — Radar de Inversión
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">Resultados</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Señales de inversión detectadas por el Agente RADAR
            </p>
          </div>
        </div>
        <a
          href={`/api/comercial/export/csv?${buildExportParams()}`}
          download
          aria-label="Exportar resultados a CSV"
          className={cn(
            'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-border',
            'bg-background px-4 py-2 text-sm font-medium transition-colors',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          <Download size={15} />
          Exportar CSV
        </a>
      </div>

      {/* ── Tabs wrapper: Overview + Detalle ───────────────────────────────── */}
      <Suspense>
        <ResultadosTabs>
          {/* ── Stat cards (Detalle tab) ─────────────────────────────────── */}
          <div className="flex flex-wrap items-stretch gap-3">
            <StatCard
              label="Total escaneos"
              value={totalCount}
              icon={<BarChart3 size={16} />}
              loading={loading}
            />
            <StatCard
              label="Con señal activa"
              value={totalActivas}
              sub={totalCount > 0 ? `${activaPct}% del total` : undefined}
              accent="green"
              icon={<Zap size={16} />}
              loading={loading}
            />
            <StatCard
              label="Descartadas"
              value={totalDesc}
              accent="muted"
              icon={<XCircle size={16} />}
              loading={loading}
            />
            {!loading && totalCount > 0 && (
              <div className="flex flex-col justify-center gap-2 rounded-xl border border-border bg-card px-5 py-4 min-w-[140px]">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hit rate</span>
                      <span className="text-lg font-bold tabular-nums text-foreground">{activaPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${activaPct}%`, background: 'var(--agent-radar)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Filter bar (Detalle tab) ──────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Filter size={10} aria-hidden />
                Línea
              </label>
              <Select value={linea} onValueChange={v => setLinea(v ?? 'ALL')}>
                <SelectTrigger
                  className="h-8 w-48 text-xs"
                  aria-label="Filtrar por línea de negocio"
                >
                  <SelectValue placeholder="Todas las líneas" />
                </SelectTrigger>
                <SelectContent>
                  {LINEA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estado</label>
              <Select value={radarActivo} onValueChange={v => setRadarActivo(v as 'ALL' | 'Sí' | 'No')}>
                <SelectTrigger
                  className="h-8 w-40 text-xs"
                  aria-label="Filtrar por estado radar"
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Todos los estados</SelectItem>
                  <SelectItem value="Sí"  className="text-xs">Con señal activa</SelectItem>
                  <SelectItem value="No"  className="text-xs">Descartados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ventana</label>
              <Select value={ventana} onValueChange={v => setVentana(v ?? 'ALL')}>
                <SelectTrigger
                  className="h-8 w-44 text-xs"
                  aria-label="Filtrar por ventana de compra"
                >
                  <SelectValue placeholder="Todas las ventanas" />
                </SelectTrigger>
                <SelectContent>
                  {VENTANA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground self-end"
                onClick={resetFilters}
                aria-label="Limpiar filtros"
              >
                <RotateCcw size={11} />
                Limpiar
              </Button>
            )}

            {filtersActive && !loading && (
              <Badge variant="secondary" className="ml-auto h-6 self-end px-2 text-[11px]">
                {totalCount} resultado{totalCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* ── Table (Detalle tab) ───────────────────────────────────────── */}
          <div className="mt-4">
            <ResultadosTable
              results={results}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onVerInforme={sessionId => {
                setInformeSessionId(sessionId);
                setShowInforme(true);
              }}
            />
          </div>
        </ResultadosTabs>
      </Suspense>

      <InformeEjecucion
        sessionId={informeSessionId}
        open={showInforme}
        onClose={() => setShowInforme(false)}
      />
    </div>
  );
}
