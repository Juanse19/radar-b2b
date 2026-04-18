'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, Search, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InformeEjecucion } from '@/app/radar-v2/components/InformeEjecucion';

interface Session {
  session_id:     string;
  linea_negocio:  string;
  created_at:     string;
  empresas_count: number;
  activas_count:  number;
  total_cost_usd: number;
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
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [informeOpen,  setInformeOpen]  = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch('/api/radar-v2/results?limit=200')
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
            <a href="/radar-v2/escanear" className="text-primary hover:underline">
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
                        window.open(`/api/radar-v2/export?sessionId=${s.session_id}`)
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
