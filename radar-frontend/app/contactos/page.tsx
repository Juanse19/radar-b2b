'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState, type RowSelectionState,
} from '@tanstack/react-table';
import { createContactsColumns } from './columns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import {
  Users, ChevronLeft, ChevronRight, Send, Loader2,
  Plane, Package, Warehouse, Minus, Plus,
  CheckCircle, AlertCircle, Database, PenLine, Search,
} from 'lucide-react';
import type { Contacto, LineaNegocio } from '@/lib/types';

// ── Líneas disponibles ────────────────────────────────────────────────────────

const LINEA_OPTIONS: {
  value: LineaNegocio;
  shortLabel: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
}[] = [
  {
    value: 'BHS',
    shortLabel: 'BHS',
    desc: 'Aeropuertos y cargo',
    Icon: Plane,
    color: 'text-blue-400',
    activeBg: 'bg-blue-950/60',
    activeBorder: 'border-blue-500',
  },
  {
    value: 'Cartón',
    shortLabel: 'Cartón',
    desc: 'Corrugadoras, empaque',
    Icon: Package,
    color: 'text-amber-400',
    activeBg: 'bg-amber-950/60',
    activeBorder: 'border-amber-500',
  },
  {
    value: 'Intralogística',
    shortLabel: 'Intralogística',
    desc: 'CEDI, WMS, ASRS',
    Icon: Warehouse,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-950/60',
    activeBorder: 'border-emerald-500',
  },
];

const POR_PAGINA = 50;
const AVAILABLE_TOKENS = 2540;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactosPage() {
  const queryClient = useQueryClient();

  // ── Prospección state ─────────────────────────────────────────────────────
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaNegocio>('BHS');
  const [modo, setModo] = useState<'lote' | 'manual'>('lote');
  const [batchSize, setBatchSize] = useState(5);
  const [empresasManual, setEmpresasManual] = useState('');
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState(3);
  const [prospectando, setProspectando] = useState(false);
  const [prospectError, setProspectError] = useState<string | null>(null);
  const [prospectSuccess, setProspectSuccess] = useState(false);

  // ── Tabla state ───────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [lineaFiltro, setLineaFiltro] = useState('ALL');
  const [statusFiltro, setStatusFiltro] = useState('ALL');
  const [pagina, setPagina] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: rawContactos = [], isLoading } = useQuery<Contacto[]>({
    queryKey: ['contactos', lineaFiltro, statusFiltro, busqueda],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (lineaFiltro  !== 'ALL') queryParams.set('linea', lineaFiltro);
      if (statusFiltro !== 'ALL') queryParams.set('hubspot_status', statusFiltro);
      if (busqueda)               queryParams.set('q', busqueda);
      queryParams.set('limit', '500');
      const res = await fetch(`/api/contacts?${queryParams}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: countData } = useQuery<{ total: number }>({
    queryKey: ['contactos', 'count'],
    queryFn: () => fetch('/api/contacts?count=true').then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error en sync');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.sincronizados} contacto${data.sincronizados !== 1 ? 's' : ''} enviado${data.sincronizados !== 1 ? 's' : ''} a HubSpot`);
      setRowSelection({});
      queryClient.invalidateQueries({ queryKey: ['contactos'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar');
    },
  });

  // ── Tabla ─────────────────────────────────────────────────────────────────
  const contactos = rawContactos;
  const totalPaginas = Math.ceil(contactos.length / POR_PAGINA);
  const paginados = useMemo(
    () => contactos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    [contactos, pagina],
  );

  const columns = useMemo(() => createContactsColumns(), []);
  const table = useReactTable({
    data: paginados,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel:   getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
  });

  const selectedIds = Object.keys(rowSelection).filter(k => rowSelection[k]).map(Number);

  // ── Prospección ───────────────────────────────────────────────────────────
  const empresasManualList = empresasManual.split('\n').map(s => s.trim()).filter(Boolean);
  const empresasCount = modo === 'manual' ? empresasManualList.length : batchSize;
  const tokenEstimate = empresasCount * contactosPorEmpresa;
  const tokenPct = Math.min(100, Math.round((tokenEstimate / AVAILABLE_TOKENS) * 100));
  const tokenOk = tokenEstimate <= AVAILABLE_TOKENS;

  const activeOption = useMemo(
    () => LINEA_OPTIONS.find(l => l.value === lineaSeleccionada) ?? LINEA_OPTIONS[0]!,
    [lineaSeleccionada],
  );

  async function lanzarProspeccion() {
    if (empresasCount === 0) {
      toast.error('Ingresa al menos una empresa para prospectar');
      return;
    }
    setProspectando(true);
    setProspectError(null);
    setProspectSuccess(false);
    try {
      const res = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linea: lineaSeleccionada,
          empresas: modo === 'manual' ? empresasManualList : [],
          batchSize,
          contactosPorEmpresa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error lanzando prospección');
      setProspectSuccess(true);
      toast.success(
        `Prospección iniciada — ${data.empresasEnviadas} empresas en ${lineaSeleccionada}. Los contactos aparecerán en minutos.`,
      );
      queryClient.invalidateQueries({ queryKey: ['contactos'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setProspectError(msg);
      toast.error(msg);
    } finally {
      setProspectando(false);
    }
  }

  const pendienteCount    = rawContactos.filter(c => c.hubspotStatus === 'pendiente').length;
  const sincronizadoCount = rawContactos.filter(c => c.hubspotStatus === 'sincronizado').length;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-800 rounded-lg border border-gray-700">
              <Users size={20} className="text-gray-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Contactos Apollo</h1>
              <p className="text-gray-500 text-sm">
                {countData
                  ? `${countData.total} totales · ${sincronizadoCount} en HubSpot · ${pendienteCount} pendientes`
                  : 'Prospección de contactos por línea de negocio'}
              </p>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <Button
              onClick={() => syncMutation.mutate(selectedIds)}
              disabled={syncMutation.isPending}
              className="bg-orange-700 hover:bg-orange-600 gap-2 shrink-0"
            >
              {syncMutation.isPending
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />}
              Enviar {selectedIds.length} a HubSpot
            </Button>
          )}
        </div>

        {/* ── Panel de prospección ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT: 3/5 — Línea + entrada empresas */}
          <div className="lg:col-span-3 space-y-5">

            {/* Selector de línea */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                Línea de negocio
              </p>
              <div className="grid grid-cols-3 gap-3">
                {LINEA_OPTIONS.map(opt => {
                  const isActive = lineaSeleccionada === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setLineaSeleccionada(opt.value)}
                      className={`
                        relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all
                        ${isActive
                          ? `${opt.activeBg} ${opt.activeBorder} shadow-lg`
                          : 'bg-gray-900/60 border-gray-700/60 hover:border-gray-600 hover:bg-gray-800/60'}
                      `}
                    >
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                      )}
                      <div className={`mb-2 ${isActive ? opt.color : 'text-gray-500'}`}>
                        <opt.Icon size={24} />
                      </div>
                      <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {opt.shortLabel}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle de modo */}
            <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-gray-800 w-fit">
              {[
                { id: 'lote',   label: 'Lote automático', icon: <Database size={13} /> },
                { id: 'manual', label: 'Ingresar empresas', icon: <PenLine size={13} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setModo(tab.id as 'lote' | 'manual')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    modo === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modo lote */}
            {modo === 'lote' && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-gray-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                    <Database size={12} /> Lote automático — {activeOption.shortLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-gray-400">
                    Toma las <span className="text-white font-medium">{batchSize} empresas</span> con mayor
                    prioridad en línea <span className={`font-medium ${activeOption.color}`}>{activeOption.shortLabel}</span> y
                    extrae contactos vía Apollo.
                  </p>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Empresas a prospectar</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setBatchSize(p => Math.max(1, p - 1))}
                        className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-2xl font-mono font-bold text-white w-10 text-center">{batchSize}</span>
                      <button
                        onClick={() => setBatchSize(p => Math.min(50, p + 1))}
                        className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-xs text-gray-600">máx. 50</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Modo manual */}
            {modo === 'manual' && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-gray-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                    <PenLine size={12} /> Empresas específicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-sm text-gray-400">
                    Ingresa una empresa por línea. Apollo buscará los contactos de cada una.
                  </p>
                  <textarea
                    value={empresasManual}
                    onChange={e => setEmpresasManual(e.target.value)}
                    placeholder={'Empresa ABC S.A.\nLogística del Norte\nAeropuerto Internacional...'}
                    rows={6}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    {empresasManualList.length} empresa{empresasManualList.length !== 1 ? 's' : ''} ingresada{empresasManualList.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT: 2/5 — Config + trigger */}
          <div className="lg:col-span-2 space-y-4">

            {/* Línea activa */}
            <div className={`p-4 rounded-2xl border-2 ${activeOption.activeBg} ${activeOption.activeBorder}`}>
              <div className={`${activeOption.color} mb-2`}><activeOption.Icon size={24} /></div>
              <p className="text-white font-semibold">{activeOption.shortLabel}</p>
              <p className="text-xs text-gray-400 mt-0.5">{activeOption.desc}</p>
            </div>

            {/* Contactos por empresa */}
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
                    Contactos por empresa
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setContactosPorEmpresa(p => Math.max(1, p - 1))}
                      className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-2xl font-mono font-bold text-white w-8 text-center">
                      {contactosPorEmpresa}
                    </span>
                    <button
                      onClick={() => setContactosPorEmpresa(p => Math.min(5, p + 1))}
                      className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-gray-600">máx. 5</span>
                  </div>
                </div>

                {/* Token estimate */}
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                      Tokens Apollo
                    </p>
                    <p className={`text-sm font-mono font-bold ${tokenOk ? 'text-green-400' : 'text-red-400'}`}>
                      {tokenEstimate.toLocaleString()} / {AVAILABLE_TOKENS.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${tokenOk ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${tokenPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
                    {empresasCount} empresa{empresasCount !== 1 ? 's' : ''} × {contactosPorEmpresa} contacto{contactosPorEmpresa !== 1 ? 's' : ''}
                  </p>
                  {!tokenOk && (
                    <p className="text-xs text-red-400 mt-1">
                      Supera los tokens disponibles. Reduce el lote o contactos.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Botón trigger */}
            <Button
              onClick={lanzarProspeccion}
              disabled={prospectando || empresasCount === 0 || !tokenOk}
              className="w-full h-12 bg-blue-700 hover:bg-blue-600 gap-2 text-base font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {prospectando ? (
                <><Loader2 size={18} className="animate-spin" /> Buscando contactos...</>
              ) : (
                <><Search size={18} /> Prospectar contactos</>
              )}
            </Button>

            {/* Estado */}
            {prospectSuccess && !prospectando && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-950/30 border border-green-900/50 rounded-lg px-3 py-2.5">
                <CheckCircle size={15} />
                Prospección iniciada — revisa la tabla en unos minutos
              </div>
            )}
            {prospectError && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {prospectError}
              </div>
            )}
          </div>
        </div>

        {/* ── Separador ─────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Contactos prospectados</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} · {sincronizadoCount} en HubSpot
              </p>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap items-center">
              <Input
                placeholder="Buscar nombre, cargo o empresa..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(0); setRowSelection({}); }}
                className="bg-gray-800 border-gray-700 text-white w-56"
              />
              <Select value={lineaFiltro} onValueChange={v => { setLineaFiltro(v ?? 'ALL'); setPagina(0); setRowSelection({}); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="ALL"            className="text-gray-100">Todas las líneas</SelectItem>
                  <SelectItem value="BHS"            className="text-gray-100">✈️ BHS</SelectItem>
                  <SelectItem value="Cartón"         className="text-gray-100">📦 Cartón</SelectItem>
                  <SelectItem value="Intralogística" className="text-gray-100">🏭 Intralogística</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v ?? 'ALL'); setPagina(0); setRowSelection({}); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="ALL"          className="text-gray-100">Todos</SelectItem>
                  <SelectItem value="pendiente"    className="text-gray-100">⏳ Pendiente</SelectItem>
                  <SelectItem value="sincronizado" className="text-gray-100">✅ Sincronizado</SelectItem>
                  <SelectItem value="error"        className="text-gray-100">❌ Error</SelectItem>
                </SelectContent>
              </Select>
              {selectedIds.length > 0 && (
                <span className="text-xs text-gray-400">
                  {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Tabla */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="divide-y divide-gray-800/50">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
                      <div className="h-4 w-4 bg-gray-800 rounded" />
                      <div className="h-4 bg-gray-800 rounded w-36" />
                      <div className="h-4 bg-gray-800 rounded w-32" />
                      <div className="h-4 bg-gray-800 rounded w-40" />
                      <div className="h-4 bg-gray-800 rounded w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : table.getRowModel().rows.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Sin contactos"
                  description="Usa el panel de arriba para prospectar empresas, o espera que el Agente Prospector los extraiga automáticamente."
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
                                {header.column.getIsSorted() === 'asc'  && <span className="text-blue-400">↑</span>}
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
                          className={`transition-colors ${row.getIsSelected() ? 'bg-blue-950/30' : 'hover:bg-gray-800/30'}`}
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

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">
                Página {pagina + 1} de {totalPaginas} · {contactos.length} contactos
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setPagina(p => Math.max(0, p - 1)); setRowSelection({}); }}
                  disabled={pagina === 0}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1"
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setPagina(p => Math.min(totalPaginas - 1, p + 1)); setRowSelection({}); }}
                  disabled={pagina >= totalPaginas - 1}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1"
                >
                  Siguiente <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
