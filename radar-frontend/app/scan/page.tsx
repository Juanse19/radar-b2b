'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Radar, Upload, Loader2, RotateCcw,
  Calendar, Search, CheckSquare, Square, FileUp, X,
  Plane, Package, Warehouse, Globe, Minus, Plus,
  Truck, Bike, Factory,
} from 'lucide-react';
import { ExecutionStatusBadge } from '@/components/ExecutionStatus';
import { PipelineStatus } from '@/components/scan/PipelineStatus';
import Link from 'next/link';
import type { LineaNegocio, Empresa } from '@/lib/types';

function isTimestampId(id: string): boolean {
  return /^\d{11,}$/.test(id);
}

const LINEA_OPTIONS: {
  value: LineaNegocio;
  label: string;
  shortLabel: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
  badge: string;
}[] = [
  {
    value: 'BHS',
    label: 'BHS — Aeropuertos',
    shortLabel: 'BHS',
    desc: 'Terminales, carruseles, sorters',
    Icon: Plane,
    color: 'text-blue-600',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'Cartón',
    label: 'Cartón — Corrugadoras',
    shortLabel: 'Cartón',
    desc: 'Plantas corrugadoras, empaque',
    Icon: Package,
    color: 'text-amber-600',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-400',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'Intralogística',
    label: 'Intralogística — CEDI/WMS',
    shortLabel: 'Intralogística',
    desc: 'CEDI, WMS, ASRS, conveyor',
    Icon: Warehouse,
    color: 'text-emerald-600',
    activeBg: 'bg-emerald-50',
    activeBorder: 'border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'Final de Línea',
    label: 'Final de Línea',
    shortLabel: 'Final Línea',
    desc: 'Alimentos, bebidas, palletizado',
    Icon: Factory,
    color: 'text-orange-600',
    activeBg: 'bg-orange-50',
    activeBorder: 'border-orange-400',
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'Motos',
    label: 'Motos — Ensambladoras',
    shortLabel: 'Motos',
    desc: 'Ensambladoras, motocicletas',
    Icon: Bike,
    color: 'text-violet-600',
    activeBg: 'bg-violet-50',
    activeBorder: 'border-violet-400',
    badge: 'bg-violet-100 text-violet-700',
  },
  {
    value: 'Solumat',
    label: 'Solumat — Plásticos',
    shortLabel: 'Solumat',
    desc: 'Plásticos, materiales industriales',
    Icon: Truck,
    color: 'text-cyan-600',
    activeBg: 'bg-cyan-50',
    activeBorder: 'border-cyan-400',
    badge: 'bg-cyan-100 text-cyan-700',
  },
  {
    value: 'ALL',
    label: 'Todas las líneas',
    shortLabel: 'Todas',
    desc: 'Escaneo global completo',
    Icon: Globe,
    color: 'text-indigo-600',
    activeBg: 'bg-indigo-50',
    activeBorder: 'border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700',
  },
];

interface CsvRow { company_name: string; pais?: string; linea_negocio: string; prioridad?: number }

function parseCsvText(text: string): CsvRow[] {
  const lines  = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const delim  = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, '').toUpperCase());
  const normH  = (h: string) => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  const idxMap: Record<string, number> = {};
  headers.forEach((h, i) => { idxMap[normH(h)] = i; });
  const nameIdx   = idxMap['COMPANYNAME'] ?? idxMap['EMPRESA'] ?? 0;
  const paisIdx   = idxMap['PAIS'] ?? idxMap['COUNTRY'] ?? -1;
  const lineaIdx  = idxMap['LINEADENEGOCIO'] ?? idxMap['LINEANEGOCIO'] ?? idxMap['LINEA'] ?? -1;
  const prioIdx   = idxMap['PRIORIDAD'] ?? idxMap['PRIORITY'] ?? -1;
  return lines.slice(1).flatMap(line => {
    const cols = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const name = cols[nameIdx]?.trim();
    if (!name) return [];
    const linea = lineaIdx >= 0 ? (cols[lineaIdx]?.trim() ?? '') : '';
    return [{
      company_name:  name,
      pais:          paisIdx >= 0 ? (cols[paisIdx]?.trim() || undefined) : undefined,
      linea_negocio: linea || 'Intralogística',
      prioridad:     prioIdx >= 0 ? (parseInt(cols[prioIdx] ?? '0', 10) || 0) : 0,
    }];
  });
}

export default function ScanPage() {
  const [linea, setLinea]                   = useState<LineaNegocio>('BHS');
  const [batchSize, setBatchSize]           = useState(10);
  const [executionId, setExecutionId]       = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [showPreview, setShowPreview]       = useState(true);

  const [selectMode, setSelectMode]         = useState(false);
  const [selectedEmpresas, setSelected]     = useState<Empresa[]>([]);
  const [searchFilter, setSearchFilter]     = useState('');

  const [csvRows, setCsvRows]               = useState<CsvRow[] | null>(null);
  const [csvFileName, setCsvFileName]       = useState<string | null>(null);
  const [csvImporting, setCsvImporting]     = useState(false);
  const [csvResult, setCsvResult]           = useState<{ inserted: number; skipped: number } | null>(null);
  const [csvDragOver, setCsvDragOver]       = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const queryClient                         = useQueryClient();

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ['companyCounts'],
    queryFn: () => fetch('/api/companies?count=true').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: previewEmpresas = [], isFetching: loadingPreview } = useQuery<Empresa[]>({
    queryKey: ['companiesPreview', linea, batchSize],
    queryFn: () =>
      fetch(`/api/companies?linea=${encodeURIComponent(linea)}&limit=${batchSize}`)
        .then(r => r.json()),
    enabled: showPreview && !selectMode,
  });

  const selectorLimit = Math.min(counts[linea] ?? 500, 500);
  const { data: allEmpresas = [], isFetching: loadingAll } = useQuery<Empresa[]>({
    queryKey: ['companiesAll', linea, selectorLimit],
    queryFn: () =>
      fetch(`/api/companies?linea=${encodeURIComponent(linea)}&limit=${selectorLimit}`)
        .then(r => r.json()),
    enabled: selectMode && linea !== 'ALL',
    staleTime: 5 * 60 * 1000,
  });

  const totalLinea = linea === 'ALL'
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : (counts[linea] ?? 0);

  const maxBatch = Math.min(50, totalLinea || 50);

  useEffect(() => {
    if (totalLinea > 0 && batchSize > maxBatch) {
      setBatchSize(maxBatch);
    }
  }, [linea, totalLinea, maxBatch, batchSize]);

  useEffect(() => {
    setSelected([]);
    setSearchFilter('');
  }, [linea]);

  const filteredEmpresas = useMemo(() => {
    if (!searchFilter.trim()) return allEmpresas;
    const q = searchFilter.toLowerCase();
    return allEmpresas.filter(e =>
      e.nombre.toLowerCase().includes(q) ||
      (e.pais ?? '').toLowerCase().includes(q),
    );
  }, [allEmpresas, searchFilter]);

  function toggleEmpresa(empresa: Empresa) {
    setSelected(prev =>
      prev.some(e => e.id === empresa.id)
        ? prev.filter(e => e.id !== empresa.id)
        : [...prev, empresa],
    );
  }

  function selectAll() { setSelected([...filteredEmpresas]); }
  function deselectAll() { setSelected([]); }

  function handleToggleSelectMode(val: boolean) {
    setSelectMode(val);
    if (!val) setSelected([]);
  }

  function handleCsvFile(file: File) {
    setCsvResult(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      try {
        const rows = parseCsvText(text);
        setCsvRows(rows);
      } catch {
        setCsvRows([]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function importarCsv() {
    if (!csvRows || csvRows.length === 0) return;
    setCsvImporting(true);
    try {
      const res = await fetch('/api/companies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresas: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error importando');
      setCsvResult(data);
      setCsvRows(null);
      setCsvFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['companyCounts'] });
      queryClient.invalidateQueries({ queryKey: ['companiesPreview'] });
      queryClient.invalidateQueries({ queryKey: ['companiesAll'] });
      toast.success(`${data.inserted} empresa${data.inserted !== 1 ? 's' : ''} importada${data.inserted !== 1 ? 's' : ''}${data.skipped > 0 ? ` · ${data.skipped} omitidas` : ''}`);
    } catch {
      toast.error('Error al importar el archivo CSV');
      setCsvResult({ inserted: -1, skipped: -1 });
    } finally {
      setCsvImporting(false);
    }
  }

  async function lanzarEscaneo() {
    setLoading(true);
    setError(null);
    setExecutionId(null);
    setShowPreview(false);

    try {
      const body: Record<string, unknown> = {
        linea,
        dateFilterFrom: '2025-07-01',
      };

      if (selectMode && selectedEmpresas.length > 0) {
        body.empresasEspecificas = selectedEmpresas.map(e => e.nombre);
        body.empresas = selectedEmpresas.map(e => ({
          nombre:  e.nombre,
          dominio: e.dominio,
          pais:    e.pais,
          linea:   e.linea,
        }));
        body.batchSize = selectedEmpresas.length;
      } else {
        body.batchSize = batchSize;
      }

      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error lanzando escaneo');
      setExecutionId(data.executionId);
      const empresasCount = selectMode && selectedEmpresas.length > 0
        ? selectedEmpresas.length
        : batchSize;
      toast.success(`Escaneo iniciado — ${empresasCount} empresa${empresasCount !== 1 ? 's' : ''} en ${linea}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function reintentar() {
    setError(null);
    setExecutionId(null);
  }

  function onPipelineComplete() {
    queryClient.invalidateQueries({ queryKey: ['signals'] });
    toast.success('Pipeline completado. Resultados actualizados.');
  }

  const scanLabel = selectMode && selectedEmpresas.length > 0
    ? `Escanear ${selectedEmpresas.length} empresa${selectedEmpresas.length !== 1 ? 's' : ''} seleccionada${selectedEmpresas.length !== 1 ? 's' : ''}`
    : `Escanear ${batchSize} empresas de ${linea}`;

  const canScan = !loading && !executionId &&
    (!selectMode || selectedEmpresas.length > 0);

  const activeOption = LINEA_OPTIONS.find(o => o.value === linea) ?? LINEA_OPTIONS[0]!;
  const batchPct = totalLinea > 0 ? Math.round((batchSize / totalLinea) * 100) : 0;

  const previewList = selectMode ? selectedEmpresas : previewEmpresas;

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <Radar size={20} className="text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Lanzar Escaneo</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-1">
              Panel de control del Radar de Inversión B2B — selecciona línea y ejecuta manualmente.
            </p>
          </div>
          {totalLinea > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full">
              <span className={`w-2 h-2 rounded-full ${activeOption.color.replace('text-', 'bg-')}`} />
              <span className="text-sm text-muted-foreground font-medium">{totalLinea} empresas en {activeOption.shortLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ─────────── LEFT COLUMN (config) — 3/5 width ─────────── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Line selector — visual cards */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                01 — Línea de negocio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {LINEA_OPTIONS.map(opt => {
                  const isActive = linea === opt.value;
                  const count = opt.value === 'ALL'
                    ? Object.values(counts).reduce((a, b) => a + b, 0)
                    : (counts[opt.value] ?? 0);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setLinea(opt.value as LineaNegocio); setShowPreview(true); }}
                      className={`
                        relative text-left p-4 rounded-xl border-2 transition-all duration-150
                        ${isActive
                          ? `${opt.activeBg} ${opt.activeBorder} shadow-lg`
                          : 'bg-surface-muted/50 border-border hover:border-secondary hover:bg-surface-muted'}
                      `}
                    >
                      <div className={`mb-3 ${isActive ? opt.color : 'text-muted-foreground'} transition-colors`}>
                        <opt.Icon size={28} />
                      </div>
                      <p className={`font-semibold text-sm mb-0.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {opt.shortLabel}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug mb-2">{opt.desc}</p>
                      {count > 0 && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isActive ? opt.badge : 'bg-surface-muted text-muted-foreground'}`}>
                          {count} empresas
                        </span>
                      )}
                      {isActive && (
                        <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${opt.color.replace('text-', 'bg-')} ring-2 ring-white`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Batch size stepper — hidden in selectMode */}
          {!selectMode && (
            <Card className="bg-surface border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  02 — Cantidad de empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-5 mb-4">
                  <button
                    type="button"
                    onClick={() => setBatchSize(v => Math.max(1, v - 1))}
                    disabled={batchSize <= 1}
                    className="w-11 h-11 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <div className="text-center flex-1">
                    <span className="text-5xl font-bold text-foreground tabular-nums">{batchSize}</span>
                    <p className="text-xs text-muted-foreground mt-1">empresas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBatchSize(v => Math.min(maxBatch, v + 1))}
                    disabled={batchSize >= maxBatch}
                    className="w-11 h-11 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Progress bar */}
                {totalLinea > 0 && (
                  <div className="space-y-2">
                    <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${activeOption.color.replace('text-', 'bg-')}`}
                        style={{ width: `${Math.min(100, batchPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{batchSize} de {totalLinea} disponibles</span>
                      <span>{batchPct}% del total</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Máximo {maxBatch} por ejecución</p>
              </CardContent>
            </Card>
          )}

          {/* Select mode + empresa picker */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  03 — Selección específica
                </CardTitle>
                <div className="flex items-center gap-3">
                  {linea === 'ALL' && (
                    <span className="text-xs text-muted-foreground">(no disponible en Todas)</span>
                  )}
                  <Switch
                    id="select-mode"
                    checked={selectMode}
                    onCheckedChange={handleToggleSelectMode}
                    disabled={linea === 'ALL'}
                  />
                  <Label htmlFor="select-mode" className="text-muted-foreground text-sm cursor-pointer select-none">
                    {selectMode ? 'Activo' : 'Inactivo'}
                  </Label>
                </div>
              </div>
            </CardHeader>

            {selectMode && linea !== 'ALL' && (
              <CardContent className="pt-0">
                <div className="bg-surface-muted/60 border border-border rounded-xl overflow-hidden">
                  {/* Toolbar */}
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 bg-surface-muted">
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedEmpresas.length} / {allEmpresas.length} seleccionadas
                    </span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={selectAll}
                        className="text-xs text-secondary hover:text-blue-700 flex items-center gap-1 transition-colors">
                        <CheckSquare size={12} /> Todas
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button type="button" onClick={deselectAll}
                        className="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1 transition-colors">
                        <Square size={12} /> Ninguna
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-3 py-2 border-b border-border/60">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa o país..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        className="bg-surface border-border text-foreground text-xs h-8 pl-8 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-60 overflow-y-auto">
                    {loadingAll ? (
                      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
                        <Loader2 size={13} className="animate-spin" /> Cargando empresas...
                      </div>
                    ) : filteredEmpresas.length === 0 ? (
                      <p className="text-muted-foreground text-xs p-4">
                        {searchFilter ? 'Sin coincidencias.' : 'No hay empresas disponibles.'}
                      </p>
                    ) : (
                      <ul>
                        {filteredEmpresas.map(emp => {
                          const isChecked = selectedEmpresas.some(e => e.id === emp.id);
                          return (
                            <li
                              key={emp.id}
                              onClick={() => toggleEmpresa(emp)}
                              className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer text-xs border-b border-border/40 last:border-0 transition-colors
                                ${isChecked ? 'bg-secondary/15 text-secondary' : 'text-muted-foreground hover:bg-surface-muted/50'}`}
                            >
                              <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all
                                ${isChecked ? 'bg-blue-600 border-blue-500' : 'border-border bg-transparent'}`}>
                                {isChecked && (
                                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <span className="flex-1 truncate font-medium">{emp.nombre}</span>
                              <span className="text-muted-foreground flex-shrink-0">{emp.pais}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            )}

            {!selectMode && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Activa este modo para elegir empresas individualmente en lugar de usar el lote por defecto.
                </p>
              </CardContent>
            )}
          </Card>

          {/* Launch button */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar size={12} />
              <span>Filtro de fecha activo: noticias desde <strong className="text-muted-foreground">2025-07-01</strong> en adelante</span>
            </div>

            <Button
              onClick={lanzarEscaneo}
              disabled={!canScan}
              className={`
                w-full h-12 text-base font-semibold gap-3 transition-all duration-200
                ${canScan
                  ? 'bg-blue-600 hover:bg-blue-500 text-foreground shadow-lg shadow-blue-900/40'
                  : 'bg-surface-muted text-muted-foreground cursor-not-allowed'}
              `}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Iniciando escaneo...
                </>
              ) : (
                <>
                  <Radar size={18} />
                  {scanLabel}
                </>
              )}
            </Button>

            <Link
              href="/schedule"
              className="flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground text-sm transition-colors"
            >
              <Calendar size={15} />
              Ver / configurar escaneo automático
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium mb-1">Error al lanzar escaneo</p>
                <p className="text-red-600 text-xs">{error}</p>
              </div>
              <Button
                onClick={reintentar}
                className="flex-shrink-0 border border-red-300 bg-transparent text-red-700 hover:bg-red-100 hover:text-red-800 h-8 px-3 text-xs gap-1"
              >
                <RotateCcw size={13} />
                Reintentar
              </Button>
            </div>
          )}
        </div>

        {/* ─────────── RIGHT COLUMN (status panel) — 2/5 width ─────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Active line info card */}
          <Card className={`border-2 ${activeOption.activeBorder} ${activeOption.activeBg}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-surface/60 ${activeOption.color}`}>
                  <activeOption.Icon size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Línea activa</p>
                  <h2 className={`text-lg font-bold ${activeOption.color} leading-tight`}>
                    {activeOption.shortLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{activeOption.desc}</p>
                  <div className="flex items-center gap-2 mt-3">
                    {totalLinea > 0 && (
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${activeOption.badge}`}>
                        {totalLinea} empresas
                      </span>
                    )}
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-muted text-muted-foreground">
                      {selectMode && selectedEmpresas.length > 0
                        ? `${selectedEmpresas.length} seleccionadas`
                        : `Lote de ${batchSize}`}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline status — replaces old execution card */}
          {executionId && (
            <>
              <PipelineStatus
                executionId={executionId}
                linea={linea}
                onComplete={onPipelineComplete}
              />
              {/* Compact execution ID / fallback badge */}
              {!isTimestampId(executionId) && (
                <div className="flex items-center gap-2 px-1">
                  <ExecutionStatusBadge executionId={executionId} onComplete={() => {}} />
                </div>
              )}
            </>
          )}

          {/* Preview empresas */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
                  {selectMode ? 'Empresas seleccionadas' : `Preview — ${batchSize} a escanear`}
                </CardTitle>
                {!selectMode && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(p => !p)}
                    className="text-xs text-secondary hover:text-blue-700 transition-colors"
                  >
                    {showPreview ? 'Ocultar' : 'Mostrar'}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {showPreview || selectMode ? (
                <div className="bg-surface-muted/50 rounded-lg overflow-hidden">
                  {(selectMode ? false : loadingPreview) ? (
                    <div className="flex items-center gap-2 p-3 text-muted-foreground text-xs">
                      <Loader2 size={12} className="animate-spin" /> Cargando...
                    </div>
                  ) : previewList.length === 0 ? (
                    <p className="text-muted-foreground text-xs p-3">
                      {selectMode ? 'Ninguna empresa seleccionada.' : 'No hay empresas disponibles.'}
                    </p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto">
                      {previewList.map(e => (
                        <li key={e.id} className="px-3 py-2 flex items-center gap-2 border-b border-border/40 last:border-0">
                          {selectMode && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          )}
                          <span className="flex-1 text-xs text-foreground truncate">{e.nombre}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{e.pais}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">Lista de empresas oculta.</p>
              )}
            </CardContent>
          </Card>

          {/* CSV import — right panel */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                <FileUp size={13} /> Importar CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Columnas: <code className="text-muted-foreground bg-surface-muted px-1 rounded">COMPANY NAME</code>,{' '}
                <code className="text-muted-foreground bg-surface-muted px-1 rounded">PAÍS</code>,{' '}
                <code className="text-muted-foreground bg-surface-muted px-1 rounded">LÍNEA DE NEGOCIO</code>
              </p>

              {/* Drag & drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setCsvDragOver(true); }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setCsvDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleCsvFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
                  ${csvDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-border hover:border-blue-400 bg-surface-muted/40 hover:bg-surface-muted/70'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
                />
                <Upload size={20} className={csvDragOver ? 'text-secondary' : 'text-muted-foreground'} />
                {csvFileName ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">{csvFileName}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setCsvRows(null); setCsvFileName(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-muted-foreground hover:text-muted-foreground"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Arrastra un CSV o haz clic aquí</span>
                )}
              </div>

              {/* Preview filas */}
              {csvRows && csvRows.length > 0 && (
                <div className="bg-surface-muted border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{csvRows.length} empresas detectadas</span>
                    <Button
                      onClick={importarCsv}
                      disabled={csvImporting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-6 px-3 gap-1"
                    >
                      {csvImporting ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                      Importar
                    </Button>
                  </div>
                  <ul className="max-h-36 overflow-y-auto">
                    {csvRows.slice(0, 20).map((r, i) => (
                      <li key={i} className="px-3 py-1.5 text-xs text-muted-foreground flex justify-between gap-2 border-b border-border/40 last:border-0">
                        <span className="truncate flex-1">{r.company_name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{r.pais ?? '—'}</span>
                        <span className="text-secondary flex-shrink-0">{r.linea_negocio}</span>
                      </li>
                    ))}
                    {csvRows.length > 20 && (
                      <li className="px-3 py-1.5 text-xs text-muted-foreground italic">
                        ... y {csvRows.length - 20} más
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {csvRows !== null && csvRows.length === 0 && (
                <p className="text-red-600 text-xs">No se encontraron empresas válidas.</p>
              )}

              {csvResult && csvResult.inserted >= 0 && (
                <p className="text-emerald-600 text-xs">
                  {csvResult.inserted} empresa{csvResult.inserted !== 1 ? 's' : ''} importada{csvResult.inserted !== 1 ? 's' : ''}
                  {csvResult.skipped > 0 ? ` · ${csvResult.skipped} omitidas` : ''}
                </p>
              )}
              {csvResult && csvResult.inserted === -1 && (
                <p className="text-red-600 text-xs">Error al importar. Intenta de nuevo.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
