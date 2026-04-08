'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import {
  Users, ChevronLeft, ChevronRight, Send, Loader2,
  Plane, Package, Warehouse, Minus, Plus,
  CheckCircle, AlertCircle, Database, Search, ClipboardList,
} from 'lucide-react';
import type { Contacto, LineaNegocio, ProspeccionLog, Empresa } from '@/lib/types';

// ── Líneas disponibles ────────────────────────────────────────────────────────

const LINEA_OPTIONS: {
  value: LineaNegocio;
  shortLabel: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
  dotColor: string;
}[] = [
  {
    value: 'BHS',
    shortLabel: 'BHS',
    desc: 'Aeropuertos y cargo',
    Icon: Plane,
    color: 'text-blue-400',
    activeBg: 'bg-blue-950/60',
    activeBorder: 'border-blue-500',
    dotColor: 'bg-blue-400',
  },
  {
    value: 'Cartón',
    shortLabel: 'Cartón',
    desc: 'Corrugadoras, empaque',
    Icon: Package,
    color: 'text-amber-400',
    activeBg: 'bg-amber-950/60',
    activeBorder: 'border-amber-500',
    dotColor: 'bg-amber-400',
  },
  {
    value: 'Intralogística',
    shortLabel: 'Intralogística',
    desc: 'CEDI, WMS, ASRS',
    Icon: Warehouse,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-950/60',
    activeBorder: 'border-emerald-500',
    dotColor: 'bg-emerald-400',
  },
];

const POR_PAGINA = 50;
const AVAILABLE_TOKENS = 2540;

// ── Helpers ───────────────────────────────────────────────────────────────────

const isTimestampId = (id: string) => /^\d{11,}$/.test(id);

function formatLogDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactosPage() {
  const queryClient = useQueryClient();

  // ── Prospección state ─────────────────────────────────────────────────────
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaNegocio>('BHS');
  const [modo, setModo] = useState<'lote' | 'manual'>('lote');
  const [batchSize, setBatchSize] = useState(5);
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState(3);
  const [prospectando, setProspectando] = useState(false);
  const [prospectError, setProspectError] = useState<string | null>(null);
  const [prospectSuccess, setProspectSuccess] = useState(false);

  // ── Company Selector state ────────────────────────────────────────────────
  const [empresaSearch, setEmpresaSearch] = useState('');
  const [selectedEmpresaIds, setSelectedEmpresaIds] = useState<Set<string>>(new Set());

  // ── Dialog / execution state ──────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionRunning, setExecutionRunning] = useState(false);
  const [logIds, setLogIds] = useState<number[]>([]);
  const [processingEmpresas, setProcessingEmpresas] = useState<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tabla state ───────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [busquedaEmpresa, setBusquedaEmpresa] = useState('');
  const [lineaFiltro, setLineaFiltro] = useState('ALL');
  const [statusFiltro, setStatusFiltro] = useState('ALL');
  const [pagina, setPagina] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ── Company Selector Query ────────────────────────────────────────────────
  const { data: companiesData = [] } = useQuery<Empresa[]>({
    queryKey: ['companiesSelector', lineaSeleccionada],
    queryFn: () =>
      fetch(`/api/companies?linea=${lineaSeleccionada}&limit=500`)
        .then(r => r.json())
        .then(d => Array.isArray(d) ? d : []),
    enabled: modo === 'manual',
    staleTime: 5 * 60 * 1000,
  });

  // Reset selection when linea changes
  useEffect(() => {
    setSelectedEmpresaIds(new Set());
    setEmpresaSearch('');
  }, [lineaSeleccionada]);

  // ── Filtered companies list ───────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    if (!empresaSearch.trim()) return companiesData;
    const q = empresaSearch.toLowerCase();
    return companiesData.filter(e => e.nombre.toLowerCase().includes(q));
  }, [companiesData, empresaSearch]);

  // Selected empresa names (for prospecting payload)
  const selectedEmpresaNames = useMemo(() => {
    return companiesData
      .filter(e => selectedEmpresaIds.has(e.id))
      .map(e => e.nombre);
  }, [companiesData, selectedEmpresaIds]);

  // ── Contacts Query ────────────────────────────────────────────────────────
  const queryParams = new URLSearchParams();
  if (lineaFiltro !== 'ALL') queryParams.set('linea', lineaFiltro);
  if (statusFiltro !== 'ALL') queryParams.set('hubspot_status', statusFiltro);
  if (busqueda) queryParams.set('q', busqueda);
  queryParams.set('limit', '500');

  const { data: rawContactos = [], isLoading } = useQuery<Contacto[]>({
    queryKey: ['contactos', lineaFiltro, statusFiltro, busqueda],
    queryFn: () =>
      fetch(`/api/contacts?${queryParams}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { data: countData } = useQuery<{ total: number }>({
    queryKey: ['contactos', 'count'],
    queryFn: () => fetch('/api/contacts?count=true').then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  // ── Prospection Logs Query ────────────────────────────────────────────────
  const { data: prospeccionLogs = [], isLoading: logsLoading } = useQuery<ProspeccionLog[]>({
    queryKey: ['prospeccionLogs', lineaFiltro],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (lineaFiltro !== 'ALL') params.set('linea', lineaFiltro);
      return fetch(`/api/prospect/logs?${params}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.some((l: ProspeccionLog) => l.estado === 'running')) {
        return 10_000;
      }
      return false;
    },
  });

  // ── HubSpot Sync Mutation ─────────────────────────────────────────────────
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

  // ── Contacts Table ────────────────────────────────────────────────────────
  const contactosFiltrados = useMemo(() => {
    if (!busquedaEmpresa.trim()) return rawContactos;
    const q = busquedaEmpresa.toLowerCase();
    return rawContactos.filter(c => (c.empresaNombre ?? '').toLowerCase().includes(q));
  }, [rawContactos, busquedaEmpresa]);

  const totalPaginas = Math.ceil(contactosFiltrados.length / POR_PAGINA);
  const paginados = useMemo(
    () => contactosFiltrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    [contactosFiltrados, pagina],
  );

  const columns = useMemo(() => createContactsColumns(), []);
  const table = useReactTable({
    data: paginados,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
  });

  const selectedIds = Object.keys(rowSelection).filter(k => rowSelection[k]).map(Number);

  // ── Polling cleanup ───────────────────────────────────────────────────────
  function stopPolling() {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // ── Update logs helper ────────────────────────────────────────────────────
  async function updateLogs(ids: number[], estado: 'success' | 'error') {
    await Promise.allSettled(
      ids.map(id =>
        fetch(`/api/prospect/logs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado, finished_at: new Date().toISOString() }),
        }),
      ),
    );
  }

  // ── Start execution polling ───────────────────────────────────────────────
  function startPolling(execId: string, capturedLogIds: number[]) {
    stopPolling();

    // Timestamp fallback — skip real polling
    if (isTimestampId(execId)) {
      const timeout = setTimeout(() => {
        setDialogOpen(false);
        setExecutionRunning(false);
        setExecutionId(null);
        toast.success('Prospección enviada — los resultados aparecerán en minutos');
        queryClient.invalidateQueries({ queryKey: ['prospeccionLogs'] });
      }, 5000);
      // Store timeout in ref as a hack (interval of 0 won't fire early)
      pollingRef.current = timeout as unknown as ReturnType<typeof setInterval>;
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/executions/${execId}`);
        if (!res.ok) return;
        const status: { id: string; status: string; finishedAt?: string } = await res.json();

        if (status.status === 'success') {
          stopPolling();
          setDialogOpen(false);
          setExecutionRunning(false);
          setExecutionId(null);
          toast.success('Prospección completada — los contactos aparecerán en la tabla en breve');
          await updateLogs(capturedLogIds, 'success');
          queryClient.invalidateQueries({ queryKey: ['contactos'] });
          queryClient.invalidateQueries({ queryKey: ['prospeccionLogs'] });
        } else if (status.status === 'error') {
          stopPolling();
          setDialogOpen(false);
          setExecutionRunning(false);
          setExecutionId(null);
          toast.error('Error en la prospección — revisa los logs de N8N');
          await updateLogs(capturedLogIds, 'error');
          queryClient.invalidateQueries({ queryKey: ['prospeccionLogs'] });
        }
      } catch {
        // Network error — keep polling
      }
    }, 3000);
  }

  // ── Prospección ───────────────────────────────────────────────────────────
  const empresasManualList = modo === 'manual' ? selectedEmpresaNames : [];
  const empresasCount = modo === 'manual' ? selectedEmpresaIds.size : batchSize;
  const tokenEstimate = empresasCount * contactosPorEmpresa;
  const tokenPct = Math.min(100, Math.round((tokenEstimate / AVAILABLE_TOKENS) * 100));
  const tokenOk = tokenEstimate <= AVAILABLE_TOKENS;

  const activeOption = LINEA_OPTIONS.find(l => l.value === lineaSeleccionada) ?? LINEA_OPTIONS[0]!;

  async function lanzarProspeccion() {
    if (empresasCount === 0) {
      toast.error('Selecciona al menos una empresa para prospectar');
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

      const execId: string = data.executionId ?? '';
      const capturedLogIds: number[] = Array.isArray(data.logIds) ? data.logIds : [];
      const empresasEnviadas: string[] = Array.isArray(data.empresasEnviadas)
        ? data.empresasEnviadas
        : modo === 'manual'
        ? empresasManualList
        : [];

      setExecutionId(execId);
      setLogIds(capturedLogIds);
      setProcessingEmpresas(empresasEnviadas);
      setExecutionRunning(true);
      setDialogOpen(true);
      setProspectSuccess(true);

      startPolling(execId, capturedLogIds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setProspectError(msg);
      toast.error(msg);
    } finally {
      setProspectando(false);
    }
  }

  const pendienteCount = rawContactos.filter(c => c.hubspotStatus === 'pendiente').length;
  const sincronizadoCount = rawContactos.filter(c => c.hubspotStatus === 'sincronizado').length;

  // ── Company selector handlers ─────────────────────────────────────────────
  function toggleEmpresa(id: string) {
    setSelectedEmpresaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedEmpresaIds(new Set(filteredCompanies.map(e => e.id)));
  }

  function clearAll() {
    setSelectedEmpresaIds(new Set());
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-muted rounded-lg border border-border">
              <Users size={20} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Contactos Apollo</h1>
              <p className="text-muted-foreground text-sm">
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
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-semibold">
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
                          : 'bg-surface/60 border-border/60 hover:border-border hover:bg-surface-muted/60'}
                      `}
                    >
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                      )}
                      <div className={`mb-2 ${isActive ? opt.color : 'text-muted-foreground'}`}>
                        <opt.Icon size={24} />
                      </div>
                      <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
                        {opt.shortLabel}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle de modo */}
            <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit">
              {[
                { id: 'lote', label: 'Lote automático', Icon: Database as React.ElementType },
                { id: 'manual', label: 'Selección de empresa', Icon: Search as React.ElementType },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setModo(tab.id as 'lote' | 'manual')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    modo === tab.id
                      ? 'bg-blue-600 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-gray-200 hover:bg-surface-muted'
                  }`}
                >
                  <tab.Icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modo lote */}
            {modo === 'lote' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-muted-foreground text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                    <Database size={12} /> Lote automático — {activeOption.shortLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Toma las <span className="text-white font-medium">{batchSize} empresas</span> con mayor
                    prioridad en línea <span className={`font-medium ${activeOption.color}`}>{activeOption.shortLabel}</span> y
                    extrae contactos vía Apollo.
                  </p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Empresas a prospectar</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setBatchSize(p => Math.max(1, p - 1))}
                        className="w-8 h-8 rounded-lg bg-surface-muted border border-border text-muted-foreground hover:bg-surface-muted flex items-center justify-center transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-2xl font-mono font-bold text-foreground w-10 text-center">{batchSize}</span>
                      <button
                        onClick={() => setBatchSize(p => Math.min(50, p + 1))}
                        className="w-8 h-8 rounded-lg bg-surface-muted border border-border text-muted-foreground hover:bg-surface-muted flex items-center justify-center transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-xs text-gray-600">máx. 50</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Modo manual — Company Picker */}
            {modo === 'manual' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-muted-foreground text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                    <Search size={12} /> Selección de empresas — {activeOption.shortLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Search + actions row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Filtrar empresas..."
                        value={empresaSearch}
                        onChange={e => setEmpresaSearch(e.target.value)}
                        className="bg-surface-muted border-border text-foreground text-sm pl-8 h-8"
                      />
                    </div>
                    <button
                      onClick={selectAll}
                      className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap px-2 py-1 rounded hover:bg-surface-muted transition-colors"
                    >
                      Seleccionar todas
                    </button>
                    <button
                      onClick={clearAll}
                      className="text-xs text-muted-foreground hover:text-muted-foreground px-2 py-1 rounded hover:bg-surface-muted transition-colors"
                    >
                      Limpiar
                    </button>
                  </div>

                  {/* Selected count */}
                  <p className="text-xs text-muted-foreground">
                    {selectedEmpresaIds.size > 0
                      ? <span className="text-blue-400 font-medium">{selectedEmpresaIds.size} empresa{selectedEmpresaIds.size !== 1 ? 's' : ''} seleccionada{selectedEmpresaIds.size !== 1 ? 's' : ''}</span>
                      : 'Ninguna empresa seleccionada'}
                  </p>

                  {/* Scrollable list */}
                  <div
                    className="overflow-y-auto rounded-lg border border-border bg-surface-muted/50 divide-y divide-border"
                    style={{ maxHeight: '280px' }}
                  >
                    {filteredCompanies.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        {companiesData.length === 0
                          ? 'Cargando empresas...'
                          : 'No hay empresas que coincidan con la búsqueda'}
                      </div>
                    ) : (
                      filteredCompanies.map(empresa => {
                        const isChecked = selectedEmpresaIds.has(empresa.id);
                        const lineaOpt = LINEA_OPTIONS.find(l => l.value === empresa.linea);
                        return (
                          <label
                            key={empresa.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-950/30' : 'hover:bg-surface-muted/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEmpresa(empresa.id)}
                              className="w-4 h-4 rounded border-border bg-surface-muted text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 shrink-0"
                            />
                            {lineaOpt && (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${lineaOpt.dotColor}`}
                                title={empresa.linea}
                              />
                            )}
                            <span className="text-sm text-gray-200 truncate flex-1">{empresa.nombre}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{empresa.pais}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
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
              <p className="text-xs text-muted-foreground mt-0.5">{activeOption.desc}</p>
            </div>

            {/* Contactos por empresa */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">
                    Contactos por empresa
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setContactosPorEmpresa(p => Math.max(1, p - 1))}
                      className="w-8 h-8 rounded-lg bg-surface-muted border border-border text-muted-foreground hover:bg-surface-muted flex items-center justify-center transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-2xl font-mono font-bold text-foreground w-8 text-center">
                      {contactosPorEmpresa}
                    </span>
                    <button
                      onClick={() => setContactosPorEmpresa(p => Math.min(5, p + 1))}
                      className="w-8 h-8 rounded-lg bg-surface-muted border border-border text-muted-foreground hover:bg-surface-muted flex items-center justify-center transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-gray-600">máx. 5</span>
                  </div>
                </div>

                {/* Token estimate */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                      Tokens Apollo
                    </p>
                    <p className={`text-sm font-mono font-bold ${tokenOk ? 'text-green-400' : 'text-red-400'}`}>
                      {tokenEstimate.toLocaleString()} / {AVAILABLE_TOKENS.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
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
              disabled={prospectando || dialogOpen || empresasCount === 0 || !tokenOk}
              className="w-full h-12 bg-blue-700 hover:bg-blue-600 gap-2 text-base font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {prospectando ? (
                <><Loader2 size={18} className="animate-spin" /> Iniciando...</>
              ) : (
                <><Search size={18} /> Prospectar contactos</>
              )}
            </Button>

            {/* Estado */}
            {prospectSuccess && !prospectando && !dialogOpen && (
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

        {/* ── Execution Dialog ───────────────────────────────────────────── */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open && executionRunning) return; // block close while running
            setDialogOpen(open);
            if (!open) {
              setExecutionId(null);
              setExecutionRunning(false);
              stopPolling();
            }
          }}
        >
          <DialogContent showCloseButton={false} className="text-foreground max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-base">Prospección en curso</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 size={40} className="animate-spin text-blue-400" />
              <p className="text-sm text-muted-foreground font-medium">Ejecutando WF03 Prospector...</p>

              {/* empresa list */}
              {processingEmpresas.length > 0 && (
                <div className="w-full bg-surface-muted rounded-lg px-4 py-3 space-y-1 text-xs text-muted-foreground">
                  {processingEmpresas.slice(0, 5).map((name, i) => (
                    <p key={i} className="truncate">· {name}</p>
                  ))}
                  {processingEmpresas.length > 5 && (
                    <p className="text-muted-foreground">y {processingEmpresas.length - 5} más...</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">Polling cada 3 segundos...</p>

              <Button
                variant="outline"
                size="sm"
                disabled={executionRunning}
                onClick={() => {
                  if (!executionRunning) {
                    setDialogOpen(false);
                    setExecutionId(null);
                    stopPolling();
                  }
                }}
                className="border-border text-muted-foreground hover:bg-surface-muted disabled:opacity-40 mt-2"
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Bottom section: Tabs ───────────────────────────────────────── */}
        <div className="border-t border-border pt-6">
          <Tabs defaultValue="contactos">
            <TabsList className="bg-surface border border-border mb-5 h-9">
              <TabsTrigger value="contactos" className="text-muted-foreground data-active:text-white text-sm px-5">
                Contactos
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-muted-foreground data-active:text-white text-sm px-5">
                Log de Prospección
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Contactos ──────────────────────────────────────────── */}
            <TabsContent value="contactos">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Contactos prospectados</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {contactosFiltrados.length} contacto{contactosFiltrados.length !== 1 ? 's' : ''} · {sincronizadoCount} en HubSpot
                  </p>
                </div>

                {/* Filtros */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Input
                    placeholder="Buscar nombre, cargo..."
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setPagina(0); setRowSelection({}); }}
                    className="bg-surface-muted border-border text-foreground w-44"
                  />
                  <Input
                    placeholder="Buscar empresa..."
                    value={busquedaEmpresa}
                    onChange={e => { setBusquedaEmpresa(e.target.value); setPagina(0); setRowSelection({}); }}
                    className="bg-surface-muted border-border text-foreground w-40"
                  />
                  <Select value={lineaFiltro} onValueChange={v => { setLineaFiltro(v ?? 'ALL'); setPagina(0); setRowSelection({}); }}>
                    <SelectTrigger className="bg-surface-muted border-border text-foreground w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-muted border-border">
                      <SelectItem value="ALL" className="text-gray-100">Todas las líneas</SelectItem>
                      <SelectItem value="BHS" className="text-gray-100">BHS</SelectItem>
                      <SelectItem value="Cartón" className="text-gray-100">Cartón</SelectItem>
                      <SelectItem value="Intralogística" className="text-gray-100">Intralogística</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v ?? 'ALL'); setPagina(0); setRowSelection({}); }}>
                    <SelectTrigger className="bg-surface-muted border-border text-foreground w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-muted border-border">
                      <SelectItem value="ALL" className="text-gray-100">Todos</SelectItem>
                      <SelectItem value="pendiente" className="text-gray-100">Pendiente</SelectItem>
                      <SelectItem value="sincronizado" className="text-gray-100">Sincronizado</SelectItem>
                      <SelectItem value="error" className="text-gray-100">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Contacts Table */}
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="divide-y divide-gray-800/50">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
                          <div className="h-4 w-4 bg-surface-muted rounded" />
                          <div className="h-4 bg-surface-muted rounded w-36" />
                          <div className="h-4 bg-surface-muted rounded w-32" />
                          <div className="h-4 bg-surface-muted rounded w-40" />
                          <div className="h-4 bg-surface-muted rounded w-20 ml-auto" />
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
                              className={`transition-colors ${row.getIsSelected() ? 'bg-blue-950/30' : 'hover:bg-surface-muted/30'}`}
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
                  <span className="text-xs text-muted-foreground">
                    Página {pagina + 1} de {totalPaginas} · {contactosFiltrados.length} contactos
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setPagina(p => Math.max(0, p - 1)); setRowSelection({}); }}
                      disabled={pagina === 0}
                      className="border-border text-muted-foreground hover:bg-surface-muted gap-1"
                    >
                      <ChevronLeft size={14} /> Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setPagina(p => Math.min(totalPaginas - 1, p + 1)); setRowSelection({}); }}
                      disabled={pagina >= totalPaginas - 1}
                      className="border-border text-muted-foreground hover:bg-surface-muted gap-1"
                    >
                      Siguiente <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Log de Prospección ──────────────────────────────────── */}
            <TabsContent value="logs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Log de Prospección</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Historial de ejecuciones del agente prospector
                  </p>
                </div>
                {/* Linea filter reuse */}
                <Select value={lineaFiltro} onValueChange={v => setLineaFiltro(v ?? 'ALL')}>
                  <SelectTrigger className="bg-surface-muted border-border text-foreground w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-muted border-border">
                    <SelectItem value="ALL" className="text-gray-100">Todas las líneas</SelectItem>
                    <SelectItem value="BHS" className="text-gray-100">BHS</SelectItem>
                    <SelectItem value="Cartón" className="text-gray-100">Cartón</SelectItem>
                    <SelectItem value="Intralogística" className="text-gray-100">Intralogística</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="p-0">
                  {logsLoading ? (
                    <div className="divide-y divide-gray-800/50">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
                          <div className="h-4 bg-surface-muted rounded w-40" />
                          <div className="h-4 bg-surface-muted rounded w-24" />
                          <div className="h-4 bg-surface-muted rounded w-20" />
                          <div className="h-4 bg-surface-muted rounded w-16 ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : prospeccionLogs.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="Sin registros de prospección"
                      description="Los logs aparecerán aquí cuando prospectes empresas."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-muted/60">
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Línea</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Contactos</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {prospeccionLogs.map(log => (
                            <tr key={log.id} className="hover:bg-surface-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-200 font-medium">{log.empresaNombre}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-muted-foreground">{log.linea}</span>
                              </td>
                              <td className="px-4 py-3">
                                {log.estado === 'running' && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-800">
                                    <Loader2 size={12} className="animate-spin" />
                                    Ejecutando...
                                  </span>
                                )}
                                {log.estado === 'success' && (
                                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-800">
                                    Completado
                                  </span>
                                )}
                                {log.estado === 'error' && (
                                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800">
                                    Error
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-muted-foreground font-mono">{log.contactosEncontrados}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-muted-foreground">{formatLogDate(log.createdAt)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
