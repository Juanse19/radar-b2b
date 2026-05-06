'use client';

import { ExternalLink, FileText, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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

const RECENCY_DAYS = 180;

function parseDDMMYYYY(s?: string | null): Date | null {
  if (!s || s === 'No disponible') return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOutOfRecency(fecha: string | null | undefined): boolean {
  const d = parseDDMMYYYY(fecha);
  if (!d) return false;
  const cutoff = new Date(Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000);
  return d < cutoff;
}

function temporalBadgeClass(evalLabel: string | null | undefined): { cls: string; label: string } | null {
  if (!evalLabel) return null;
  if (evalLabel.includes('🔴') || /descarte/i.test(evalLabel)) {
    return { cls: 'bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/30', label: '🔴' };
  }
  if (evalLabel.includes('🟡') || /ambiguo/i.test(evalLabel)) {
    return { cls: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30', label: '🟡' };
  }
  if (evalLabel.includes('🟢') || /válido|valido/i.test(evalLabel)) {
    return { cls: 'bg-green-500/12 text-green-700 dark:text-green-400 border-green-500/30', label: '🟢' };
  }
  return null;
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
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-12 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-full max-w-[180px] rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-3 w-16 rounded" /></td>
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
              <col style={{ width: '180px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '150px' }} />
              <col />
              <col style={{ width: '130px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Empresa', 'Radar', 'Tipo señal', 'Descripción', 'Fuente', 'Informativo', 'Fecha'].map(h => (
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
              <col style={{ width: '20%', minWidth: '180px' }} />  {/* Empresa */}
              <col style={{ width: '72px' }} />                     {/* Radar activo */}
              <col style={{ width: '15%', minWidth: '140px' }} />  {/* Tipo señal */}
              <col />                                               {/* Descripción flexible */}
              <col style={{ width: '13%', minWidth: '120px' }} />  {/* Fuente de señal */}
              <col style={{ width: '13%', minWidth: '120px' }} />  {/* Fuente informativo */}
              <col style={{ width: '84px' }} />                     {/* Fecha */}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/60 backdrop-blur-sm">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Radar</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo señal</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fuente</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Info. Fuente</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {results.map((r, i) => {
                const isActiva  = r.radar_activo === 'Sí';
                const clickable = !!r.session_id && !!onVerInforme;
                const fecha = (() => {
                  const fs = r.fecha_senal;
                  if (!fs || fs === 'No disponible') return null;
                  // Parse DD/MM/AAAA — JS Date() can't handle this format natively
                  const [dd, mm, yy] = fs.split('/');
                  const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
                  if (isNaN(d.getTime())) return fs;
                  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
                })();

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

                    {/* Radar activo + evaluación temporal */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const tb = temporalBadgeClass(r.evaluacion_temporal);
                          return tb ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] leading-none cursor-default', tb.cls)} aria-label={r.evaluacion_temporal}>
                                  {tb.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{r.evaluacion_temporal}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : null;
                        })()}
                        {isActiva ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:text-green-400">
                            <Zap size={9} aria-hidden />Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            No
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tipo de señal de inversión */}
                    <td className="overflow-hidden px-4 py-3.5">
                      <span className="block truncate text-[12px] text-foreground/85">
                        {r.tipo_senal ?? '—'}
                      </span>
                    </td>

                    {/* Descripción resumen + motivo (si aplica) */}
                    <td className="overflow-hidden px-4 py-3.5">
                      {r.descripcion_resumen ? (
                        <Tooltip>
                          <TooltipTrigger className="w-full text-left">
                            <p className="line-clamp-2 text-[12px] text-muted-foreground cursor-default leading-relaxed">
                              {r.descripcion_resumen}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{r.descripcion_resumen}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                      {/* motivo_descarte siempre disponible — visible bajo descripción si es ambiguo, o como tooltip-on-hover si está completo */}
                      {r.motivo_descarte && (
                        <Tooltip>
                          <TooltipTrigger className="w-full text-left">
                            <p className={cn(
                              'mt-1 text-[11px] italic line-clamp-2 cursor-default',
                              isActiva ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/80',
                            )}>
                              ⚠ {r.motivo_descarte}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{r.motivo_descarte}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>

                    {/* Fuente de la señal — external link */}
                    <td className="overflow-hidden px-4 py-3.5">
                      {r.fuente_link && r.fuente_link !== 'No disponible' ? (
                        <a
                          href={r.fuente_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline max-w-full min-w-0"
                          aria-label={`Abrir fuente: ${r.fuente_nombre ?? r.fuente_link}`}
                        >
                          <ExternalLink size={10} className="shrink-0" />
                          <span className="block truncate">{r.fuente_nombre ?? 'Ver fuente'}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Fuente señal informativo */}
                    <td className="overflow-hidden px-4 py-3.5">
                      {r.fuente_nombre ? (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="block truncate text-[12px] text-foreground/70">{r.fuente_nombre}</span>
                          {r.fuente_verificada && (
                            <span className="inline-flex w-fit items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                              Verificada
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Fecha de la señal — resaltada si fuera de ventana */}
                    <td className="px-4 py-3.5">
                      {(() => {
                        const stale = isOutOfRecency(r.fecha_senal);
                        if (!fecha) return <span className="text-[12px] tabular-nums text-muted-foreground">—</span>;
                        if (stale) {
                          return (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="inline-flex items-center rounded-md bg-red-500/10 px-1.5 py-0.5 text-[12px] tabular-nums text-red-700 dark:text-red-400 cursor-default">
                                  {fecha}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">Fuente fuera de ventana de recencia (180 días)</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return <span className="text-[12px] tabular-nums text-muted-foreground">{fecha}</span>;
                      })()}
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
