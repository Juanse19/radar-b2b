'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Download, Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultadosTable } from './components/ResultadosTable';
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

// ── Stat pill ────────────────────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  value: number | string;
  accent?: 'green' | 'muted' | 'default';
  loading?: boolean;
}

function StatPill({ label, value, accent = 'default', loading }: StatPillProps) {
  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <Skeleton className="h-6 w-12 rounded-md" />
      ) : (
        <span
          className={cn(
            'text-lg font-bold tabular-nums leading-none',
            accent === 'green'  && 'text-green-600 dark:text-green-400',
            accent === 'muted'  && 'text-muted-foreground',
            accent === 'default' && 'text-foreground',
          )}
        >
          {value}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp size={20} className="text-primary" />
            Resultados
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Señales de inversión detectadas por el Agente RADAR
          </p>
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

      {/* ── Stat strip ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3.5">
        <StatPill label="resultados" value={totalCount} loading={loading} />
        <div className="h-5 w-px bg-border hidden sm:block" aria-hidden />
        <StatPill label="con señal activa" value={totalActivas} accent="green" loading={loading} />
        <div className="h-5 w-px bg-border hidden sm:block" aria-hidden />
        <StatPill label="descartadas" value={totalDesc} accent="muted" loading={loading} />
        {!loading && totalCount > 0 && (
          <>
            <div className="h-5 w-px bg-border hidden sm:block" aria-hidden />
            <div className="flex items-center gap-2">
              {/* Hit-rate progress bar */}
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500 motion-safe:transition-all"
                  style={{ width: `${activaPct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{activaPct}% hit rate</span>
            </div>
          </>
        )}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="shrink-0 text-muted-foreground" aria-hidden />

        <Select value={linea} onValueChange={v => setLinea(v ?? 'ALL')}>
          <SelectTrigger
            className="h-9 w-full sm:w-48 text-xs"
            aria-label="Filtrar por línea de negocio"
          >
            <SelectValue placeholder="Línea..." />
          </SelectTrigger>
          <SelectContent>
            {LINEA_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={radarActivo} onValueChange={v => setRadarActivo(v as 'ALL' | 'Sí' | 'No')}>
          <SelectTrigger
            className="h-9 w-full sm:w-40 text-xs"
            aria-label="Filtrar por estado radar"
          >
            <SelectValue placeholder="Estado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">Todos los estados</SelectItem>
            <SelectItem value="Sí"  className="text-xs">Con señal activa</SelectItem>
            <SelectItem value="No"  className="text-xs">Descartados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ventana} onValueChange={v => setVentana(v ?? 'ALL')}>
          <SelectTrigger
            className="h-9 w-full sm:w-48 text-xs"
            aria-label="Filtrar por ventana de compra"
          >
            <SelectValue placeholder="Ventana de compra..." />
          </SelectTrigger>
          <SelectContent>
            {VENTANA_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
            aria-label="Limpiar filtros"
          >
            <RotateCcw size={12} />
            Limpiar
          </Button>
        )}

        {filtersActive && !loading && (
          <Badge variant="secondary" className="ml-auto h-6 px-2 text-[11px]">
            {totalCount} resultado{totalCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
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

      <InformeEjecucion
        sessionId={informeSessionId}
        open={showInforme}
        onClose={() => setShowInforme(false)}
      />
    </div>
  );
}
