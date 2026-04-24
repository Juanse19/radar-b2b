'use client';

// app/agente-resultados/page.tsx
// Módulo "Resultados Agente" — visualiza los resultados directos de los agentes
// n8n (WF01/WF02) desde el Google Sheet de resultados (CSV público).
// Tab 1: Clientes — empresas con señales activas (CAPEX, Licitación, Retrofit).
// Tab 2: Log Empresas — log de todas las empresas procesadas.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState, type ColumnDef, type OnChangeFn,
} from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import {
  Download, Search, X,
  ExternalLink, ClipboardList,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { TablePagination } from '@/components/ui/table-pagination';
import { fetchJson } from '@/lib/fetcher';
import type { ClienteSheetRow, LogEmpresaRow } from '@/lib/types';

const DEFAULT_PAGE_SIZE = 50;

const SENAL_OPTIONS = [
  { value: 'ALL',               label: 'Todas las señales' },
  { value: 'CAPEX Confirmado',  label: 'CAPEX Confirmado' },
  { value: 'Licitación',        label: 'Licitación' },
  { value: 'Retrofit',          label: 'Retrofit' },
  { value: 'Sin Señal',         label: 'Sin Señal' },
];

// ── Inline badge components ───────────────────────────────────────────────────

function TirBadge({ tir }: { tir: string }) {
  const map: Record<string, string> = {
    A: 'bg-green-900/50 text-green-300 border-green-800',
    B: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
    C: 'bg-red-900/50 text-red-300 border-red-800',
  };
  // Handle both "A" and "TIR A" formats from the sheet
  const key = tir.toUpperCase().replace(/^TIR\s+/, '').trim();
  const cls = map[key] ?? 'bg-surface-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {tir || '—'}
    </span>
  );
}

function SenalBadge({ senal }: { senal: string }) {
  const s = senal.toLowerCase();
  const cls =
    s.includes('capex')      ? 'bg-blue-900/50 text-blue-300 border-blue-800' :
    s.includes('licitación') || s.includes('licitacion') ? 'bg-orange-900/50 text-orange-300 border-orange-800' :
    s.includes('retrofit')   ? 'bg-purple-900/50 text-purple-300 border-purple-800' :
    'bg-surface-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {senal || '—'}
    </span>
  );
}

function RadarActivoBadge({ valor }: { valor: string }) {
  const activo = valor === 'Sí';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
      activo
        ? 'bg-green-900/50 text-green-300 border-green-800'
        : 'bg-red-900/50 text-red-300 border-red-800'
    }`}>
      {valor || '—'}
    </span>
  );
}

function ScoreCell({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-amber-400' :
    score >= 40 ? 'text-orange-400' :
    'text-muted-foreground';
  return <span className={`text-sm font-bold tabular-nums ${cls}`}>{score}</span>;
}

function FechaCell({ fecha }: { fecha: string }) {
  if (!fecha) return <span className="text-xs text-muted-foreground">—</span>;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return <span className="text-xs text-muted-foreground">{fecha}</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );
}

function UrlCell({ url }: { url: string }) {
  if (!url) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink size={11} />
      Ver fuente
    </a>
  );
}

function TruncatedCell({ text, lines = 2 }: { text: string; lines?: number }) {
  if (!text) return <span className="text-xs text-muted-foreground">—</span>;
  const lineClamp = lines === 3 ? 'line-clamp-3' : 'line-clamp-2';
  return (
    <p className={`text-xs text-muted-foreground ${lineClamp} max-w-[280px]`} title={text}>
      {text}
    </p>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

function createClientesColumns(): ColumnDef<ClienteSheetRow>[] {
  return [
    {
      accessorKey: 'empresa',
      header: 'Empresa',
      cell: ({ getValue }) => (
        <p className="font-medium text-foreground text-sm truncate max-w-[180px]" title={getValue<string>()}>
          {getValue<string>()}
        </p>
      ),
    },
    {
      accessorKey: 'tir',
      header: 'TIR',
      cell: ({ getValue }) => <TirBadge tir={getValue<string>()} />,
    },
    {
      accessorKey: 'score',
      header: 'Score',
      sortingFn: 'basic',
      cell: ({ getValue }) => <ScoreCell score={getValue<number>()} />,
    },
    {
      accessorKey: 'senal',
      header: 'Señal',
      cell: ({ getValue }) => <SenalBadge senal={getValue<string>()} />,
    },
    {
      accessorKey: 'montoEstimado',
      header: 'Monto Est.',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'horizonte',
      header: 'Horizonte',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'resumenHallazgo',
      header: 'Resumen',
      cell: ({ getValue }) => <TruncatedCell text={getValue<string>()} lines={2} />,
    },
    {
      accessorKey: 'urlFuente',
      header: 'Fuente',
      cell: ({ getValue }) => <UrlCell url={getValue<string>()} />,
    },
    {
      accessorKey: 'fechaNoticia',
      header: 'F. Noticia',
      sortingFn: 'basic',
      cell: ({ getValue }) => <FechaCell fecha={getValue<string>()} />,
    },
    {
      accessorKey: 'fechaEscaneo',
      header: 'F. Escaneo',
      sortingFn: 'basic',
      cell: ({ getValue }) => <FechaCell fecha={getValue<string>()} />,
    },
  ];
}

function createLogColumns(): ColumnDef<LogEmpresaRow>[] {
  return [
    {
      accessorKey: 'empresa',
      header: 'Empresa',
      cell: ({ getValue }) => (
        <p className="font-medium text-foreground text-sm truncate max-w-[180px]" title={getValue<string>()}>
          {getValue<string>()}
        </p>
      ),
    },
    {
      accessorKey: 'radarActivo',
      header: 'Radar Activo',
      cell: ({ getValue }) => <RadarActivoBadge valor={getValue<string>()} />,
    },
    {
      accessorKey: 'motivoDescarte',
      header: 'Motivo de Descarte',
      cell: ({ getValue }) => <TruncatedCell text={getValue<string>()} lines={3} />,
    },
    {
      accessorKey: 'fechaNoticia',
      header: 'F. Noticia',
      cell: ({ getValue }) => <FechaCell fecha={getValue<string>()} />,
    },
    {
      accessorKey: 'urlFuente',
      header: 'Fuente',
      cell: ({ getValue }) => <UrlCell url={getValue<string>()} />,
    },
    {
      accessorKey: 'fechaEscaneo',
      header: 'F. Escaneo',
      sortingFn: 'basic',
      cell: ({ getValue }) => <FechaCell fecha={getValue<string>()} />,
    },
  ];
}

// ── Generic table component ───────────────────────────────────────────────────

function DataTable<T>({
  data,
  columns,
  sorting,
  onSortingChange,
  isLoading,
  error,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  minWidth,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  isLoading: boolean;
  error: unknown;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  minWidth?: string;
}) {
  const [pagina, setPagina] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalPaginas = Math.ceil(rows.length / pageSize);
  const rowsPage = rows.slice(pagina * pageSize, (pagina + 1) * pageSize);

  return (
    <div className="rounded-xl border border-border overflow-x-auto bg-surface">
      <div className="px-5 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Cargando...' : `${data.length} empresa${data.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-5 py-4 animate-pulse">
              <div className="h-4 bg-surface-muted rounded w-40" />
              <div className="h-5 bg-surface-muted rounded-full w-16 ml-4" />
              <div className="h-5 bg-surface-muted rounded-full w-20 ml-4" />
              <div className="h-4 bg-surface-muted rounded w-32 ml-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-destructive">Error al cargar los datos</p>
        </div>
      ) : data.length === 0 ? (
        <div className="px-5 py-16">
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <>
          <table className={`${minWidth ?? 'min-w-[800px]'} w-full text-sm`}>
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-border bg-surface-muted/60">
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide select-none ${
                        h.column.getCanSort() ? 'cursor-pointer hover:text-foreground' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' && ' ↑'}
                        {h.column.getIsSorted() === 'desc' && ' ↓'}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {rowsPage.map(row => (
                <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginacion */}
          {totalPaginas > 1 && (
            <div className="border-t border-border">
              <TablePagination
                page={pagina + 1}
                pageSize={pageSize}
                totalRows={rows.length}
                onPageChange={(p) => setPagina(p - 1)}
                onPageSizeChange={(s) => { setPageSize(s); setPagina(0); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── CSV export helpers ────────────────────────────────────────────────────────

function exportClientesCSV(rows: ClienteSheetRow[]) {
  const headers = ['Empresa', 'TIR', 'Score', 'Señal', 'Monto Estimado', 'Horizonte', 'Resumen', 'URL Fuente', 'Fecha Escaneo'];
  const csvRows = rows.map(r => [
    `"${r.empresa}"`, `"${r.tir}"`, r.score, `"${r.senal}"`,
    `"${r.montoEstimado}"`, `"${r.horizonte}"`, `"${r.resumenHallazgo.replace(/"/g, '""')}"`,
    `"${r.urlFuente}"`, `"${r.fechaEscaneo}"`,
  ].join(','));
  downloadCSV([headers.join(','), ...csvRows].join('\n'), `clientes-agente-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportLogCSV(rows: LogEmpresaRow[]) {
  const headers = ['Empresa', 'Radar Activo', 'Motivo Descarte', 'Fecha Noticia', 'URL Fuente', 'Fecha Escaneo'];
  const csvRows = rows.map(r => [
    `"${r.empresa}"`, `"${r.radarActivo}"`, `"${r.motivoDescarte.replace(/"/g, '""')}"`,
    `"${r.fechaNoticia}"`, `"${r.urlFuente}"`, `"${r.fechaEscaneo}"`,
  ].join(','));
  downloadCSV([headers.join(','), ...csvRows].join('\n'), `log-agente-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgenteResultadosPage() {
  // Clientes filters
  const [busquedaC, setBusquedaC]  = useState('');
  const [senalF,    setSenalF]     = useState('ALL');
  const [desdeC,    setDesdeC]     = useState('');
  const [hastaC,    setHastaC]     = useState('');
  const [sortingC,  setSortingC]   = useState<SortingState>([{ id: 'fechaEscaneo', desc: true }]);

  // Log filters
  const [busquedaL, setBusquedaL]  = useState('');
  const [desdeL,    setDesdeL]     = useState('');
  const [hastaL,    setHastaL]     = useState('');
  const [sortingL,  setSortingL]   = useState<SortingState>([{ id: 'fechaEscaneo', desc: true }]);

  // Data fetching
  const { data: clientesData, isLoading: loadingC, error: errorC } = useQuery<{ rows: ClienteSheetRow[] }>({
    queryKey: ['agente-clientes'],
    queryFn: () => fetchJson('/api/agente-resultados/clientes'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: logData, isLoading: loadingL, error: errorL } = useQuery<{ rows: LogEmpresaRow[] }>({
    queryKey: ['agente-log'],
    queryFn: () => fetchJson('/api/agente-resultados/log'),
    staleTime: 5 * 60 * 1000,
  });

  const clientes    = useMemo(() => clientesData?.rows ?? [], [clientesData]);
  const logEmpresas = useMemo(() => logData?.rows ?? [], [logData]);

  // Filtered data — Clientes
  const filteredClientes = useMemo(() => {
    return clientes.filter(r => {
      if (busquedaC.trim() && !r.empresa.toLowerCase().includes(busquedaC.toLowerCase())) return false;
      if (senalF !== 'ALL' && r.senal !== senalF) return false;
      if (desdeC && r.fechaEscaneo && r.fechaEscaneo < desdeC) return false;
      if (hastaC && r.fechaEscaneo && r.fechaEscaneo > hastaC) return false;
      return true;
    });
  }, [clientes, busquedaC, senalF, desdeC, hastaC]);

  // Filtered data — Log
  const filteredLog = useMemo(() => {
    return logEmpresas.filter(r => {
      if (busquedaL.trim() && !r.empresa.toLowerCase().includes(busquedaL.toLowerCase())) return false;
      if (desdeL && r.fechaEscaneo && r.fechaEscaneo < desdeL) return false;
      if (hastaL && r.fechaEscaneo && r.fechaEscaneo > hastaL) return false;
      return true;
    });
  }, [logEmpresas, busquedaL, desdeL, hastaL]);

  const columnsClientes = useMemo(() => createClientesColumns(), []);
  const columnsLog      = useMemo(() => createLogColumns(), []);

  const hasFiltrosC = busquedaC.trim() !== '' || senalF !== 'ALL' || desdeC !== '' || hastaC !== '';
  const hasFiltrosL = busquedaL.trim() !== '' || desdeL !== '' || hastaL !== '';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="space-y-1 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surface-muted rounded-lg border border-border">
            <ClipboardList size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="heading-xl">Resultados Agente</h1>
            <p className="text-sm text-muted-foreground">
              Resultados del Radar de Inversión B2B — datos directos desde los agentes n8n (WF01/WF02)
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">
            Clientes {!loadingC && `(${clientes.length})`}
          </TabsTrigger>
          <TabsTrigger value="log">
            Log Empresas {!loadingL && `(${logEmpresas.length})`}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Clientes ── */}
        <TabsContent value="clientes" className="space-y-4 mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                {/* Búsqueda empresa */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    value={busquedaC}
                    onChange={e => setBusquedaC(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Tipo señal */}
                <Select value={senalF} onValueChange={v => setSenalF(v ?? 'ALL')}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Tipo señal" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENAL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Rango de fechas */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={desdeC}
                    onChange={e => setDesdeC(e.target.value)}
                    className="w-[140px]"
                    title="Desde"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    value={hastaC}
                    onChange={e => setHastaC(e.target.value)}
                    className="w-[140px]"
                    title="Hasta"
                  />
                </div>

                <div className="flex gap-2 ml-auto">
                  {hasFiltrosC && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setBusquedaC(''); setSenalF('ALL'); setDesdeC(''); setHastaC(''); }}
                      className="gap-1.5"
                    >
                      <X size={13} />
                      Limpiar
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => exportClientesCSV(filteredClientes)}
                    disabled={filteredClientes.length === 0}
                    className="gap-1.5"
                  >
                    <Download size={13} />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <DataTable<ClienteSheetRow>
            data={filteredClientes}
            columns={columnsClientes}
            sorting={sortingC}
            onSortingChange={setSortingC}
            isLoading={loadingC}
            error={errorC}
            emptyIcon={ClipboardList}
            emptyTitle="Sin clientes con señales"
            emptyDescription={hasFiltrosC ? 'Intenta ajustar los filtros.' : 'Los agentes n8n aún no han escrito datos en el sheet.'}
            minWidth="min-w-[900px]"
          />
        </TabsContent>

        {/* ── Tab Log Empresas ── */}
        <TabsContent value="log" className="space-y-4 mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                {/* Búsqueda empresa */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    value={busquedaL}
                    onChange={e => setBusquedaL(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Rango de fechas */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={desdeL}
                    onChange={e => setDesdeL(e.target.value)}
                    className="w-[140px]"
                    title="Desde"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    value={hastaL}
                    onChange={e => setHastaL(e.target.value)}
                    className="w-[140px]"
                    title="Hasta"
                  />
                </div>

                <div className="flex gap-2 ml-auto">
                  {hasFiltrosL && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setBusquedaL(''); setDesdeL(''); setHastaL(''); }}
                      className="gap-1.5"
                    >
                      <X size={13} />
                      Limpiar
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => exportLogCSV(filteredLog)}
                    disabled={filteredLog.length === 0}
                    className="gap-1.5"
                  >
                    <Download size={13} />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <DataTable<LogEmpresaRow>
            data={filteredLog}
            columns={columnsLog}
            sorting={sortingL}
            onSortingChange={setSortingL}
            isLoading={loadingL}
            error={errorL}
            emptyIcon={ClipboardList}
            emptyTitle="Sin log de empresas"
            emptyDescription={hasFiltrosL ? 'Intenta ajustar los filtros.' : 'Los agentes n8n aún no han escrito datos en el sheet.'}
            minWidth="min-w-[720px]"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
