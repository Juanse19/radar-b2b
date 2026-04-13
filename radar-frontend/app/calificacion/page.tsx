'use client';

// app/calificacion/page.tsx
// Vista de resultados de calificación (WF01).
// Muestra empresas clasificadas con su score, tier, prioridad comercial y
// ventana de compra. Permite filtrar por línea, tier y búsqueda.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type SortingState,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, ChevronLeft, ChevronRight, ClipboardCheck, Search, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineaBadge } from '@/components/LineaBadge';
import { ScoreBadge } from '@/components/ScoreBadge';
import { TierBadge } from '@/components/TierBadge';
import { EmptyState } from '@/components/EmptyState';
import { fetchJson } from '@/lib/fetcher';
import type { ResultadoRadar, LineaNegocio } from '@/lib/types';
import { LINEAS_ACTIVAS } from '@/lib/lineas';

const POR_PAGINA = 50;

const TIER_OPTIONS = [
  { value: 'ALL',       label: 'Todos los tiers' },
  { value: 'ORO',       label: '★ ORO (Score ≥ 8)' },
  { value: 'Monitoreo', label: 'Monitoreo (5-7)' },
  { value: 'Contexto',  label: 'Contexto (1-4)' },
  { value: 'Sin Señal', label: 'Sin Señal' },
];

const LINEA_OPTIONS = [
  { value: 'ALL', label: 'Todas las líneas' },
  ...LINEAS_ACTIVAS.map(l => ({ value: l, label: l })),
];

// ── Column definitions ─────────────────────────────────────────────────────────

function createCalColumns(): ColumnDef<ResultadoRadar>[] {
  return [
    {
      accessorKey: 'empresa',
      header: 'Empresa',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[180px]" title={row.original.empresa}>
            {row.original.empresa}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.pais}</p>
        </div>
      ),
    },
    {
      accessorKey: 'linea',
      header: 'Línea',
      cell: ({ getValue }) => <LineaBadge linea={getValue<LineaNegocio>()} />,
    },
    {
      accessorKey: 'scoreRadar',
      header: 'Score',
      sortingFn: 'basic',
      cell: ({ getValue }) => <ScoreBadge score={getValue<number>()} />,
    },
    {
      accessorKey: 'tier',
      header: 'Tier',
      cell: ({ getValue }) => {
        const tier = getValue<string>();
        return tier ? <TierBadge tier={tier as 'ORO' | 'Monitoreo' | 'Contexto' | 'Sin Señal'} /> : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: 'prioridadComercial',
      header: 'Prioridad',
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val || val === '—') return <span className="text-xs text-muted-foreground">—</span>;
        const color =
          val === 'Muy Alta' ? 'text-red-400' :
          val === 'Alta'     ? 'text-orange-400' :
          val === 'Media'    ? 'text-amber-400' :
          'text-muted-foreground';
        return <span className={`text-xs font-medium ${color}`}>{val}</span>;
      },
    },
    {
      accessorKey: 'ventanaCompra',
      header: 'Ventana',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'ticketEstimado',
      header: 'Ticket',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'fechaEscaneo',
      header: 'Fecha',
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="text-xs text-muted-foreground">
            {new Date(val).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        );
      },
    },
  ];
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CalificacionPage() {
  const [lineaFiltro, setLineaFiltro] = useState('ALL');
  const [tierFiltro,  setTierFiltro]  = useState('ALL');
  const [busqueda,    setBusqueda]    = useState('');
  const [pagina,      setPagina]      = useState(0);
  const [sorting,     setSorting]     = useState<SortingState>([{ id: 'scoreRadar', desc: true }]);

  const signalUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (lineaFiltro !== 'ALL') p.set('linea', lineaFiltro);
    if (tierFiltro  !== 'ALL') p.set('tier',  tierFiltro);
    p.set('limit', '500');
    return `/api/signals?${p}`;
  }, [lineaFiltro, tierFiltro]);

  const { data: raw = [], isLoading, error } = useQuery<ResultadoRadar[]>({
    queryKey: ['calificacion', lineaFiltro, tierFiltro],
    queryFn: async () => {
      const data = await fetchJson<unknown>(signalUrl);
      return Array.isArray(data) ? (data as ResultadoRadar[]) : [];
    },
  });

  const filtered = useMemo(() => {
    if (!busqueda.trim()) return raw;
    const q = busqueda.toLowerCase();
    return raw.filter(r =>
      r.empresa.toLowerCase().includes(q) ||
      r.pais?.toLowerCase().includes(q) ||
      r.linea?.toLowerCase().includes(q)
    );
  }, [raw, busqueda]);

  const columns = useMemo(() => createCalColumns(), []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalPaginas = Math.ceil(rows.length / POR_PAGINA);
  const rowsPage = rows.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  function exportCSV() {
    const headers = ['Empresa', 'País', 'Línea', 'Score', 'Tier', 'Prioridad', 'Ventana', 'Ticket', 'Fecha'];
    const csvRows = filtered.map(r => [
      `"${r.empresa}"`,
      `"${r.pais}"`,
      `"${r.linea}"`,
      r.scoreRadar,
      `"${r.tier ?? ''}"`,
      `"${r.prioridadComercial ?? ''}"`,
      `"${r.ventanaCompra ?? ''}"`,
      `"${r.ticketEstimado ?? ''}"`,
      `"${r.fechaEscaneo ?? ''}"`,
    ].join(','));
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `calificacion-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFiltros = lineaFiltro !== 'ALL' || tierFiltro !== 'ALL' || busqueda.trim() !== '';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="space-y-1 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surface-muted rounded-lg border border-border">
            <ClipboardCheck size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="heading-xl">Calificación</h1>
            <p className="text-sm text-muted-foreground">
              Resultados del Agente Calificador (WF01) — empresas clasificadas por score y tier
            </p>
          </div>
        </div>
      </header>

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa o país..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(0); }}
                className="pl-9"
              />
            </div>

            {/* Línea */}
            <Select value={lineaFiltro} onValueChange={v => { setLineaFiltro(v ?? 'ALL'); setPagina(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Línea" />
              </SelectTrigger>
              <SelectContent>
                {LINEA_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tier */}
            <Select value={tierFiltro} onValueChange={v => { setTierFiltro(v ?? 'ALL'); setPagina(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear + Export */}
            <div className="flex gap-2 ml-auto">
              {hasFiltros && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLineaFiltro('ALL'); setTierFiltro('ALL'); setBusqueda(''); setPagina(0); }}
                  className="gap-1.5"
                >
                  <X size={13} />
                  Limpiar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                disabled={filtered.length === 0}
                className="gap-1.5"
              >
                <Download size={13} />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla ── */}
      <div className="rounded-xl border border-border overflow-x-auto bg-surface">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Cargando...' : `${filtered.length} empresa${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4 animate-pulse">
                <div className="h-4 bg-surface-muted rounded w-40" />
                <div className="h-5 bg-surface-muted rounded-full w-16 ml-4" />
                <div className="h-5 bg-surface-muted rounded-full w-12 ml-4" />
                <div className="h-5 bg-surface-muted rounded-full w-20 ml-4" />
                <div className="h-4 bg-surface-muted rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-destructive">Error al cargar los datos</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16">
            <EmptyState
              icon={ClipboardCheck}
              title="Sin resultados de calificación"
              description={hasFiltros ? 'Intenta ajustar los filtros.' : 'Dispara el agente Calificador desde la página Escanear para ver resultados aquí.'}
            />
          </div>
        ) : (
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-border bg-surface-muted/60">
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide select-none ${h.column.getCanSort() ? 'cursor-pointer hover:text-foreground' : ''}`}
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
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {pagina + 1} de {totalPaginas}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina === 0}
              onClick={() => setPagina(p => p - 1)}
              className="gap-1"
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina(p => p + 1)}
              className="gap-1"
            >
              Siguiente
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
