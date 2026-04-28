'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Filter, ChevronRight } from 'lucide-react';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';
import { formatFechaRadar } from '@/lib/utils/parseFechaRadar';

interface PortfolioRow {
  id: number;
  company_name: string;
  pais: string | null;
  pais_nombre: string | null;
  tier_actual: string;
  score_total_ultimo: number | null;
  score_radar_ultimo: number | null;
  composite_score_ultimo: number | null;
  radar_activo: string;
  pipeline: string;
  ultimo_scan_at: string | null;
  ultima_calificacion_at: string | null;
  meta: Record<string, unknown> | null;
  contactos_count: number;
  ultima_senal_descripcion: string | null;
  ultima_senal_tipo: string | null;
  ultima_senal_fecha: string | null;
}

interface PortfolioResponse {
  data: PortfolioRow[];
  meta: { total: number; page: number; limit: number };
  warning?: string;
}

type Tab = 'todas' | 'con_inversion' | 'nuevas' | 'historial';

const TIER_COLORS: Record<string, string> = {
  A: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/40',
  B: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40',
  C: 'bg-sky-500/15 text-sky-600 border-sky-500/40',
  D: 'bg-muted/50 text-muted-foreground border-border',
  sin_calificar: 'bg-muted/30 text-muted-foreground border-dashed border-border',
};

export function PortfolioView() {
  const [linea, setLinea]   = useState<string>('');
  const [tier, setTier]     = useState<string>('');
  const [pais, setPais]     = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [tab, setTab]       = useState<Tab>('todas');
  const [data, setData]     = useState<PortfolioRow[]>([]);
  const [total, setTotal]   = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError]   = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (linea)  qs.set('linea', linea);
        if (tier)   qs.set('tier', tier);
        if (pais)   qs.set('pais', pais);
        if (search) qs.set('q', search);
        if (tab === 'con_inversion') qs.set('radar', 'true');
        if (tab === 'nuevas')        qs.set('source', 'radar_signal');
        qs.set('limit', '100');

        const resp = await fetch(`/api/portfolio?${qs.toString()}`);
        const json = (await resp.json()) as PortfolioResponse | { error: string };
        if (!resp.ok || 'error' in json) {
          setError(('error' in json && json.error) || `HTTP ${resp.status}`);
          setData([]);
          setTotal(0);
          return;
        }
        setData(json.data);
        setTotal(json.meta.total);
        if (json.warning) setError(`Warning: ${json.warning}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 300); // debounce
    return () => clearTimeout(timer);
  }, [linea, tier, pais, search, tab]);

  const tabs: Array<{ id: Tab; label: string }> = useMemo(() => [
    { id: 'todas', label: 'Todas' },
    { id: 'con_inversion', label: 'Con inversión' },
    { id: 'nuevas', label: 'Empresas nuevas' },
    { id: 'historial', label: 'Historial' },
  ], []);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              <Search size={12} className="mr-1 inline" /> Buscar empresa
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Grupo Bimbo, Aeropuerto El Dorado…"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              <Filter size={12} className="mr-1 inline" /> Línea
            </label>
            <select
              value={linea}
              onChange={(e) => setLinea(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {LINEAS_CONFIG.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">TIER</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="A">A · ORO</option>
              <option value="B">B · MONITOREO</option>
              <option value="C">C · ARCHIVO</option>
              <option value="D">D · DESCARTAR</option>
              <option value="sin_calificar">Sin calificar</option>
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">País</label>
            <Input
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              placeholder="Colombia"
            />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'border-b-2 px-3 py-2 text-sm transition-colors ' +
              (tab === t.id
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto pr-2 text-xs text-muted-foreground">
          {loading ? <Loader2 size={14} className="inline animate-spin" /> : `${total} empresas`}
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {/* Tabla */}
      <div className="space-y-1.5">
        {data.length === 0 && !loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No hay empresas que coincidan con los filtros.
          </Card>
        )}
        {data.map((row) => {
          const expanded = expandedId === row.id;
          const tierClass = TIER_COLORS[row.tier_actual] ?? TIER_COLORS.sin_calificar;
          const country = row.pais ?? row.pais_nombre ?? '—';
          const radarOn = row.radar_activo === 'activo';
          const isNew = row.meta?.source === 'radar_signal';
          return (
            <Card key={row.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : row.id)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <ChevronRight
                    size={14}
                    className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{row.company_name}</span>
                      <span className="text-xs text-muted-foreground">{country}</span>
                      {isNew && (
                        <Badge variant="outline" className="border-primary text-primary text-[10px]">
                          Nueva
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}>
                    {row.tier_actual === 'sin_calificar' ? 'Sin calif.' : row.tier_actual}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                    {row.composite_score_ultimo?.toFixed(0) ?? '—'}
                  </span>
                  <span className={radarOn ? 'text-emerald-500' : 'text-muted-foreground'}>
                    {radarOn ? '✓ radar' : '— radar'}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground w-20 text-right">
                    {row.contactos_count} contac.
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline w-24 text-right">
                    {row.ultimo_scan_at
                      ? formatFechaRadar(new Date(row.ultimo_scan_at).toLocaleDateString('es-CO'))
                      : '—'}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-border bg-muted/20 px-4 py-3 text-sm">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Detail label="Pipeline">{row.pipeline}</Detail>
                    <Detail label="Score TIER">{row.score_total_ultimo?.toFixed(2) ?? '—'}</Detail>
                    <Detail label="Score Radar">{row.score_radar_ultimo?.toFixed(2) ?? '—'}</Detail>
                  </div>
                  {row.ultima_senal_descripcion && (
                    <div className="mt-3 rounded-md border border-border bg-background p-3">
                      <p className="text-xs font-medium text-primary">
                        {row.ultima_senal_tipo ?? 'Última señal'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                        {row.ultima_senal_descripcion}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">Re-escanear</Button>
                    <Button size="sm" variant="outline">Calificar</Button>
                    <Button size="sm" variant="outline">Buscar contactos</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}
