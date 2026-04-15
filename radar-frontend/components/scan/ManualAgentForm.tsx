// components/scan/ManualAgentForm.tsx
//
// Unified manual-fire form for the 3 agents. Used by /scan as one tab per
// agent. Each variant shows the line + empresa picker that's relevant for
// that agent and disables its fire button while an in-flight execution of
// the same agent type exists.
//
// Why a single component instead of three: 80% of the form is shared
// (linea + empresa picker), and routing the differences through props
// keeps the per-agent specifics in one place.

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Square, CheckSquare, Minus, Plus, AlertTriangle, Upload, X, FileText, Database, Info, Zap } from 'lucide-react';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { useInflightExecutions } from '@/hooks/useInflightExecutions';
import { AgentPipelineCard } from '@/components/tracker/AgentPipelineCard';
import { LINEA_OPTIONS_ALL } from '@/lib/constants/lineas';
import { useLineasActivas } from '@/hooks/useLineasActivas';
import { cn } from '@/lib/utils';
import type { LineaNegocio, Empresa } from '@/lib/types';
import type { AgentType } from '@/lib/db/types';

interface ManualAgentFormProps {
  agent: AgentType;
}

interface CountsMap { [linea: string]: number }

interface FireResponse { execution_id: string; pipeline_id: string }

const AGENT_LABEL: Record<AgentType, { title: string; subtitle: string; cta: string }> = {
  calificador: {
    title:    'Calificación',
    subtitle: 'Califica empresas con WF01 (perfil Tavily + scoring GPT-4)',
    cta:      'Disparar Calificador',
  },
  radar: {
    title:    'Radar de Inversión',
    subtitle: 'Detecta señales de inversión con WF02 (Tavily + GPT-4o + Pinecone)',
    cta:      'Disparar Radar',
  },
  prospector: {
    title:    'Prospección',
    subtitle: 'Extrae contactos con WF03 (Apollo.io People Search)',
    cta:      'Disparar Prospector',
  },
};

/** Parse a CSV string into Empresa-compatible objects (no DB id needed). */
function parseCsvEmpresas(raw: string): Empresa[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  // Detect if first line looks like a header (contains letters that aren't a company name pattern)
  const firstLower = lines[0]?.toLowerCase() ?? '';
  const isHeader =
    firstLower.startsWith('nombre') ||
    firstLower.startsWith('empresa') ||
    firstLower.startsWith('company') ||
    firstLower.startsWith('name');
  const dataLines = isHeader ? lines.slice(1) : lines;
  return dataLines
    .map((line, i) => {
      const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
      const nombre  = cols[0] ?? '';
      const pais    = cols[1] ?? 'Colombia';
      const dominio = cols[2] ?? undefined;
      if (!nombre) return null;
      return { id: -(i + 1), nombre, pais, dominio, linea: undefined } as unknown as Empresa;
    })
    .filter(Boolean) as Empresa[];
}

export function ManualAgentForm({ agent }: ManualAgentFormProps) {
  const meta = AGENT_LABEL[agent];
  const { anyRunningOfAgent, invalidate } = useInflightExecutions();
  const { lineas: lineasActivas, isLoading: lineasLoading } = useLineasActivas();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [linea, setLinea]                 = useState<LineaNegocio>('BHS');
  const [batchSize, setBatchSize]         = useState(5);
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState(3);
  const [tier, setTier]                   = useState<'ORO' | 'MONITOREO' | 'PLATA'>('ORO');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<Empresa[]>([]);
  const [firing, setFiring]               = useState(false);
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  // CSV import mode
  const [csvMode, setCsvMode]             = useState(false);
  const [csvEmpresas, setCsvEmpresas]     = useState<Empresa[]>([]);
  const [csvFileName, setCsvFileName]     = useState<string | null>(null);

  // Reset selection when línea or mode changes.
  useEffect(() => {
    setSelected([]);
    setSearch('');
  }, [linea]);

  // ── CSV helpers ──────────────────────────────────────────────────────────
  function handleCsvFile(file: File) {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvEmpresas(text);
      setCsvEmpresas(parsed);
      if (parsed.length === 0) {
        toast.error('El CSV no contiene empresas válidas');
      } else {
        toast.success(`${parsed.length} empresas cargadas desde CSV`);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function clearCsv() {
    setCsvEmpresas([]);
    setCsvFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Queries: line counts + empresas list ─────────────────────────────────
  const { data: counts = {} } = useQuery<CountsMap>({
    queryKey: ['companyCounts'],
    queryFn:  () => fetchJson<CountsMap>('/api/companies?count=true'),
    staleTime: 5 * 60 * 1000,
  });

  const totalLinea = linea === 'ALL'
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : (counts[linea] ?? 0);

  // For Radar (single empresa) and others (batch), we always fetch a list of
  // empresas to allow cherry-picking. Radar variant is single-select.
  // When linea === 'ALL', fetch up to 200 empresas for manual selection;
  // the auto-batch mode (batchSize) still works without selecting any.
  const limit = linea === 'ALL' ? 200 : Math.min(totalLinea || 200, 500);
  const { data: empresas = [], isFetching: loadingEmpresas } = useQuery<Empresa[]>({
    queryKey: ['empresasForAgent', linea, limit],
    queryFn:  () => fetchJson<Empresa[]>(`/api/companies?linea=${encodeURIComponent(linea)}&limit=${limit}`),
    enabled:  true,
    staleTime: 5 * 60 * 1000,
  });

  // ── Computed ─────────────────────────────────────────────────────────────
  const filteredEmpresas = useMemo(() => {
    if (!search.trim()) return empresas;
    const q = search.toLowerCase();
    return empresas.filter(e =>
      e.nombre.toLowerCase().includes(q) ||
      (e.pais ?? '').toLowerCase().includes(q),
    );
  }, [empresas, search]);

  const maxBatch    = Math.min(50, totalLinea || 50);
  const hasInflight = anyRunningOfAgent(agent);

  // Effective empresa list: CSV mode overrides manual selection.
  const effectiveEmpresas = csvMode ? csvEmpresas : selected;

  // canFire: all agents support manual (selection) + auto (batchSize) + CSV modes.
  const canFire = !firing && !hasInflight && (
    csvMode
      ? csvEmpresas.length > 0
      : (effectiveEmpresas.length > 0 || batchSize > 0)
  );

  // ── Selection helpers ────────────────────────────────────────────────────
  function toggleEmpresa(empresa: Empresa) {
    setSelected(prev => {
      const exists = prev.some(e => e.id === empresa.id);
      return exists ? prev.filter(e => e.id !== empresa.id) : [...prev, empresa];
    });
  }
  function selectAll()   { setSelected([...filteredEmpresas]); }
  function deselectAll() { setSelected([]); }

  // ── Fire ─────────────────────────────────────────────────────────────────
  async function onFire() {
    setError(null);
    setFiring(true);
    setLastExecutionId(null);

    // Determine the empresa list to use.
    const fireEmpresas = csvMode ? csvEmpresas : effectiveEmpresas;

    try {
      const body: Record<string, unknown> = { agent, linea };

      if (agent === 'radar') {
        if (fireEmpresas.length > 1) {
          // Multi-radar: fire one request per company sequentially.
          const results: FireResponse[] = [];
          for (const e of fireEmpresas) {
            const r = await fetchJson<FireResponse>('/api/agent', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                agent, linea,
                options: {
                  empresa:            e.nombre,
                  pais:               e.pais ?? 'Colombia',
                  company_domain:     e.dominio,
                  tier,
                  score_calificacion: 9,
                },
              }),
            });
            results.push(r);
          }
          setLastExecutionId(results[0]!.execution_id);
          toast.success(`Radar disparado para ${fireEmpresas.length} empresas`);
          invalidate();
          return;
        }
        if (fireEmpresas.length === 1) {
          const e = fireEmpresas[0]!;
          body.options = {
            empresa:            e.nombre,
            pais:               e.pais ?? 'Colombia',
            company_domain:     e.dominio,
            tier,
            score_calificacion: 9,
          };
        } else {
          // Batch auto-mode for radar: pick batchSize random from DB.
          body.batchSize = batchSize;
          body.options   = { tier, score_calificacion: 9 };
        }
      } else if (agent === 'prospector') {
        const mapEmpresas = (arr: Empresa[]) =>
          arr.map(e => ({ nombre: e.nombre, dominio: e.dominio, pais: e.pais ?? 'Colombia', linea: e.linea }));
        body.empresas  = fireEmpresas.length > 0 ? mapEmpresas(fireEmpresas) : undefined;
        body.batchSize = fireEmpresas.length || batchSize;
        body.options   = { contactosPorEmpresa, tier };
      } else {
        // calificador
        const mapEmpresas = (arr: Empresa[]) =>
          arr.map(e => ({ nombre: e.nombre, dominio: e.dominio, pais: e.pais ?? 'Colombia', linea: e.linea }));
        body.empresas  = fireEmpresas.length > 0 ? mapEmpresas(fireEmpresas) : undefined;
        body.batchSize = fireEmpresas.length || batchSize;
      }

      const result = await fetchJson<FireResponse>('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      setLastExecutionId(result.execution_id);
      toast.success(`${meta.title} disparado · pipeline ${result.pipeline_id.slice(0, 8)}`);
      invalidate();

    } catch (err) {
      const msg = err instanceof ApiError
        ? `${err.message}`
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      toast.error(`No se pudo disparar ${meta.title}: ${msg}`);
    } finally {
      setFiring(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <header>
        <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
        <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
      </header>

      {/* Línea selector */}
      <section className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Línea de negocio
        </label>
        {lineasLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-28 rounded-lg bg-surface-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Match each DB linea to its static metadata (icon, colors).
              // Falls back to a generic option if the name isn't in LINEA_OPTIONS_ALL.
              const staticAll = LINEA_OPTIONS_ALL;
              const dbNames = lineasActivas.map(l => l.nombre);
              // Build the rendered list: DB-active lines + ALL at the end.
              const opts = staticAll.filter(
                o => o.value === 'ALL' || dbNames.includes(o.value),
              );
              return opts.map(opt => {
                const isActive = linea === opt.value;
                const cnt = opt.value === 'ALL'
                  ? Object.values(counts).reduce((a, b) => a + b, 0)
                  : (counts[opt.value] ?? 0);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLinea(opt.value)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors text-sm',
                      isActive
                        ? `${opt.activeBg} ${opt.activeBorder} ${opt.color}`
                        : 'bg-surface border-border text-muted-foreground hover:border-border',
                    )}
                  >
                    <opt.Icon size={15} />
                    <span className="font-medium">{opt.shortLabel}</span>
                    <span className="text-xs opacity-70 tabular-nums">{cnt}</span>
                  </button>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* Source mode toggle: Base de datos | CSV */}
      <section>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-muted/60 border border-border w-fit">
          <button
            type="button"
            onClick={() => { setCsvMode(false); clearCsv(); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              !csvMode ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Database size={13} /> Base de datos
          </button>
          <button
            type="button"
            onClick={() => { setCsvMode(true); setSelected([]); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              csvMode ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Upload size={13} /> Importar CSV
          </button>
        </div>
      </section>

      {/* Empresa source + agent options — 2-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">

      {/* CSV import panel */}
      {csvMode ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Formato: <code className="bg-surface-muted px-1 rounded text-[11px]">nombre, país, dominio</code> (una empresa por línea). Las empresas <strong>no se guardan</strong> en la base de datos.
            </p>
            {/* Drop zone / file picker */}
            <div
              className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-blue-600/50 bg-surface-muted/20 px-4 py-5 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleCsvFile(file);
              }}
            >
              <FileText size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {csvFileName
                  ? <span className="text-foreground font-medium">{csvFileName}</span>
                  : 'Arrastra un CSV aquí o haz clic para seleccionar'}
              </p>
              {csvEmpresas.length > 0 && (
                <span className="text-xs text-green-400 font-medium">{csvEmpresas.length} empresas listas para escanear</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                }}
              />
            </div>
            {csvEmpresas.length > 0 && (
              <button
                type="button"
                onClick={clearCsv}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
              >
                <X size={12} /> Limpiar CSV
              </button>
            )}
          </div>

          {/* Preview of parsed CSV */}
          {csvEmpresas.length > 0 && (
            <Card>
              <CardContent className="p-0 max-h-48 overflow-y-auto">
                <ul className="divide-y divide-border/40">
                  {csvEmpresas.map((e, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <CheckSquare size={13} className="text-blue-500 shrink-0" />
                      <span className="flex-1 truncate text-foreground">{e.nombre}</span>
                      {e.pais && <span className="text-xs text-muted-foreground">{e.pais}</span>}
                      {e.dominio && <span className="text-xs text-muted-foreground/60 font-mono">{e.dominio}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      ) : (
        /* BD empresa picker */
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Empresas
              </label>
              {selected.length > 0 ? (
                <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {selected.length} seleccionada{selected.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/60 italic">ninguna seleccionada</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {filteredEmpresas.length > 0 && (
                <>
                  <button type="button" onClick={selectAll}   className="text-xs text-blue-600 hover:underline">Seleccionar todas</button>
                  <button type="button" onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">Limpiar</button>
                </>
              )}
            </div>
          </div>
          {agent === 'radar' && effectiveEmpresas.length > 1 && (
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
              Se dispararán {effectiveEmpresas.length} solicitudes de Radar — una por empresa.
            </p>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa o país…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card>
            <CardContent className="p-0 max-h-52 overflow-y-auto">
              {loadingEmpresas ? (
                <div className="p-2 space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <div className="h-3.5 w-3.5 rounded bg-surface-muted animate-pulse shrink-0" />
                      <div
                        className="h-3 rounded bg-surface-muted animate-pulse"
                        style={{ width: `${55 + (i * 7) % 30}%` }}
                      />
                      <div className="h-3 w-14 rounded bg-surface-muted animate-pulse ml-auto" />
                    </div>
                  ))}
                </div>
              ) : filteredEmpresas.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {search.trim()
                    ? `Sin resultados para "${search}"`
                    : 'Sin empresas — importa el catálogo o usa modo CSV'}
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filteredEmpresas.slice(0, 100).map(empresa => {
                    const isSelected = selected.some(e => e.id === empresa.id);
                    const Icon = isSelected ? CheckSquare : Square;
                    return (
                      <li key={empresa.id}>
                        <button
                          type="button"
                          onClick={() => toggleEmpresa(empresa)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                            isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-surface-muted/40',
                          )}
                        >
                          <Icon size={14} className={isSelected ? 'text-blue-600' : 'text-muted-foreground'} />
                          <span className="flex-1 truncate text-foreground">{empresa.nombre}</span>
                          {empresa.pais && (
                            <span className="text-xs text-muted-foreground">{empresa.pais}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {filteredEmpresas.length > 100 && (
            <p className="text-xs text-muted-foreground">
              Mostrando 100 de {filteredEmpresas.length}. Refina con la búsqueda.
            </p>
          )}
        </section>
      )}

      {/* Agent-specific options (right column on desktop) */}
      <section className="space-y-3">
        {/* Batch size: shown for all agents when in BD mode and no manual selection */}
        {!csvMode && effectiveEmpresas.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Lote (aleatorio)
              </label>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                  onClick={() => setBatchSize(b => Math.max(1, b - 1))}>
                  <Minus size={12} />
                </Button>
                <span className="w-10 text-center text-sm tabular-nums">{batchSize}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                  onClick={() => setBatchSize(b => Math.min(maxBatch, b + 1))}>
                  <Plus size={12} />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                empresas aleatorias de la línea
              </span>
            </div>
            {/* Auto-mode info banner */}
            <div className="flex items-center gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary">
              <Info size={14} className="shrink-0" />
              Modo automático activado — el sistema seleccionará las mejores empresas de esta línea
            </div>
          </div>
        )}
        {!csvMode && effectiveEmpresas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {effectiveEmpresas.length} empresa{effectiveEmpresas.length > 1 ? 's' : ''} seleccionada{effectiveEmpresas.length > 1 ? 's' : ''} manualmente
          </p>
        )}

        {agent === 'prospector' && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Contactos por empresa
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setContactosPorEmpresa(c => Math.max(1, c - 1))}>
                <Minus size={12} />
              </Button>
              <span className="w-10 text-center text-sm tabular-nums">{contactosPorEmpresa}</span>
              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setContactosPorEmpresa(c => Math.min(10, c + 1))}>
                <Plus size={12} />
              </Button>
            </div>
          </div>
        )}

        {(agent === 'radar' || agent === 'prospector') && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Tier
            </label>
            <div className="flex gap-1">
              {(['ORO', 'MONITOREO', 'PLATA'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-semibold border transition-colors',
                    tier === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-surface text-muted-foreground border-border hover:border-border',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      </div>{/* /grid 2-col */}

      {/* Fire button + status */}
      <section className="space-y-3">
        {hasInflight && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle size={14} />
            Ya hay un {meta.title.toLowerCase()} corriendo. Espera a que termine antes de disparar otro.
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="button"
            onClick={onFire}
            disabled={!canFire}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[160px]"
            data-testid={`fire-${agent}`}
          >
            {firing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Zap size={14} />
                {meta.cta}
              </>
            )}
          </Button>

          {/* Company count badge near the button */}
          {!csvMode && effectiveEmpresas.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {effectiveEmpresas.length} empresa{effectiveEmpresas.length > 1 ? 's' : ''}
            </span>
          )}
          {csvMode && csvEmpresas.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {csvEmpresas.length} empresa{csvEmpresas.length > 1 ? 's' : ''} (CSV)
            </span>
          )}
          {!csvMode && effectiveEmpresas.length === 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground">
              {batchSize} empresa{batchSize > 1 ? 's' : ''} · modo automático
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {lastExecutionId && (
          <AgentPipelineCard executionId={lastExecutionId} />
        )}
      </section>
    </div>
  );
}
