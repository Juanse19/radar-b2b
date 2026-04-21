'use client';

import { ExternalLink, FileText, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FuenteBadge } from '@/app/radar-v2/components/FuenteBadge';
import type { RadarV2Result } from '@/lib/radar-v2/types';

interface Props {
  results:       RadarV2Result[];
  loading?:      boolean;
  onLoadMore?:   () => void;
  hasMore?:      boolean;
  onVerInforme?: (sessionId: string) => void;
}

const ventanaShort: Record<string, string> = {
  '0-6 Meses':   '0–6m',
  '6-12 Meses':  '6–12m',
  '12-18 Meses': '12–18m',
  '18-24 Meses': '18–24m',
  '> 24 Meses':  '>24m',
  'Sin señal':   '—',
};

// Score pill: coloured based on criterios count
function ScorePill({ count, total = 6 }: { count: number; total?: number }) {
  const pct   = total > 0 ? count / total : 0;
  const color = pct >= 0.67 ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
              : pct >= 0.34 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
              : 'bg-muted/60 text-muted-foreground border-border';
  if (count === 0) return <span className="text-xs text-muted-foreground">0/{total}</span>;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums', color)}>
      {count}/{total}
    </span>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText size={32} className="mb-3 text-muted-foreground/40" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">Sin resultados</p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        No hay señales que coincidan con los filtros activos.
      </p>
    </div>
  );
}

// Loading skeleton rows
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border/40">
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-4 w-full max-w-[120px] rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Mobile card (< md) ────────────────────────────────────────────────────────

function MobileCard({
  r,
  onVerInforme,
}: {
  r: RadarV2Result;
  onVerInforme?: (sessionId: string) => void;
}) {
  const isActiva       = r.radar_activo === 'Sí';
  const criteriosCount = Array.isArray(r.criterios_cumplidos) ? r.criterios_cumplidos.length : 0;
  const descripcion    = r.descripcion_resumen?.trim() ?? '';

  return (
    <div
      role={r.session_id && onVerInforme ? 'button' : undefined}
      tabIndex={r.session_id && onVerInforme ? 0 : undefined}
      onClick={() => r.session_id && onVerInforme?.(r.session_id)}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && r.session_id && onVerInforme) {
          e.preventDefault();
          onVerInforme(r.session_id);
        }
      }}
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isActiva
          ? 'border-green-500/25 bg-green-500/5 hover:bg-green-500/10'
          : 'border-border bg-card hover:bg-muted/30',
        r.session_id && onVerInforme ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : '',
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium leading-tight">{r.empresa_evaluada}</p>
          {r.pais && <p className="mt-0.5 text-xs text-muted-foreground">{r.pais}</p>}
        </div>
        {isActiva ? (
          <Badge className="shrink-0 border-green-500/30 bg-green-500/10 text-xs font-semibold text-green-700 dark:text-green-400">
            Activa
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
            Descartada
          </Badge>
        )}
      </div>

      {/* Signal info */}
      {isActiva && (
        <div className="mt-2.5 space-y-1.5">
          {r.tipo_senal && (
            <p className="text-xs text-foreground/80">{r.tipo_senal}</p>
          )}
          {descripcion && (
            <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{descripcion}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <ScorePill count={criteriosCount} />
            {r.ventana_compra && r.ventana_compra !== 'Sin señal' && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {ventanaShort[r.ventana_compra] ?? r.ventana_compra}
              </Badge>
            )}
            {r.monto_inversion && r.monto_inversion !== 'No reportado' && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {r.monto_inversion}
              </span>
            )}
            {r.fuente_link && r.fuente_link !== 'No disponible' && (
              <a
                href={r.fuente_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex min-h-[28px] items-center gap-1 text-xs text-primary hover:underline"
                aria-label={`Ver fuente: ${r.fuente_nombre ?? 'Fuente'}`}
              >
                <ExternalLink size={11} />
                Fuente
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function ResultadosTable({ results, loading, onLoadMore, hasMore, onVerInforme }: Props) {
  if (loading && !results.length) {
    return (
      <div className="space-y-3">
        {/* Mobile skeletons */}
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        {/* Desktop skeleton table */}
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                {['Empresa', 'Estado', 'Tipo señal', 'Score', 'Descripción', 'Ventana', 'Monto', 'Fecha'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody><TableSkeleton /></tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!results.length) return <EmptyState />;

  return (
    <TooltipProvider>
      <div className="space-y-3">

        {/* ── Mobile cards (< md) ─────────────────────────────────────────── */}
        <div className="space-y-2 md:hidden">
          {results.map((r, i) => (
            <MobileCard key={r.id ?? i} r={r} onVerInforme={onVerInforme} />
          ))}
        </div>

        {/* ── Desktop table (md+) ─────────────────────────────────────────── */}
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-medium">Empresa</th>
                <th className="px-3 py-2.5 text-left font-medium">Estado</th>
                <th className="px-3 py-2.5 text-left font-medium">Tipo señal</th>
                <th className="px-3 py-2.5 text-left font-medium">Score</th>
                <th className="px-3 py-2.5 text-left font-medium">Descripción</th>
                <th className="px-3 py-2.5 text-left font-medium">Ventana</th>
                <th className="px-3 py-2.5 text-left font-medium">Monto</th>
                <th className="px-3 py-2.5 text-left font-medium">Fuente</th>
                <th className="px-3 py-2.5 text-left font-medium">Verif.</th>
                <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const isActiva       = r.radar_activo === 'Sí';
                const criteriosCount = Array.isArray(r.criterios_cumplidos)
                  ? r.criterios_cumplidos.length : 0;
                const descripcion = r.descripcion_resumen?.trim() ?? '';

                return (
                  <tr
                    key={r.id ?? i}
                    onClick={() => r.session_id && onVerInforme?.(r.session_id)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ' ') && r.session_id && onVerInforme) {
                        e.preventDefault();
                        onVerInforme(r.session_id);
                      }
                    }}
                    tabIndex={r.session_id && onVerInforme ? 0 : undefined}
                    role={r.session_id && onVerInforme ? 'button' : undefined}
                    aria-label={r.session_id && onVerInforme ? `Ver informe de ${r.empresa_evaluada}` : undefined}
                    className={cn(
                      'border-b border-border/40 transition-colors',
                      isActiva
                        ? 'bg-green-500/[0.03] hover:bg-green-500/[0.07]'
                        : i % 2 === 0
                          ? 'bg-background hover:bg-muted/20'
                          : 'bg-muted/[0.03] hover:bg-muted/20',
                      r.session_id && onVerInforme
                        ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
                        : '',
                    )}
                  >
                    {/* Empresa */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isActiva && (
                          <span className="h-full w-0.5 self-stretch rounded-full bg-green-500/60" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium max-w-[160px]">{r.empresa_evaluada}</p>
                          {r.pais && (
                            <p className="truncate text-xs text-muted-foreground">{r.pais}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-2.5">
                      {isActiva ? (
                        <Badge className="border-green-500/30 bg-green-500/10 text-xs font-semibold text-green-700 dark:text-green-400">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Descartada
                        </Badge>
                      )}
                    </td>

                    {/* Tipo señal */}
                    <td className="max-w-[140px] px-3 py-2.5">
                      <p className="truncate text-xs">{r.tipo_senal ?? '—'}</p>
                    </td>

                    {/* Score */}
                    <td className="px-3 py-2.5">
                      {criteriosCount > 0 ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-default">
                              <ScorePill count={criteriosCount} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <ul className="list-disc space-y-0.5 pl-4 text-xs">
                              {r.criterios_cumplidos.map((c, idx) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">0/6</span>
                      )}
                    </td>

                    {/* Descripción */}
                    <td className="max-w-[240px] px-3 py-2.5">
                      {descripcion ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <p className="line-clamp-2 cursor-default text-xs text-foreground/80">
                              {descripcion}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="whitespace-pre-wrap text-xs leading-relaxed">{descripcion}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Ventana */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium tabular-nums">
                        {ventanaShort[r.ventana_compra] ?? r.ventana_compra ?? '—'}
                      </span>
                    </td>

                    {/* Monto */}
                    <td className="max-w-[130px] px-3 py-2.5">
                      {r.monto_inversion && r.monto_inversion !== 'No reportado' ? (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {r.monto_inversion}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Fuente */}
                    <td className="px-3 py-2.5">
                      {r.fuente_link && r.fuente_link !== 'No disponible' ? (
                        <a
                          href={r.fuente_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          aria-label={`Ver fuente: ${r.fuente_nombre ?? 'Fuente'}`}
                          className="inline-flex min-h-[28px] items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                        >
                          <ExternalLink size={11} />
                          <span className="max-w-[80px] truncate">
                            {r.fuente_nombre?.split('(')[0]?.trim() ?? 'Fuente'}
                          </span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Verif */}
                    <td className="px-3 py-2.5">
                      <FuenteBadge status={r.fuente_verificada} notas={r.verificacion_notas} />
                    </td>

                    {/* Fecha */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString('es-CO', {
                            day:   '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Load-more */}
        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className="min-h-[44px] gap-2"
            >
              {loading ? 'Cargando...' : (
                <>
                  <ChevronDown size={14} />
                  Cargar más resultados
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
