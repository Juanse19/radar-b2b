'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState,
} from '@tanstack/react-table';
import { createResultsColumns } from './columns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Activity, ClipboardCheck, Users, Radar, X } from 'lucide-react';
import { AgentPipelineCard } from '@/components/tracker/AgentPipelineCard';
import { useInflightExecutions } from '@/hooks/useInflightExecutions';
import { EmptyState } from '@/components/EmptyState';
import { Table2 } from 'lucide-react';
import { LineaBadge } from '@/components/LineaBadge';
import { ScoreBadge } from '@/components/ScoreBadge';
import { TierBadge } from '@/components/TierBadge';
import { ErrorState } from '@/components/ErrorState';
import { TablePagination } from '@/components/ui/table-pagination';
import type { ResultadoRadar } from '@/lib/types';
import { LINEAS_ACTIVAS } from '@/lib/lineas';
import { fetchJson } from '@/lib/fetcher';

// Sheet de detalle = Base UI Dialog + cadena de íconos. Pesa varios cientos de
// KB y solo se necesita cuando el usuario hace click en una fila → cargarlo
// perezosamente desbloquea el TTI de /results y reduce trabajo síncrono inicial.
const SignalDetailSheet = dynamic(
  () => import('@/components/results/SignalDetailSheet').then(m => m.SignalDetailSheet),
  { ssr: false },
);

const TIER_OPTIONS = [
  { value: 'ALL',       label: 'Todos los tiers' },
  { value: 'ORO',       label: '★ ORO (Score ≥ 8)' },
  { value: 'Monitoreo', label: 'Monitoreo (5-7)' },
  { value: 'Contexto',  label: 'Contexto (1-4)' },
  { value: 'Sin Señal', label: 'Sin Señal' },
];

const DEFAULT_PAGE_SIZE = 50;

const LINEA_FILTER_OPTIONS_ALL = [
  { value: 'ALL',            label: 'Todas',             color: 'text-gray-200',    dot: 'bg-gray-400' },
  { value: 'BHS',            label: '✈️ BHS',            color: 'text-blue-400',    dot: 'bg-blue-500' },
  { value: 'Cartón',         label: '📦 Cartón',         color: 'text-amber-400',   dot: 'bg-amber-500' },
  { value: 'Intralogística', label: '🏭 Intralogística', color: 'text-emerald-400', dot: 'bg-emerald-500' },
];

const LINEA_FILTER_OPTIONS = LINEA_FILTER_OPTIONS_ALL.filter(
  o => o.value === 'ALL' || (LINEAS_ACTIVAS as readonly string[]).includes(o.value),
);

// ── Loading skeleton shown while Suspense waits for useSearchParams ────────────

function ResultsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-surface-muted rounded w-56 animate-pulse" />
          <div className="h-4 bg-surface-muted rounded w-40 animate-pulse" />
        </div>
        <div className="h-9 bg-surface-muted rounded w-32 animate-pulse" />
      </div>
      <div className="border-b border-border h-12 animate-pulse" />
      <div className="divide-y divide-gray-800/50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
            <div className="h-4 bg-surface-muted rounded w-40" />
            <div className="h-4 bg-surface-muted rounded w-20" />
            <div className="h-5 bg-surface-muted rounded-full w-16" />
            <div className="h-5 bg-surface-muted rounded-full w-20" />
            <div className="h-4 bg-surface-muted rounded w-28 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inner component — uses useSearchParams, requires Suspense boundary ─────────

function ResultsInner() {
  const searchParams   = useSearchParams();
  const tierParam      = searchParams.get('tier') ?? 'ALL';

  const [tierFiltro,  setTierFiltro]  = useState(tierParam);
  const [lineaFiltro, setLineaFiltro] = useState('ALL');
  const [paisFiltro,  setPaisFiltro]  = useState('');
  const [busqueda,    setBusqueda]    = useState('');
  const [desde,       setDesde]       = useState('');
  const [hasta,       setHasta]       = useState('');
  const [pagina,      setPagina]      = useState(0);
  const [pageSize,    setPageSize]    = useState(DEFAULT_PAGE_SIZE);
  const [sorting,     setSorting]     = useState<SortingState>([{ id: 'scoreRadar', desc: true }]);
  const [detailSignal, setDetailSignal] = useState<ResultadoRadar | null>(null);
  const [activeTab, setActiveTab] = useState<'signals' | 'calificacion' | 'radar' | 'contactos'>('signals');
  // Re-scan state: { executionId, empresa } set when user fires Radar from a row.
  const [rescan, setRescan] = useState<{ executionId: string; empresa: string } | null>(null);
  const { invalidate: invalidateTray } = useInflightExecutions();

  // Sincronizar con el query param inicial
  useEffect(() => { setTierFiltro(tierParam); }, [tierParam]);

  const signalUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (lineaFiltro !== 'ALL') p.set('linea', lineaFiltro);
    if (tierFiltro  !== 'ALL') p.set('tier', tierFiltro);
    if (paisFiltro)            p.set('pais', paisFiltro);
    if (desde)                 p.set('from', desde);
    if (hasta)                 p.set('to', hasta);
    p.set('limit', '500');
    return `/api/signals?${p}`;
  }, [lineaFiltro, tierFiltro, paisFiltro, desde, hasta]);

  const {
    data: rawResults = [],
    isLoading,
    error: signalsError,
    refetch: refetchSignals,
  } = useQuery<ResultadoRadar[]>({
    queryKey: ['signals', lineaFiltro, tierFiltro, paisFiltro, desde, hasta],
    queryFn: async () => {
      const data = await fetchJson<unknown>(signalUrl);
      return Array.isArray(data) ? (data as ResultadoRadar[]) : [];
    },
  });

  // Nota: el toast era redundante porque <ErrorState> ya muestra el error
  // inline con botón "Reintentar". Dos efectos UI por el mismo error solo
  // añaden ruido y trabajo extra al main thread.

  const contactosUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (lineaFiltro !== 'ALL') p.set('linea', lineaFiltro);
    p.set('limit', '200');
    return `/api/contacts?${p}`;
  }, [lineaFiltro]);

  const {
    data: contactos = [],
    isLoading: loadingContactos,
    error: contactosError,
    refetch: refetchContactos,
  } = useQuery({
    queryKey: ['contacts', lineaFiltro],
    queryFn: async () => {
      const data = await fetchJson<unknown>(contactosUrl);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'contactos',
  });

  // Filtro de búsqueda client-side
  const results = useMemo(() => {
    if (!busqueda.trim()) return rawResults;
    const q = busqueda.toLowerCase();
    return rawResults.filter(r =>
      r.empresa.toLowerCase().includes(q) ||
      r.pais.toLowerCase().includes(q) ||
      (r.tipoSenal || '').toLowerCase().includes(q),
    );
  }, [rawResults, busqueda]);

  const totalPaginas = Math.ceil(results.length / pageSize);

  // CRÍTICO: paginados DEBE estar memoizado. useReactTable usa `data` como
  // parte de su estado interno y recalcula row models si la referencia
  // cambia. Sin useMemo creábamos un slice nuevo en CADA render → cascada
  // de re-renders → main thread saturado → freeze.
  const paginados = useMemo(
    () => results.slice(pagina * pageSize, (pagina + 1) * pageSize),
    [results, pagina, pageSize],
  );

  const columns = useMemo(
    () => createResultsColumns(
      (signal) => setDetailSignal(signal),
      (execId, empresa) => {
        setRescan({ executionId: execId, empresa });
        invalidateTray(); // wake the global tray
      },
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Los row models también deben memoizarse — son funciones que retornan
  // funciones nuevas en cada render si no se cachean.
  const coreRowModel   = useMemo(() => getCoreRowModel<ResultadoRadar>(),   []);
  const sortedRowModel = useMemo(() => getSortedRowModel<ResultadoRadar>(), []);

  const table = useReactTable({
    data: paginados,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel:   coreRowModel,
    getSortedRowModel: sortedRowModel,
  });

  function exportarCSV() {
    const headers = [
      'Empresa', 'País', 'Línea', 'Tier', 'Radar Activo', 'Tipo Señal',
      'Score Radar', 'Ventana Compra', 'Monto Inversión', 'Fecha Señal',
      'Empresa / Proyecto', 'Criterios Cumplidos', 'Total Criterios',
      'Evaluación Temporal', 'TIER Score', 'TIER', 'TIR Score', 'TIR',
      'Score Final MAOA', 'Convergencia', 'Acción Recomendada',
      'Signal ID', 'Descripción', 'Fuente', 'URL', 'Observaciones', 'Fecha Escaneo',
    ];
    const esc = (v: unknown) => String(v ?? '').replace(/,/g, ';').replace(/\n/g, ' ');
    const rows = results.map(r => [
      esc(r.empresa),
      esc(r.pais),
      esc(r.linea),
      esc(r.tier),
      esc(r.radarActivo),
      esc(r.tipoSenal),
      esc(r.scoreRadar),
      esc(r.ventanaCompra),
      esc(r.montoInversion),
      esc(r.fechaSenal),
      esc(r.empresaProyecto),
      esc((r.criteriosCumplidos ?? []).join(' | ')),
      esc(r.totalCriterios),
      esc(r.evaluacionTemporal),
      esc(r.tierScore),
      esc(r.tierClasificacion),
      esc(r.tirScore),
      esc(r.tirClasificacion),
      esc(r.scoreFinalMaoa),
      esc(r.convergenciaMaoa),
      esc(r.accionRecomendada),
      esc(r.signalId),
      esc(r.descripcion),
      esc(r.fuente),
      esc(r.fuenteUrl),
      esc(r.observacionesMaoa),
      esc(r.fechaEscaneo),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radar-b2b-maoa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${results.length} señales exportadas (formato MAOA)`);
  }

  const oroCount        = rawResults.filter(r => (r.scoreRadar >= 8 || r.scoreRadar >= 80)).length;
  const conSenalCount   = rawResults.filter(r => r.radarActivo === 'Sí').length;

  return (
    <div className="space-y-4 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Resultados del Radar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lineaFiltro !== 'ALL' ? (
              <span className="font-medium text-foreground">{lineaFiltro}</span>
            ) : 'Todas las líneas'}
            {' · '}{results.length} empresa{results.length !== 1 ? 's' : ''}
            {conSenalCount > 0 && <> · <span className="text-green-400">{conSenalCount} con señal</span></>}
            {oroCount > 0 && <> · <span className="text-yellow-400">★ {oroCount} ORO</span></>}
          </p>
        </div>
        <Button onClick={exportarCSV} variant="outline" className="border-border text-muted-foreground hover:bg-surface-muted gap-2 sm:self-auto self-start">
          <Download size={15} />
          Exportar CSV
        </Button>
      </div>

      {/* ── Re-scan in-progress banner ── */}
      {rescan && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-800/60 bg-violet-950/20 p-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-violet-300 mb-1.5">
              Radar en curso · {rescan.empresa}
            </p>
            <AgentPipelineCard executionId={rescan.executionId} />
          </div>
          <button
            type="button"
            onClick={() => setRescan(null)}
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Tabs nivel 1: Líneas de negocio ── */}
      <div className="border-b border-border -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-0 overflow-x-auto">
          {LINEA_FILTER_OPTIONS.map(({ value, label, color, dot }) => {
            const isActive = lineaFiltro === value;
            return (
              <button
                key={value}
                onClick={() => { setLineaFiltro(value); setPagina(0); }}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  isActive
                    ? `${color} border-current`
                    : 'text-muted-foreground hover:text-muted-foreground border-transparent hover:border-border'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabs nivel 2: Tipo de datos ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'signals' | 'calificacion' | 'radar' | 'contactos')}
      >
        <TabsList>
          <TabsTrigger value="signals" className="flex items-center gap-2">
            <Activity size={14} /> Señales
          </TabsTrigger>
          <TabsTrigger value="calificacion" className="flex items-center gap-2">
            <ClipboardCheck size={14} /> Calificación
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-2">
            <Radar size={14} /> Radar Log
          </TabsTrigger>
          <TabsTrigger value="contactos" className="flex items-center gap-2">
            <Users size={14} /> Contactos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros secundarios */}
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Buscar empresa, país, señal..."
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(0); }}
          className="bg-surface-muted border-border text-foreground w-full sm:w-56"
        />
        <Select value={tierFiltro} onValueChange={v => { setTierFiltro(v ?? 'ALL'); setPagina(0); }}>
          <SelectTrigger className="bg-surface-muted border-border text-foreground w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-muted border-border">
            {TIER_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-gray-100">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="País..."
          value={paisFiltro}
          onChange={e => { setPaisFiltro(e.target.value); setPagina(0); }}
          className="bg-surface-muted border-border text-foreground w-28"
        />
        <Input type="date" value={desde}
          onChange={e => { setDesde(e.target.value); setPagina(0); }}
          className="bg-surface-muted border-border text-foreground w-36" title="Desde"
        />
        <Input type="date" value={hasta}
          onChange={e => { setHasta(e.target.value); setPagina(0); }}
          className="bg-surface-muted border-border text-foreground w-36" title="Hasta"
        />
        {(busqueda || tierFiltro !== 'ALL' || paisFiltro || desde || hasta) && (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-muted-foreground text-xs"
            onClick={() => { setBusqueda(''); setTierFiltro('ALL'); setPaisFiltro(''); setDesde(''); setHasta(''); setPagina(0); }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tab: Señales */}
      {activeTab === 'signals' && (
        <>
          {signalsError ? (
            <ErrorState
              error={signalsError}
              onRetry={() => refetchSignals()}
              title="No se pudieron cargar las señales"
            />
          ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="divide-y divide-gray-800/50">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
                      <div className="h-4 bg-surface-muted rounded w-40" />
                      <div className="h-4 bg-surface-muted rounded w-20" />
                      <div className="h-5 bg-surface-muted rounded-full w-16" />
                      <div className="h-5 bg-surface-muted rounded-full w-20" />
                      <div className="h-4 bg-surface-muted rounded w-28 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : table.getRowModel().rows.length === 0 ? (
                <EmptyState
                  icon={Table2}
                  title="Sin resultados"
                  description="No hay señales que coincidan con los filtros seleccionados."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      {table.getHeaderGroups().map(hg => (
                        <tr key={hg.id} className="border-b border-border bg-surface-muted/60">
                          {hg.headers.map(header => (
                            <th
                              key={header.id}
                              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide select-none"
                              onClick={header.column.getToggleSortingHandler()}
                              style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                            >
                              <div className="flex items-center gap-1">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === 'asc' && <span className="text-blue-400">↑</span>}
                                {header.column.getIsSorted() === 'desc' && <span className="text-blue-400">↓</span>}
                              </div>
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {table.getRowModel().rows.map(row => (
                        <tr
                          key={row.id}
                          className="hover:bg-surface-muted/40 transition-colors cursor-pointer"
                          onClick={() => setDetailSignal(row.original)}
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="px-4 py-3">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {totalPaginas > 1 && !signalsError && (
            <TablePagination
              page={pagina + 1}
              pageSize={pageSize}
              totalRows={results.length}
              onPageChange={(p) => setPagina(p - 1)}
              onPageSizeChange={(s) => { setPageSize(s); setPagina(0); }}
            />
          )}
        </>
      )}

      {/* Tab: Calificación */}
      {activeTab === 'calificacion' && (
        signalsError ? (
          <ErrorState
            error={signalsError}
            onRetry={() => refetchSignals()}
            title="No se pudieron cargar los datos de calificación"
          />
        ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando datos de calificación...</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardCheck size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-muted-foreground text-sm">No hay empresas calificadas aún.</p>
                <p className="text-gray-600 text-xs mt-1">Los registros aparecen aquí cuando el Agente Calificador procesa empresas.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-muted-foreground font-medium">Empresa</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">País</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Línea</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Score Cal.</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Tier</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{r.empresa}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.pais}</td>
                      <td className="px-4 py-2.5"><LineaBadge linea={r.linea} /></td>
                      <td className="px-4 py-2.5"><ScoreBadge score={r.scoreRadar} /></td>
                      <td className="px-4 py-2.5"><TierBadge tier={r.tier} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.fechaEscaneo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        )
      )}

      {/* Tab: Radar Log */}
      {activeTab === 'radar' && (
        signalsError ? (
          <ErrorState
            error={signalsError}
            onRetry={() => refetchSignals()}
            title="No se pudo cargar el log del radar"
          />
        ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando log del radar...</div>
          ) : results.filter(r => r.radarActivo === 'Sí').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Radar size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-muted-foreground text-sm">No hay señales detectadas aún.</p>
              </CardContent>
            </Card>
          ) : (
            results.filter(r => r.radarActivo === 'Sí').map((r, i) => (
              <Card
                key={i}
                className="hover:border-border transition-colors cursor-pointer"
                onClick={() => setDetailSignal(r)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Row 1: empresa + badges */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{r.empresa}</span>
                        <LineaBadge linea={r.linea} />
                        <ScoreBadge score={r.scoreRadar} />
                        {r.tipoSenal && (
                          <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                            {r.tipoSenal}
                          </span>
                        )}
                      </div>

                      {/* Row 2: MAOA badges */}
                      {(r.convergenciaMaoa || r.accionRecomendada || r.ventanaCompra) && (
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {r.ventanaCompra && (
                            <span className="text-xs text-blue-300 bg-blue-900/30 border border-blue-800/50 px-2 py-0.5 rounded-full">
                              ⏱ {r.ventanaCompra}
                            </span>
                          )}
                          {r.convergenciaMaoa && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              r.convergenciaMaoa === 'Verificada'
                                ? 'bg-green-900/40 text-green-300 border-green-800/50'
                                : r.convergenciaMaoa === 'Pendiente'
                                ? 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50'
                                : 'bg-surface-muted text-muted-foreground border-border'
                            }`}>
                              {r.convergenciaMaoa === 'Verificada' ? '🟢' : r.convergenciaMaoa === 'Pendiente' ? '🟡' : '🔴'} {r.convergenciaMaoa}
                            </span>
                          )}
                          {r.accionRecomendada && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              r.accionRecomendada === 'ABM ACTIVADO'
                                ? 'bg-violet-900/40 text-violet-300 border-violet-800/50'
                                : r.accionRecomendada === 'MONITOREO ACTIVO'
                                ? 'bg-blue-900/40 text-blue-300 border-blue-800/50'
                                : 'bg-surface-muted text-muted-foreground border-border'
                            }`}>
                              {r.accionRecomendada}
                            </span>
                          )}
                          {r.scoreFinalMaoa != null && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              Score {r.scoreFinalMaoa.toFixed(1)} · T{r.tierClasificacion}/{r.tirClasificacion}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-muted-foreground text-xs line-clamp-2">{r.descripcion}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">{r.fechaEscaneo}</p>
                      <p className="text-xs text-gray-600 mt-1">{r.pais}</p>
                      {r.montoInversion && r.montoInversion !== 'No reportado' && (
                        <p className="text-xs text-emerald-400 mt-1 font-medium">{r.montoInversion}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        )
      )}

      {/* Tab: Contactos */}
      {activeTab === 'contactos' && (
        contactosError ? (
          <ErrorState
            error={contactosError}
            onRetry={() => refetchContactos()}
            title="No se pudieron cargar los contactos"
          />
        ) : (
        <Card>
          <CardContent className="p-0">
            {loadingContactos ? (
              <div className="p-8 text-center text-muted-foreground">Cargando contactos...</div>
            ) : contactos.length === 0 ? (
              <div className="p-8 text-center">
                <Users size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-muted-foreground text-sm">No hay contactos prospectados aún.</p>
                <p className="text-gray-600 text-xs mt-1">Los contactos aparecen cuando el Agente Prospector extrae datos de Apollo.io.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-muted-foreground font-medium">Nombre</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Cargo</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Empresa</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Línea</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Estado HubSpot</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(contactos as Array<{
                    nombre?: string;
                    cargo?: string;
                    empresaNombre?: string;
                    lineaNegocio?: string;
                    hubspotStatus?: string;
                    createdAt?: string;
                  }>).map((c, i) => (
                    <tr key={i} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.cargo ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.empresaNombre ?? '—'}</td>
                      <td className="px-4 py-2.5">{c.lineaNegocio ? <LineaBadge linea={c.lineaNegocio} /> : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.hubspotStatus === 'sincronizado' ? 'bg-green-900/60 text-green-300' :
                          c.hubspotStatus === 'error' ? 'bg-red-900/60 text-red-300' :
                          'bg-yellow-900/60 text-yellow-300'
                        }`}>
                          {c.hubspotStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.createdAt?.split('T')[0] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        )
      )}

      {/* Panel de detalle */}
      <SignalDetailSheet
        signal={detailSignal}
        open={!!detailSignal}
        onClose={() => setDetailSignal(null)}
      />
    </div>
  );
}

// ── Page export — outer shell with Suspense boundary ──────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsLoadingSkeleton />}>
      <ResultsInner />
    </Suspense>
  );
}
