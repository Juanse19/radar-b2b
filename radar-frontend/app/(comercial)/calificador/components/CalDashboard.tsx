'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Star, TrendingUp, Archive, MinusCircle, Plus, Search, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type TierKey = 'A' | 'B' | 'C' | 'D';

interface CalRow {
  id:             number;
  empresa_nombre: string | null;
  pais:           string | null;
  linea_negocio:  string | null;
  tier_calculado: string;
  score_total:    number | string | null;
  provider:       string | null;
  created_at:     string;
}

interface DashboardResponse {
  stats:           Record<TierKey, number>;
  empresasUnicas:  number;
  calificaciones:  CalRow[];
  total:           number;
}

// ─── Tier visual config ───────────────────────────────────────────────────────

const TIER_CARDS: Array<{
  key:      TierKey;
  label:    string;
  sublabel: string;
  icon:     typeof Star;
  color:    string;
  bgClass:  string;
  textClass:string;
  borderClass: string;
}> = [
  {
    key: 'A', label: 'Tier A', sublabel: 'Cuentas ORO',
    icon: Star,        color: '#b9842a',
    bgClass:    'bg-amber-500/10',
    textClass:  'text-amber-700',
    borderClass:'border-amber-500/30',
  },
  {
    key: 'B', label: 'Tier B', sublabel: 'Monitoreo',
    icon: TrendingUp, color: '#1f5d8d',
    bgClass:    'bg-blue-500/10',
    textClass:  'text-blue-700',
    borderClass:'border-blue-500/30',
  },
  {
    key: 'C', label: 'Tier C', sublabel: 'Archivo',
    icon: Archive,    color: '#5c6f81',
    bgClass:    'bg-slate-500/10',
    textClass:  'text-slate-700',
    borderClass:'border-slate-500/30',
  },
  {
    key: 'D', label: 'Sin señal', sublabel: 'No calificable',
    icon: MinusCircle, color: '#8b9099',
    bgClass:    'bg-muted/40',
    textClass:  'text-muted-foreground',
    borderClass:'border-border',
  },
];

const TIER_BADGE_CLS: Record<TierKey, string> = {
  A: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  B: 'bg-blue-500/15  text-blue-700  border-blue-500/30',
  C: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  D: 'bg-muted        text-muted-foreground',
};

const TIER_LABEL: Record<TierKey, string> = {
  A: 'Tier A',
  B: 'Tier B',
  C: 'Tier C',
  D: 'Sin señal',
};

function toTierKey(raw: string): TierKey {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  if (raw === 'B-Alta' || raw === 'B-Baja') return 'B';
  return 'C';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalDashboard() {
  const [data, setData]       = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterTier, setFilterTier] = useState<TierKey | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/calificador/dashboard?limit=200', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: DashboardResponse | null) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => { /* ignored — UI shows empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.calificaciones;
    if (filterTier !== 'all') {
      rows = rows.filter(r => toTierKey(r.tier_calculado) === filterTier);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.empresa_nombre ?? '').toLowerCase().includes(q) ||
        (r.pais ?? '').toLowerCase().includes(q) ||
        (r.linea_negocio ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, filterTier, search]);

  return (
    <div className="space-y-6">
      {/* Header con CTA principal */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Empresas calificadas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Distribución por Tier de las empresas que has calificado.
          </p>
        </div>
        <Link href="/calificador/wizard">
          <Button size="sm" className="gap-1">
            <Plus size={14} /> Nueva calificación
          </Button>
        </Link>
      </div>

      {/* Tier distribution cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TIER_CARDS.map((t) => {
          const count    = data?.stats?.[t.key] ?? 0;
          const Icon     = t.icon;
          const isActive = filterTier === t.key;
          return (
            <Card
              key={t.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => setFilterTier(isActive ? 'all' : t.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFilterTier(isActive ? 'all' : t.key);
                }
              }}
              className={cn(
                'cursor-pointer p-4 transition-all hover:shadow-md',
                t.bgClass, t.borderClass,
                isActive && 'ring-2 ring-offset-1 shadow-md',
              )}
              style={isActive ? { boxShadow: `0 0 0 2px ${t.color}` } : undefined}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} className={t.textClass} />
                    <span className={cn('text-xs font-semibold uppercase tracking-wide', t.textClass)}>
                      {t.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t.sublabel}</p>
                </div>
              </div>
              <p className={cn('mt-2 font-mono text-3xl font-bold tabular-nums', t.textClass)}>
                {loading ? '—' : count}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, país o línea…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {filterTier !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setFilterTier('all')}>
            Limpiar filtro tier
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {loading ? 'Cargando…' : `${filtered.length} de ${data?.total ?? 0} empresas`}
        </span>
      </div>

      {/* Tabla de empresas calificadas */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Empresa</th>
              <th className="px-4 py-3 text-left font-medium">País</th>
              <th className="px-4 py-3 text-left font-medium">Línea</th>
              <th className="px-4 py-3 text-left font-medium">Tier</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Calificada</th>
              <th className="px-4 py-3 w-1" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Cargando empresas…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Building2 size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm font-medium">
                    {data?.total ? 'No hay empresas con ese filtro' : 'Aún no has calificado empresas'}
                  </p>
                  {!data?.total && (
                    <Link href="/calificador/wizard" className="mt-2 inline-block">
                      <Button size="sm" variant="outline" className="gap-1">
                        <Plus size={14} /> Calificar la primera
                      </Button>
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {!loading && filtered.map((row) => {
              const tierK = toTierKey(row.tier_calculado);
              const score = typeof row.score_total === 'string'
                ? Number(row.score_total)
                : (row.score_total ?? 0);
              return (
                <tr key={row.id} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/calificador/cuentas/${row.id}`}
                      className="hover:underline"
                    >
                      {row.empresa_nombre ?? <span className="text-muted-foreground">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.pais ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.linea_negocio ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('h-5 text-[10px] border', TIER_BADGE_CLS[tierK])}>
                      {TIER_LABEL[tierK]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {score.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/calificador/cuentas/${row.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
