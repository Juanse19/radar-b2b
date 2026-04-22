'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { ResultadosTable } from './components/ResultadosTable';
import { InformeEjecucion } from '@/app/comercial/components/InformeEjecucion';
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

export default function ResultadosV2Page() {
  const [results,  setResults]  = useState<ComercialResult[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(false);

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
      const filter: ComercialResultsFilter = {
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

      const res = await fetch(`/api/comercial/results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data: ComercialResult[] = await res.json();
      const page = data.slice(0, PAGE_SIZE);

      setHasMore(data.length > PAGE_SIZE);
      setResults(prev => append ? [...prev, ...page] : page);
      setOffset(newOffset);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [linea, radarActivo, ventana]);

  // Refetch when filters change
  useEffect(() => { fetchResults(0, false); }, [fetchResults]);

  const loadMore = () => fetchResults(offset + PAGE_SIZE, true);

  const activeCount    = results.filter(r => r.radar_activo === 'Sí').length;
  const discardedCount = results.filter(r => r.radar_activo === 'No').length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp size={20} className="text-primary" />
            Resultados v2
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial de señales detectadas por el Agente 1 RADAR (Claude)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-500/15 text-green-700">
            {activeCount} activas
          </Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {discardedCount} descartadas
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pb-4">
          <Select value={linea} onValueChange={v => { setLinea(v ?? 'ALL'); }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Línea..." />
            </SelectTrigger>
            <SelectContent>
              {LINEA_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={radarActivo} onValueChange={v => setRadarActivo(v as 'ALL' | 'Sí' | 'No')}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Radar activo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL"  className="text-xs">Todos</SelectItem>
              <SelectItem value="Sí"   className="text-xs">✓ Con señal</SelectItem>
              <SelectItem value="No"   className="text-xs">✗ Descartados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ventana} onValueChange={v => setVentana(v ?? 'ALL')}>
            <SelectTrigger className="h-8 w-44 text-xs">
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
