'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Download } from 'lucide-react';
import { ResultadosTable } from './components/ResultadosTable';
import { InformeEjecucion } from '@/app/radar-v2/components/InformeEjecucion';
import type { RadarV2Result, RadarV2ResultsFilter } from '@/lib/radar-v2/types';

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

export default function ResultadosV2Page() {
  const [results,      setResults]      = useState<RadarV2Result[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [offset,       setOffset]       = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [totalCount,   setTotalCount]   = useState(0);
  const [totalActivas, setTotalActivas] = useState(0);
  const [totalDesc,    setTotalDesc]    = useState(0);

  // Filters
  const [linea,        setLinea]       = useState('ALL');
  const [radarActivo,  setRadarActivo] = useState<'ALL' | 'Sí' | 'No'>('ALL');
  const [ventana,      setVentana]     = useState('ALL');

  // Informe dialog state
  const [informeSessionId, setInformeSessionId] = useState('');
  const [showInforme,      setShowInforme]      = useState(false);

  const fetchResults = useCallback(async (newOffset = 0, append = false) => {
    setLoading(true);
    try {
      const filter: RadarV2ResultsFilter = {
        linea:        linea        !== 'ALL' ? linea        : undefined,
        radar_activo: radarActivo  !== 'ALL' ? radarActivo  : undefined,
        ventana:      ventana      !== 'ALL' ? ventana      : undefined,
        limit:        PAGE_SIZE + 1,
        offset:       newOffset,
      };

      const params = new URLSearchParams();
      if (filter.linea)        params.set('linea',        filter.linea);
      if (filter.radar_activo) params.set('radar_activo', filter.radar_activo);
      if (filter.ventana)      params.set('ventana',      filter.ventana);
      params.set('limit',  String(filter.limit));
      params.set('offset', String(filter.offset));

      const res = await fetch(`/api/radar-v2/results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json() as {
        results:     RadarV2Result[];
        total_count: number;
        activas:     number;
        descartadas: number;
      };
      const page = data.results.slice(0, PAGE_SIZE);

      setHasMore(data.results.length > PAGE_SIZE);
      setResults(prev => append ? [...prev, ...page] : page);
      setOffset(newOffset);
      // Update totals from server-side counts (not current-page counts)
      if (!append) {
        setTotalCount(data.total_count);
        setTotalActivas(data.activas);
        setTotalDesc(data.descartadas);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [linea, radarActivo, ventana]);

  // Refetch when filters change
  useEffect(() => { fetchResults(0, false); }, [fetchResults]);

  const loadMore = () => fetchResults(offset + PAGE_SIZE, true);

  // Build CSV export URL with active filters
  const buildExportParams = useCallback(() => {
    const p = new URLSearchParams();
    if (linea       !== 'ALL') p.set('linea',        linea);
    if (radarActivo !== 'ALL') p.set('radar_activo', radarActivo);
    if (ventana     !== 'ALL') p.set('ventana',      ventana);
    return p.toString();
  }, [linea, radarActivo, ventana]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <TrendingUp size={20} className="text-primary" />
          Resultados v2
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial de señales detectadas por el Agente 1 RADAR (Claude)
        </p>
      </div>

      {/* Sticky export bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <span className="text-sm font-medium text-muted-foreground">
          {loading ? (
            <span className="animate-pulse">Cargando...</span>
          ) : (
            <><span className="font-semibold text-foreground">{totalCount}</span> resultado{totalCount !== 1 ? 's' : ''}</>
          )}
        </span>
        <a
          href={`/api/radar-v2/export/csv?${buildExportParams()}`}
          download
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <Download size={13} />
          Exportar CSV
        </a>
      </div>

      {/* KPI summary row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total resultados</p>
            <p className="mt-0.5 text-2xl font-bold leading-none">{totalCount}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-green-700 dark:text-green-400">Activas</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-2xl font-bold leading-none text-green-700 dark:text-green-400">{totalActivas}</p>
              <Badge variant="secondary" className="bg-green-500/15 text-green-700 text-xs">
                con señal
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">Descartadas</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-2xl font-bold leading-none text-muted-foreground">{totalDesc}</p>
              <Badge variant="secondary" className="text-muted-foreground text-xs">
                sin señal
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Filters — grouped in single card */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pb-4">
          <Select value={linea} onValueChange={v => { setLinea(v ?? 'ALL'); }}>
            <SelectTrigger className="h-8 w-full sm:w-44 text-xs">
              <SelectValue placeholder="Línea..." />
            </SelectTrigger>
            <SelectContent>
              {LINEA_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={radarActivo} onValueChange={v => setRadarActivo(v as 'ALL' | 'Sí' | 'No')}>
            <SelectTrigger className="h-8 w-full sm:w-36 text-xs">
              <SelectValue placeholder="Radar activo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL"  className="text-xs">Todos</SelectItem>
              <SelectItem value="Sí"   className="text-xs">Con señal</SelectItem>
              <SelectItem value="No"   className="text-xs">Descartados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ventana} onValueChange={v => setVentana(v ?? 'ALL')}>
            <SelectTrigger className="h-8 w-full sm:w-44 text-xs">
              <SelectValue placeholder="Ventana de compra..." />
            </SelectTrigger>
            <SelectContent>
              {VENTANA_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
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
