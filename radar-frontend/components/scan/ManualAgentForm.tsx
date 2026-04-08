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

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Square, CheckSquare, Minus, Plus, AlertTriangle } from 'lucide-react';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { useInflightExecutions } from '@/hooks/useInflightExecutions';
import { AgentPipelineCard } from '@/components/tracker/AgentPipelineCard';
import { LINEA_OPTIONS } from '@/lib/constants/lineas';
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

export function ManualAgentForm({ agent }: ManualAgentFormProps) {
  const meta = AGENT_LABEL[agent];
  const { anyRunningOfAgent, invalidate } = useInflightExecutions();

  // ── State ────────────────────────────────────────────────────────────────
  const [linea, setLinea]                 = useState<LineaNegocio>('BHS');
  const [batchSize, setBatchSize]         = useState(agent === 'prospector' ? 5 : 10);
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState(3);
  const [tier, setTier]                   = useState<'ORO' | 'MONITOREO' | 'PLATA'>('ORO');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<Empresa[]>([]);
  const [firing, setFiring]               = useState(false);
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Reset selection when línea changes.
  useEffect(() => {
    setSelected([]);
    setSearch('');
  }, [linea]);

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
  const limit = Math.min(totalLinea || 200, 500);
  const { data: empresas = [], isFetching: loadingEmpresas } = useQuery<Empresa[]>({
    queryKey: ['empresasForAgent', linea, limit],
    queryFn:  () => fetchJson<Empresa[]>(`/api/companies?linea=${encodeURIComponent(linea)}&limit=${limit}`),
    enabled:  linea !== 'ALL',
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

  const isSingleEmpresa = agent === 'radar';
  const maxBatch        = Math.min(50, totalLinea || 50);
  const hasInflight     = anyRunningOfAgent(agent);

  // For radar, the "first selected empresa" is what we send.
  // For calificador/prospector, the selected list is what we send.
  const canFire = !firing
    && !hasInflight
    && (isSingleEmpresa
        ? selected.length === 1
        : (selected.length > 0 || batchSize > 0));

  // ── Selection helpers ────────────────────────────────────────────────────
  function toggleEmpresa(empresa: Empresa) {
    setSelected(prev => {
      const exists = prev.some(e => e.id === empresa.id);
      if (isSingleEmpresa) return exists ? [] : [empresa];
      return exists ? prev.filter(e => e.id !== empresa.id) : [...prev, empresa];
    });
  }
  function selectAll()   { if (!isSingleEmpresa) setSelected([...filteredEmpresas]); }
  function deselectAll() { setSelected([]); }

  // ── Fire ─────────────────────────────────────────────────────────────────
  async function onFire() {
    setError(null);
    setFiring(true);
    setLastExecutionId(null);

    try {
      const body: Record<string, unknown> = {
        agent,
        linea,
      };

      if (agent === 'radar') {
        const e = selected[0]!;
        body.options = {
          empresa:            e.nombre,
          pais:               e.pais,
          company_domain:     e.dominio,
          tier,
          score_calificacion: 9,
        };
      } else if (agent === 'prospector') {
        body.empresas  = selected.map(e => ({ nombre: e.nombre, dominio: e.dominio, pais: e.pais, linea: e.linea }));
        body.batchSize = selected.length || batchSize;
        body.options   = { contactosPorEmpresa, tier };
      } else {
        // calificador
        body.empresas  = selected.length > 0
          ? selected.map(e => ({ nombre: e.nombre, dominio: e.dominio, pais: e.pais, linea: e.linea }))
          : undefined;
        body.batchSize = selected.length || batchSize;
      }

      const result = await fetchJson<FireResponse>('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      setLastExecutionId(result.execution_id);
      toast.success(`${meta.title} disparado · pipeline ${result.pipeline_id.slice(0, 8)}`);
      // Wake the global tracker tray so it picks up the new execution immediately.
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
    <div className="space-y-5">
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
        <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
      </header>

      {/* Línea selector */}
      <section className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Línea de negocio
        </label>
        <div className="flex flex-wrap gap-2">
          {LINEA_OPTIONS.map(opt => {
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
          })}
        </div>
      </section>

      {/* Empresa picker */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isSingleEmpresa ? 'Empresa (1)' : `Empresas (${selected.length} seleccionadas)`}
          </label>
          <div className="flex items-center gap-2">
            {!isSingleEmpresa && filteredEmpresas.length > 0 && (
              <>
                <button type="button" onClick={selectAll}   className="text-xs text-blue-600 hover:underline">Seleccionar todas</button>
                <button type="button" onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">Limpiar</button>
              </>
            )}
          </div>
        </div>

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
          <CardContent className="p-0 max-h-64 overflow-y-auto">
            {loadingEmpresas ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Cargando empresas…
              </div>
            ) : filteredEmpresas.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {linea === 'ALL'
                  ? 'Selecciona una línea para ver empresas'
                  : 'Sin empresas — importa el catálogo'}
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

      {/* Agent-specific options */}
      <section className="space-y-3">
        {(agent === 'calificador' || agent === 'prospector') && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Batch size
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
            <span className="text-xs text-muted-foreground">de máx. {maxBatch} por línea</span>
          </div>
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

      {/* Fire button + status */}
      <section className="space-y-3">
        {hasInflight && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle size={14} />
            Ya hay un {meta.title.toLowerCase()} corriendo. Espera a que termine antes de disparar otro.
          </div>
        )}

        <Button
          type="button"
          onClick={onFire}
          disabled={!canFire}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2"
          data-testid={`fire-${agent}`}
        >
          {firing && <Loader2 size={14} className="animate-spin" />}
          {meta.cta}
        </Button>

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
