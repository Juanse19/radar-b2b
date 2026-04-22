'use client';

import { ExternalLink, FileText, ChevronDown, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FuenteBadge } from '@/app/(comercial)/components/FuenteBadge';
import type { ComercialResult } from '@/lib/comercial/types';

interface Props {
  results:       ComercialResult[];
  loading?:      boolean;
  onLoadMore?:   () => void;
  hasMore?:      boolean;
  onVerInforme?: (sessionId: string) => void;
}

const ventanaLabel: Record<string, string> = {
  '0-6 Meses':   '0–6m',
  '6-12 Meses':  '6–12m',
  '12-18 Meses': '12–18m',
  '18-24 Meses': '18–24m',
  '> 24 Meses':  '>24m',
  'Sin señal':   '—',
};

function ventanaStyle(v?: string | null) {
  if (!v || v === 'Sin señal') return 'bg-muted/50 text-muted-foreground border-border/60';
  if (v === '0-6 Meses')  return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-400/30';
  if (v === '6-12 Meses') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30';
  return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/30';
}

function ScorePill({ count, total = 6, criterios }: { count: number; total?: number; criterios?: string[] }) {
  const pct   = total > 0 ? count / total : 0;
  const color = pct >= 0.67
    ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
    : pct >= 0.34
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
      : 'bg-muted/60 text-muted-foreground border-border';
  const pill = (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums leading-none', color)}>
      {count}/{total}
    </span>
  );
  if (!criterios?.length) return pill;
  return (
    <Tooltip>
      <TooltipTrigger><span className="cursor-default">{pill}</span></TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <ul className="list-disc space-y-0.5 pl-3 text-xs">
          {criterios.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <FileText size={26} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">Sin señales</p>
      <p className="mt-1 text-xs text-muted-foreground/60 max-w-[220px]">
        No hay señales que coincidan con los filtros activos.
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border/40">
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-32 rounded" /><Skeleton className="mt-1 h-3 w-20 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-18 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-12 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-full max-w-[160px] rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-7 w-20 rounded-md" /></td>
        </tr>
      ))}
    </>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────

function MobileCard({ r, onVerInforme }: { r: ComercialResult; onVerInforme?: (id: string) => void }) {
  const isActiva       = r.radar_activo === 'Sí';
  const criteriosCount = Array.isArray(r.criterios_cumplidos) ? r.criterios_cumplidos.length : 0;
  const descripcion    = r.descripcion_resumen?.trim() ?? '';
  const monto          = r.monto_inversion && r.monto_inversion !== 'No reportado' ? r.monto_inversion : null;
  const ventana        = r.ventana_compra ?? null;
  const clickable      = !!r.session_id && !!onVerInforme;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => clickable && onVerInforme!(r.session_id!)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && clickable) { e.preventDefault(); onVerInforme!(r.session_id!); } }}
      className={cn(
        'rounded-xl border p-4 transition-all',
        isActiva
          ? 'border-green-500/30 bg-green-500/[0.04] hover:bg-green-500/[0.08]'
          : 'border-border bg-card hover:bg-muted/30',
        clickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm leading-tight">{r.empresa_evaluada}</p>
          {r.pais && <p className="mt-0.5 text-xs text-muted-foreground">{r.pais}</p>}
        </div>
        {isActiva ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
            Activa
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
            Descartada
          </span>
        )}
      </div>

      {isActiva && (
        <div className="mt-3 space-y-2">
          {r.tipo_senal && (
            <p className="text-xs font-medium text-foreground/80">{r.tipo_senal}</p>
          )}
          {descripcion && (
            <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{descripcion}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {criteriosCount > 0 && <ScorePill count={criteriosCount} criterios={r.criterios_cumplidos} />}
            {ventana && ventana !== 'Sin señal' && (
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', ventanaStyle(ventana))}>
                {ventanaLabel[ventana] ?? ventana}
              </span>
            )}
            {monto && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 truncate max-w-[140px]">
                {monto}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ResultadosTable({ results, loading, onLoadMore, hasMore, onVerInforme }: Props) {
  if (loading && !results.length) {
    return (
      <div className="space-y-3">
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: '200px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '176px' }} />
              <col style={{ width: '84px' }} />
              <col style={{ width: '148px' }} />
              <col />
              <col style={{ width: '108px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Empresa', 'Estado', 'Tipo señal', 'Ventana', 'Monto', 'Descripción', 'Acción'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
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

        {/* ── Mobile cards ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 md:hidden">
          {results.map((r, i) => (
            <MobileCard key={r.id ?? i} r={r} onVerInforme={onVerInforme} />
          ))}
        </div>

        {/* ── Desktop table ────────────────────────────────────────────── */}
        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: '200px' }} />   {/* Empresa */}
              <col style={{ width: '108px' }} />   {/* Estado */}
              <col style={{ width: '176px' }} />   {/* Tipo señal + score */}
              <col style={{ width: '84px' }} />    {/* Ventana */}
              <col style={{ width: '148px' }} />   {/* Monto */}
              <col />                              {/* Descripción flexible */}
              <col style={{ width: '108px' }} />   {/* Acción */}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo señal</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ventana</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Monto</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {results.map((r, i) => {
                const isActiva       = r.radar_activo === 'Sí';
                const criteriosCount = Array.isArray(r.criterios_cumplidos) ? r.criterios_cumplidos.length : 0;
                const descripcion    = r.descripcion_resumen?.trim() ?? '';
                const monto          = r.monto_inversion && r.monto_inversion !== 'No reportado' ? r.monto_inversion : null;
                const ventana        = r.ventana_compra ?? null;
                const clickable      = !!r.session_id && !!onVerInforme;

                return (
                  <tr
                    key={r.id ?? i}
                    onClick={() => clickable && onVerInforme!(r.session_id!)}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && clickable) { e.preventDefault(); onVerInforme!(r.session_id!); } }}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    aria-label={clickable ? `Ver informe de ${r.empresa_evaluada}` : undefined}
                    className={cn(
                      'group transition-colors',
                      isActiva
                        ? 'bg-green-500/[0.025] hover:bg-green-500/[0.065]'
                        : 'hover:bg-muted/25',
                      clickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                    )}
                  >
                    {/* Empresa — name + country·line */}
                    <td className="px-0 py-0">
                      <div className="flex h-full items-stretch">
                        {/* Left accent bar */}
                        <div className={cn(
                          'w-[3px] shrink-0 rounded-r-full self-stretch my-1',
                          isActiva ? 'bg-green-500' : 'bg-transparent',
                        )} aria-hidden />
                        <div className="min-w-0 py-3.5 pl-3 pr-4">
                          <p className="block truncate text-[13px] font-semibold text-foreground leading-snug">
                            {r.empresa_evaluada}
                          </p>
                          <p className="block truncate text-[11px] text-muted-foreground mt-0.5">
                            {[r.pais, r.linea_negocio].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      {isActiva ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/12 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:text-green-400">
                          <Zap size={9} className="shrink-0" aria-hidden />
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          Descartada
                        </span>
                      )}
                    </td>

                    {/* Tipo señal + score pill */}
                    <td className="overflow-hidden px-4 py-3.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="block truncate text-[12px] text-foreground/85">
                          {r.tipo_senal ?? '—'}
                        </span>
                        {criteriosCount > 0 && (
                          <span className="shrink-0">
                            <ScorePill
                              count={criteriosCount}
                              criterios={Array.isArray(r.criterios_cumplidos) ? r.criterios_cumplidos : undefined}
                            />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Ventana */}
                    <td className="px-4 py-3.5">
                      {ventana && ventana !== 'Sin señal' ? (
                        <span className={cn(
                          'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                          ventanaStyle(ventana),
                        )}>
                          {ventanaLabel[ventana] ?? ventana}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Monto — truncated + tooltip */}
                    <td className="overflow-hidden px-4 py-3.5">
                      {monto ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="block truncate text-[12px] font-semibold text-amber-600 dark:text-amber-400 cursor-default">
                              {monto}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{monto}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Descripción — 1 line + tooltip */}
                    <td className="overflow-hidden px-4 py-3.5">
                      {descripcion ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <p className="block truncate text-[12px] text-muted-foreground cursor-default">
                              {descripcion}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{descripcion}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {r.fuente_link && r.fuente_link !== 'No disponible' && (
                          <Tooltip>
                            <TooltipTrigger>
                              <a
                                href={r.fuente_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                aria-label={`Fuente: ${r.fuente_nombre ?? 'Ver fuente'}`}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{r.fuente_nombre ?? 'Ver fuente'}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {r.fuente_verificada && (
                          <span className="shrink-0">
                            <FuenteBadge status={r.fuente_verificada} notas={r.verificacion_notas} />
                          </span>
                        )}
                        {clickable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => { e.stopPropagation(); onVerInforme!(r.session_id!); }}
                            className="h-7 shrink-0 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                            aria-label={`Ver informe de ${r.empresa_evaluada}`}
                          >
                            <Eye size={11} className="mr-1" />
                            Informe
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className="min-h-[44px] gap-2 px-6"
            >
              {loading ? 'Cargando...' : (
                <>
                  <ChevronDown size={14} />
                  Cargar más señales
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
