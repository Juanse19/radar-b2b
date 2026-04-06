'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState,
} from '@tanstack/react-table';
import { createResultsColumns } from './columns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ChevronLeft, ChevronRight, Activity, ClipboardCheck, Users, Radar } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { SignalDetailSheet } from '@/components/results/SignalDetailSheet';
import { Table2 } from 'lucide-react';
import { LineaBadge } from '@/components/LineaBadge';
import { ScoreBadge } from '@/components/ScoreBadge';
import { TierBadge } from '@/components/TierBadge';
import type { ResultadoRadar } from '@/lib/types';

const TIER_OPTIONS = [
  { value: 'ALL',       label: 'Todos los tiers' },
  { value: 'ORO',       label: '★ ORO (Score ≥ 8)' },
  { value: 'Monitoreo', label: 'Monitoreo (5-7)' },
  { value: 'Contexto',  label: 'Contexto (1-4)' },
  { value: 'Sin Señal', label: 'Sin Señal' },
];

const POR_PAGINA = 50;

const LINEA_FILTER_OPTIONS = [
  { value: 'ALL',            label: 'Todas',             color: 'text-gray-200',    dot: 'bg-gray-400' },
  { value: 'BHS',            label: '✈️ BHS',            color: 'text-blue-400',    dot: 'bg-blue-500' },
  { value: 'Cartón',         label: '📦 Cartón',         color: 'text-amber-400',   dot: 'bg-amber-500' },
  { value: 'Intralogística', label: '🏭 Intralogística', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  { value: 'Final de Línea', label: '📤 Final de Línea', color: 'text-violet-400',  dot: 'bg-violet-500' },
  { value: 'Motos',          label: '🏍️ Motos',          color: 'text-orange-400',  dot: 'bg-orange-500' },
  { value: 'SOLUMAT',        label: '🔧 SOLUMAT',        color: 'text-cyan-400',    dot: 'bg-cyan-500' },
];

// ── Loading skeleton shown while Suspense waits for useSearchParams ────────────

function ResultsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-gray-800 rounded w-56 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-40 animate-pulse" />
        </div>
        <div className="h-9 bg-gray-800 rounded w-32 animate-pulse" />
      </div>
      <div className="border-b border-gray-800 h-12 animate-pulse" />
      <div className="divide-y divide-gray-800/50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-40" />
            <div className="h-4 bg-gray-800 rounded w-20" />
            <div className="h-5 bg-gray-800 rounded-full w-16" />
            <div className="h-5 bg-gray-800 rounded-full w-20" />
            <div className="h-4 bg-gray-800 rounded w-28 ml-auto" />
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
  const [sorting,     setSorting]     = useState<SortingState>([{ id: 'scoreRadar', desc: true }]);
  const [detailSignal, setDetailSignal] = useState<ResultadoRadar | null>(null);
  const [activeTab, setActiveTab] = useState<'signals' | 'calificacion' | 'radar' | 'contactos'>('signals');

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

  const { data: rawResults = [], isLoading } = useQuery<ResultadoRadar[]>({
    queryKey: ['signals', lineaFiltro, tierFiltro, paisFiltro, desde, hasta],
    queryFn: () => fetch(signalUrl).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { data: contactos = [], isLoading: loadingContactos } = useQuery({
    queryKey: ['contacts', lineaFiltro],
    queryFn: () => fetch(`/api/contacts?${lineaFiltro !== 'ALL' ? `linea=${encodeURIComponent(lineaFiltro)}&` : ''}limit=200`).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
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

  const totalPaginas = Math.ceil(results.length / POR_PAGINA);
  const paginados = results.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const columns = useMemo(() => createResultsColumns((signal) => setDetailSignal(signal)), []);

  const table = useReactTable({
    data: paginados,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel:   getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function exportarCSV() {
    const headers = ['Empresa', 'País', 'Línea', 'Tier', 'Radar', 'Tipo Señal', 'Score', 'Tier Score', 'Descripción', 'Fuente', 'URL', 'Fecha'];
    const rows = results.map(r => [
      r.empresa, r.pais, r.linea, r.tier, r.radarActivo, r.tipoSenal,
      r.scoreRadar, r.ventanaCompra, r.descripcion.replace(/,/g, ';'),
      r.fuente, r.fuenteUrl, r.fechaEscaneo,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radar-b2b-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${results.length} señales exportadas`);
  }

  const oroCount        = rawResults.filter(r => (r.scoreRadar >= 8 || r.scoreRadar >= 80)).length;
  const conSenalCount   = rawResults.filter(r => r.radarActivo === 'Sí').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resultados del Radar</h1>
          <p className="text-gray-400 text-sm mt-1">
            {lineaFiltro !== 'ALL' ? (
              <span className="font-medium text-white">{lineaFiltro}</span>
            ) : 'Todas las líneas'}
            {' · '}{results.length} empresa{results.length !== 1 ? 's' : ''}
            {conSenalCount > 0 && <> · <span className="text-green-400">{conSenalCount} con señal</span></>}
            {oroCount > 0 && <> · <span className="text-yellow-400">★ {oroCount} ORO</span></>}
          </p>
        </div>
        <Button onClick={exportarCSV} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <Download size={15} />
          Exportar CSV
        </Button>
      </div>

      {/* ── Tabs nivel 1: Líneas de negocio ── */}
      <div className="border-b border-gray-800">
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
                    : 'text-gray-500 hover:text-gray-300 border-transparent hover:border-gray-600'
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
      <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-gray-800 w-fit">
        {[
          { id: 'signals',      label: 'Señales',      Icon: Activity },
          { id: 'calificacion', label: 'Calificación', Icon: ClipboardCheck },
          { id: 'radar',        label: 'Radar Log',    Icon: Radar },
          { id: 'contactos',    label: 'Contactos',    Icon: Users },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'signals' | 'calificacion' | 'radar' | 'contactos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <tab.Icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros secundarios */}
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Buscar empresa, país, señal..."
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(0); }}
          className="bg-gray-800 border-gray-700 text-white w-56"
        />
        <Select value={tierFiltro} onValueChange={v => { setTierFiltro(v ?? 'ALL'); setPagina(0); }}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {TIER_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-gray-100">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="País..."
          value={paisFiltro}
          onChange={e => { setPaisFiltro(e.target.value); setPagina(0); }}
          className="bg-gray-800 border-gray-700 text-white w-28"
        />
        <Input type="date" value={desde}
          onChange={e => { setDesde(e.target.value); setPagina(0); }}
          className="bg-gray-800 border-gray-700 text-white w-36" title="Desde"
        />
        <Input type="date" value={hasta}
          onChange={e => { setHasta(e.target.value); setPagina(0); }}
          className="bg-gray-800 border-gray-700 text-white w-36" title="Hasta"
        />
        {(busqueda || tierFiltro !== 'ALL' || paisFiltro || desde || hasta) && (
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-300 text-xs"
            onClick={() => { setBusqueda(''); setTierFiltro('ALL'); setPaisFiltro(''); setDesde(''); setHasta(''); setPagina(0); }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tab: Señales */}
      {activeTab === 'signals' && (
        <>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="divide-y divide-gray-800/50">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
                      <div className="h-4 bg-gray-800 rounded w-40" />
                      <div className="h-4 bg-gray-800 rounded w-20" />
                      <div className="h-5 bg-gray-800 rounded-full w-16" />
                      <div className="h-5 bg-gray-800 rounded-full w-20" />
                      <div className="h-4 bg-gray-800 rounded w-28 ml-auto" />
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
                        <tr key={hg.id} className="border-b border-gray-800 bg-gray-800/60">
                          {hg.headers.map(header => (
                            <th
                              key={header.id}
                              className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide select-none"
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
                          className="hover:bg-gray-800/40 transition-colors cursor-pointer"
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

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Página {pagina + 1} de {totalPaginas} · {results.length} resultados
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1"
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                  disabled={pagina >= totalPaginas - 1}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1"
                >
                  Siguiente <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab: Calificación */}
      {activeTab === 'calificacion' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Cargando datos de calificación...</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardCheck size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No hay empresas calificadas aún.</p>
                <p className="text-gray-600 text-xs mt-1">Los registros aparecen aquí cuando el Agente Calificador procesa empresas.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium">Empresa</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">País</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Línea</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Score Cal.</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Tier</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{r.empresa}</td>
                      <td className="px-4 py-2.5 text-gray-400">{r.pais}</td>
                      <td className="px-4 py-2.5"><LineaBadge linea={r.linea} /></td>
                      <td className="px-4 py-2.5"><ScoreBadge score={r.scoreRadar} /></td>
                      <td className="px-4 py-2.5"><TierBadge tier={r.tier} /></td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{r.fechaEscaneo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Radar Log */}
      {activeTab === 'radar' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Cargando log del radar...</div>
          ) : results.filter(r => r.radarActivo === 'Sí').length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-8 text-center">
                <Radar size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No hay señales detectadas aún.</p>
              </CardContent>
            </Card>
          ) : (
            results.filter(r => r.radarActivo === 'Sí').map((r, i) => (
              <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-white text-sm">{r.empresa}</span>
                        <LineaBadge linea={r.linea} />
                        <ScoreBadge score={r.scoreRadar} />
                        <span className="text-xs text-gray-500">{r.tipoSenal}</span>
                      </div>
                      <p className="text-gray-400 text-xs line-clamp-2">{r.descripcion}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500">{r.fechaEscaneo}</p>
                      <p className="text-xs text-gray-600 mt-1">{r.pais}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Contactos */}
      {activeTab === 'contactos' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            {loadingContactos ? (
              <div className="p-8 text-center text-gray-500">Cargando contactos...</div>
            ) : contactos.length === 0 ? (
              <div className="p-8 text-center">
                <Users size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No hay contactos prospectados aún.</p>
                <p className="text-gray-600 text-xs mt-1">Los contactos aparecen cuando el Agente Prospector extrae datos de Apollo.io.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium">Nombre</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Cargo</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Empresa</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Línea</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Estado HubSpot</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Fecha</th>
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
                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{c.cargo ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-300 text-xs">{c.empresaNombre ?? '—'}</td>
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
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{c.createdAt?.split('T')[0] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
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
