'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, RotateCcw, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TierStatStrip } from './TierStatStrip';
import { EmpresaRollupTable } from './EmpresaRollupTable';
import { EmpresaRollupCard } from './EmpresaRollupCard';
import type {
  EmpresaRollup,
  EmpresaRollupCounts,
  TierLetter,
} from '@/lib/comercial/types';

interface ResultadosOverviewProps {
  onSelectEmpresa: (e: EmpresaRollup) => void;
}

const LINEA_OPTIONS = [
  { value: 'ALL',             label: 'Todas las líneas' },
  { value: 'BHS',             label: 'BHS — Aeropuertos' },
  { value: 'Intralogística',  label: 'Intralogística' },
  { value: 'Cartón',          label: 'Cartón Corrugado' },
  { value: 'Final de Línea',  label: 'Final de Línea' },
  { value: 'Motos',           label: 'Motos' },
  { value: 'SOLUMAT',         label: 'Solumat' },
];

const TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL',             label: 'Todos los tiers' },
  { value: 'A',               label: 'Tier A' },
  { value: 'B',               label: 'Tier B' },
  { value: 'C',               label: 'Tier C' },
  { value: 'D',               label: 'Tier D' },
  { value: 'sin_calificar',   label: 'Sin calificar' },
];

const PAGE_SIZE = 50;

const EMPTY_COUNTS: EmpresaRollupCounts = {
  total:    0,
  por_tier: { A: 0, B: 0, C: 0, D: 0, sin_calificar: 0, null: 0 },
  con_radar: 0,
};

export function ResultadosOverview({ onSelectEmpresa }: ResultadosOverviewProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Read initial filter state from URL
  const [linea,  setLinea]  = useState(searchParams.get('linea')  ?? 'ALL');
  const [tier,   setTier]   = useState(searchParams.get('tier')   ?? 'ALL');
  const [radar,  setRadar]  = useState<'ALL' | 'Sí' | 'No'>(
    (searchParams.get('radar') ?? 'ALL') as 'ALL' | 'Sí' | 'No',
  );
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const [empresas,  setEmpresas]  = useState<EmpresaRollup[]>([]);
  const [counts,    setCounts]    = useState<EmpresaRollupCounts>(EMPTY_COUNTS);
  const [loading,   setLoading]   = useState(true);
  const [offset,    setOffset]    = useState(0);
  const [hasMore,   setHasMore]   = useState(false);

  // Persist filters to URL (debounced-ish via useEffect after state settles)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (linea  !== 'ALL') params.set('linea',  linea);  else params.delete('linea');
    if (tier   !== 'ALL') params.set('tier',   tier);   else params.delete('tier');
    if (radar  !== 'ALL') params.set('radar',  radar);  else params.delete('radar');
    if (search)           params.set('search', search); else params.delete('search');
    // Keep other params (e.g. tab) intact
    router.replace(`?${params.toString()}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linea, tier, radar, search]);

  const fetchEmpresas = useCallback(async (newOffset = 0, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linea  !== 'ALL') params.set('linea',  linea);
      if (tier   !== 'ALL') params.set('tier',   tier as TierLetter);
      if (radar  !== 'ALL') params.set('radar',  radar);
      if (search)           params.set('search', search);
      params.set('limit',  String(PAGE_SIZE + 1));
      params.set('offset', String(newOffset));

      const res  = await fetch(`/api/comercial/results/grouped?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as {
        rows:   EmpresaRollup[];
        counts: EmpresaRollupCounts;
      };

      const page = data.rows.slice(0, PAGE_SIZE);
      setHasMore(data.rows.length > PAGE_SIZE);
      setEmpresas(prev => append ? [...prev, ...page] : page);
      setOffset(newOffset);
      if (!append) setCounts(data.counts);
    } catch {
      // ignore — keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [linea, tier, radar, search]);

  useEffect(() => {
    void fetchEmpresas(0, false);
  }, [fetchEmpresas]);

  const filtersActive = linea !== 'ALL' || tier !== 'ALL' || radar !== 'ALL' || search !== '';

  function resetFilters() {
    setLinea('ALL');
    setTier('ALL');
    setRadar('ALL');
    setSearch('');
  }

  const loadMore = () => fetchEmpresas(offset + PAGE_SIZE, true);

  return (
    <div className="flex flex-col gap-4">
      {/* Stat strip */}
      <TierStatStrip counts={counts} loading={loading} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Filter size={10} aria-hidden />
            Buscar
          </label>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Empresa…"
              className="h-8 w-44 pl-7 text-xs"
              aria-label="Buscar empresa"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Línea</label>
          <Select value={linea} onValueChange={v => setLinea(v ?? 'ALL')}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Filtrar por línea">
              <SelectValue placeholder="Todas las líneas" />
            </SelectTrigger>
            <SelectContent>
              {LINEA_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tier</label>
          <Select value={tier} onValueChange={v => setTier(v ?? 'ALL')}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filtrar por tier">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estado</label>
          <Select value={radar} onValueChange={v => setRadar(v as 'ALL' | 'Sí' | 'No')}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filtrar por estado radar">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">Todos</SelectItem>
              <SelectItem value="Sí"  className="text-xs">Con señal</SelectItem>
              <SelectItem value="No"  className="text-xs">Sin señal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground self-end"
            onClick={resetFilters}
            aria-label="Limpiar filtros"
          >
            <RotateCcw size={11} />
            Limpiar
          </Button>
        )}
      </div>

      {/* Table — desktop (≥ md) */}
      <div className="hidden md:block">
        {!loading && empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">Sin empresas</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              No hay empresas que coincidan con los filtros activos.
            </p>
          </div>
        ) : (
          <EmpresaRollupTable
            empresas={empresas}
            loading={loading}
            onSelect={onSelectEmpresa}
          />
        )}
      </div>

      {/* Cards — mobile (< md) */}
      <div className="flex flex-col gap-2 md:hidden">
        {loading && empresas.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 w-full animate-pulse rounded-xl bg-muted"
              aria-hidden
            />
          ))
        ) : !loading && empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">Sin empresas</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              No hay empresas que coincidan con los filtros activos.
            </p>
          </div>
        ) : (
          empresas.map((empresa, i) => (
            <EmpresaRollupCard
              key={empresa.empresa_id ?? `${empresa.empresa_evaluada}-${i}`}
              empresa={empresa}
              onSelect={onSelectEmpresa}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading}
            className="min-h-[44px] gap-2"
          >
            {loading ? 'Cargando…' : (
              <>
                <ChevronDown size={14} />
                Cargar más empresas
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
