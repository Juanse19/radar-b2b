'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, Search, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InformeEjecucion } from '@/app/comercial/components/InformeEjecucion';

interface Session {
  session_id:     string;
  linea_negocio:  string;
  created_at:     string;
  empresas_count: number;
  activas_count:  number;
  total_cost_usd: number;
}

interface WeekSession {
  id:                string;
  linea_negocio:     string;
  created_at:        string;
  empresas_count:    number;
  activas_count:     number;
  descartadas_count: number;
  total_cost_usd:    number;
  has_report:        boolean;
}

interface WeeklySummary {
  week:     string;
  sessions: WeekSession[];
  totals: {
    sesiones:    number;
    empresas:    number;
    activas:     number;
    descartadas: number;
    costo_usd:   number;
  };
}

interface RawResult {
  session_id?:   string;
  linea_negocio?: string;
  created_at?:   string;
  radar_activo?: string;
  // BUG I2: Postgres NUMERIC columns arrive as strings over HTTP
  cost_usd?:     number | string | null;
}

const LINEA_BORDER: Record<string, string> = {
  'BHS':             'border-l-blue-500',
  'Intralogística':  'border-l-purple-500',
  'Cartón':          'border-l-amber-500',
  'Final de Línea':  'border-l-orange-500',
  'Motos':           'border-l-red-500',
  'SOLUMAT':         'border-l-teal-500',
  'Solumat':         'border-l-teal-500',
  'Cargo':           'border-l-sky-500',
};

const LINEA_BADGE: Record<string, string> = {
  'BHS':             'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Intralogística':  'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Cartón':          'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'Final de Línea':  'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Motos':           'bg-red-500/10 text-red-700 dark:text-red-400',
  'SOLUMAT':         'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Solumat':         'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Cargo':           'bg-sky-500/10 text-sky-700 dark:text-sky-400',
};

const PAGE_SIZE = 10;

function getLineBorder(linea: string): string {
  return LINEA_BORDER[linea] ?? 'border-l-border';
}

function getLineBadgeCls(linea: string): string {
  return LINEA_BADGE[linea] ?? 'bg-muted text-muted-foreground';
}

export default function InformesPage() {
  const [sessions,      setSessions]      = useState<Session[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [informeOpen,   setInformeOpen]   = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [activeTab,     setActiveTab]     = useState<'sesiones' | 'semanal'>('sesiones');
  const [weeklyData,    setWeeklyData]    = useState<WeeklySummary | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [selectedWeek,  setSelectedWeek]  = useState<string>(''); // empty = current week

  const fetchWeekly = useCallback(async (week: string) => {
    setWeeklyLoading(true);
    try {
      const qs = week ? `?week=${week}` : '';
      const res = await fetch(`/api/comercial/reports/weekly${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWeeklyData(await res.json());
    } catch {
      setWeeklyData(null);
    } finally {
      setWeeklyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/comercial/results?limit=200')
      .then(r => r.ok ? r.json() : { results: [] })
      .then((body: { results?: RawResult[] } | RawResult[]) => {
        const rows: RawResult[] = Array.isArray(body)
          ? body
          : ((body as { results?: RawResult[] }).results ?? []);

        // Group by session_id
        const grouped = new Map<string, Session>();
        for (const r of rows) {
          if (!r.session_id) continue;
          const existing = grouped.get(r.session_id);
          // BUG I2 FIX: Postgres NUMERIC columns come back as strings over HTTP.
          const rowCost  = parseFloat(r.cost_usd as unknown as string) || 0;
          const isActiva = r.radar_activo === 'Sí';
          if (existing) {
            existing.empresas_count += 1;
            existing.total_cost_usd += rowCost;
            if (isActiva) existing.activas_count += 1;
          } else {
            grouped.set(r.session_id, {
              session_id:     r.session_id,
              linea_negocio:  r.linea_negocio ?? '',
              created_at:     r.created_at ?? '',
              empresas_count: 1,
              activas_count:  isActiva ? 1 : 0,
              total_cost_usd: rowCost,
            });
          }
        }
        setSessions(
          Array.from(grouped.values()).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          ),
        );
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // Client-side filter by linea or date substring
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s =>
      s.linea_negocio.toLowerCase().includes(q) ||
      s.created_at.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Informes de Ejecución</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sesiones de escaneo ejecutadas</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold">Informes de Ejecución</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} registrada{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('sesiones')}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'sesiones'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Sesiones
        </button>
        <button
          onClick={() => { setActiveTab('semanal'); fetchWeekly(selectedWeek); }}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'semanal'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Resumen semanal
        </button>
      </div>

      {/* ── Sesiones tab ── */}
      {activeTab === 'sesiones' && (
        <>
          {/* Search / filter — only shown when there are sessions */}
          {sessions.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por línea o fecha..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE); // reset pagination on new search
                }}
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}

          {/* Empty state */}
          {sessions.length === 0 ? (
            <Card className="p-12 text-center">
              <ScanLine size={40} className="mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No hay sesiones registradas aún</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ejecuta tu primer escaneo.{' '}
                <a href="/escanear" className="text-primary hover:underline">
                  Ir a Escanear
                </a>
              </p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin resultados para &ldquo;{search}&rdquo;</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setSearch('')}>
                Limpiar filtro
              </Button>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {visible.map((s) => (
                  <Card
                    key={s.session_id}
                    className={cn(
                      'border-l-4 overflow-hidden p-0 transition-all duration-200 hover:shadow-md',
                      getLineBorder(s.linea_negocio),
                    )}
                  >
                    {/* Card body */}
                    <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Linea badge + status chip */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              getLineBadgeCls(s.linea_negocio),
                            )}
                          >
                            {s.linea_negocio || 'Sin línea'}
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-4 bg-green-500/10 text-[10px] text-green-700 dark:text-green-400"
                          >
                            Completado
                          </Badge>
                        </div>

                        {/* Date */}
                        <p className="text-xs text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleString('es-CO') : '—'}
                        </p>

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">{s.empresas_count}</span>{' '}
                            empresa{s.empresas_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-border">·</span>
                          <span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {s.activas_count}
                            </span>{' '}
                            activa{s.activas_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-border">·</span>
                          <span className="font-mono">${(s.total_cost_usd ?? 0).toFixed(4)} USD</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setInformeOpen(s.session_id)}
                        >
                          <FileText size={12} className="mr-1" />
                          Ver informe
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() =>
                            window.open(`/api/comercial/export?sessionId=${s.session_id}`)
                          }
                        >
                          <Download size={12} className="mr-1" />
                          Exportar CSV
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  >
                    Cargar más ({filtered.length - visibleCount} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Resumen semanal tab ── */}
      {activeTab === 'semanal' && (
        <div className="space-y-4">
          {/* Week picker */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground shrink-0">Semana:</label>
            <input
              type="week"
              value={selectedWeek}
              onChange={e => {
                setSelectedWeek(e.target.value);
                fetchWeekly(e.target.value);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {weeklyData && (
              <span className="text-xs text-muted-foreground">{weeklyData.week}</span>
            )}
          </div>

          {/* Loading skeleton */}
          {weeklyLoading && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}

          {/* Content once loaded */}
          {!weeklyLoading && weeklyData && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{weeklyData.totals.sesiones}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Sesiones</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{weeklyData.totals.empresas}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Empresas</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {weeklyData.totals.activas}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Activas</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold font-mono">
                    ${weeklyData.totals.costo_usd.toFixed(4)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Costo USD</p>
                </Card>
              </div>

              {/* Sessions table or empty state */}
              {weeklyData.sessions.length === 0 ? (
                <Card className="p-10 text-center">
                  <ScanLine size={36} className="mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No hay sesiones en esta semana
                  </p>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                          <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                          <th className="px-4 py-2.5 text-left font-medium">Línea</th>
                          <th className="px-4 py-2.5 text-right font-medium">Empresas</th>
                          <th className="px-4 py-2.5 text-right font-medium">Activas</th>
                          <th className="px-4 py-2.5 text-right font-medium">Desc.</th>
                          <th className="px-4 py-2.5 text-right font-medium">Costo USD</th>
                          <th className="px-4 py-2.5 text-right font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {weeklyData.sessions.map((ws) => (
                          <tr key={ws.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {ws.created_at ? new Date(ws.created_at).toLocaleString('es-CO') : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                  getLineBadgeCls(ws.linea_negocio),
                                )}
                              >
                                {ws.linea_negocio || 'Sin línea'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              {ws.empresas_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-medium">
                              {ws.activas_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                              {ws.descartadas_count}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">
                              ${ws.total_cost_usd.toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {ws.has_report && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setInformeOpen(ws.id)}
                                >
                                  <FileText size={11} className="mr-1" />
                                  Ver informe
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Prompt to load when no data yet and not loading */}
          {!weeklyLoading && !weeklyData && (
            <Card className="p-10 text-center">
              <ScanLine size={36} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Selecciona una semana o haz clic en &ldquo;Resumen semanal&rdquo; para ver la semana actual
              </p>
            </Card>
          )}
        </div>
      )}

      {informeOpen && (
        <InformeEjecucion
          sessionId={informeOpen}
          open={!!informeOpen}
          onClose={() => setInformeOpen(null)}
        />
      )}
    </div>
  );
}
