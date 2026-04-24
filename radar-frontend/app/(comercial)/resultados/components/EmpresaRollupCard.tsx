import { cn } from '@/lib/utils';
import { Zap, Users, ExternalLink } from 'lucide-react';
import { TierBadge } from './TierBadge';
import type { EmpresaRollup } from '@/lib/comercial/types';

// ─── Color maps ──────────────────────────────────────────────────────────────

const LINEA_COLORS: Record<string, string> = {
  BHS:              'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  Intralogística:   'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Cartón':         'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'Final de Línea': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Motos:            'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  SOLUMAT:          'bg-teal-500/10 text-teal-700 dark:text-teal-400',
};

function lineaClasses(linea: string | null): string {
  if (!linea) return 'bg-muted/50 text-muted-foreground';
  return LINEA_COLORS[linea] ?? 'bg-muted/50 text-muted-foreground';
}

function senalClasses(tipo: string | null): string {
  if (!tipo) return 'bg-muted/50 text-muted-foreground border border-border';
  if (tipo.startsWith('CAPEX'))       return 'bg-green-500/12 text-green-700 dark:text-green-400 border border-green-500/20';
  if (tipo.startsWith('Expansión') || tipo.startsWith('Expansion'))
                                       return 'bg-blue-500/12 text-blue-700 dark:text-blue-400 border border-blue-500/20';
  if (tipo.startsWith('Licitación') || tipo.startsWith('Licitacion'))
                                       return 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/20';
  if (tipo.startsWith('Señal Temprana') || tipo.startsWith('Senal Temprana'))
                                       return 'bg-purple-500/12 text-purple-700 dark:text-purple-400 border border-purple-500/20';
  return 'bg-muted/50 text-muted-foreground border border-border';
}

interface VentanaDisplay { label: string; classes: string }

function ventanaDisplay(ventana: string | null): VentanaDisplay | null {
  if (!ventana) return null;
  if (ventana.startsWith('0'))  return { label: '0–6m',   classes: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-400/30' };
  if (ventana.startsWith('6'))  return { label: '6–12m',  classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-400/30' };
  if (ventana.startsWith('12')) return { label: '12–18m', classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-400/30' };
  if (ventana.startsWith('18')) return { label: '18–24m', classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-400/30' };
  if (ventana.startsWith('>'))  return { label: '>24m',   classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-400/30' };
  return { label: ventana, classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-400/30' };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  empresa:  EmpresaRollup;
  onSelect: (e: EmpresaRollup) => void;
}

export function EmpresaRollupCard({ empresa, onSelect }: Props) {
  const hasRadar   = empresa.radar_activo === 'Sí';
  const hasScore   = empresa.calif_score !== null && empresa.calif_score !== undefined;
  const score      = empresa.calif_score ?? 0;
  const scoreHigh  = score >= 8;
  const ventana    = ventanaDisplay(empresa.ventana_compra);
  const isVerified = empresa.fuente_verificada === 'Sí';

  return (
    <button
      type="button"
      onClick={() => onSelect(empresa)}
      className={cn(
        'group w-full rounded-xl border text-left transition-all duration-150',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        hasRadar
          ? 'border-l-[3px] border-l-green-500 border-t-green-500/20 border-r-green-500/20 border-b-green-500/20 bg-green-500/[0.025] hover:bg-green-500/[0.045]'
          : 'border-border bg-card hover:bg-accent/40',
      )}
      aria-label={`Ver detalle de ${empresa.empresa_evaluada}`}
    >
      <div className="flex flex-col gap-2.5 p-4">

        {/* ── TOP ROW ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-snug tracking-tight">
              {empresa.empresa_evaluada}
            </p>
            {empresa.pais && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {empresa.pais}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasScore && (
              <span
                className={cn(
                  'text-[15px] font-bold tabular-nums leading-none',
                  scoreHigh ? 'text-amber-600 dark:text-amber-400' : 'text-foreground/70',
                )}
              >
                {score.toFixed(1)}
                <span className="text-[11px] font-normal text-muted-foreground">/10</span>
              </span>
            )}
            <TierBadge tier={empresa.tier_actual} size="sm" />
          </div>
        </div>

        {/* ── BADGES ROW ── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {empresa.linea_negocio && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                lineaClasses(empresa.linea_negocio),
              )}
            >
              {empresa.linea_negocio}
            </span>
          )}

          {empresa.tipo_senal && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                senalClasses(empresa.tipo_senal),
              )}
            >
              {empresa.tipo_senal}
            </span>
          )}

          {hasRadar && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400 border border-green-500/20">
              <Zap size={9} aria-hidden />
              Señal activa
            </span>
          )}

          {isVerified && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20">
              Verificada
            </span>
          )}

          {ventana && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                ventana.classes,
              )}
            >
              {ventana.label}
            </span>
          )}
        </div>

        {/* ── MONTO ── */}
        {empresa.monto_inversion && (
          <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
            {empresa.monto_inversion}
          </p>
        )}

        {/* ── DESCRIPTION ── */}
        {empresa.descripcion_resumen && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {empresa.descripcion_resumen}
          </p>
        )}

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users size={11} aria-hidden />
            {empresa.contactos_total} contacto{empresa.contactos_total !== 1 ? 's' : ''}
          </span>

          {empresa.fuente_link && empresa.fuente_nombre && (
            <a
              href={empresa.fuente_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
              aria-label={`Abrir fuente: ${empresa.fuente_nombre}`}
            >
              <ExternalLink size={10} aria-hidden />
              <span className="max-w-[120px] truncate">{empresa.fuente_nombre}</span>
            </a>
          )}
        </div>

      </div>
    </button>
  );
}
