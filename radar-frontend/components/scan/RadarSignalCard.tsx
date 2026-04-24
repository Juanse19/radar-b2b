// components/scan/RadarSignalCard.tsx
//
// Sprint MAOA F3.1 — Shows MAOA signal summary after a successful radar scan.
// Displayed inline in /scan after execution completes for the 'radar' agent.
//
// Props:
//   empresaId   — Supabase empresa.id used to fetch the latest radar_scan result
//   empresaNombre — for display when no DB result is available yet
//   visible     — controlled by parent (isDone && status === 'success')

'use client';

import { useQuery }      from '@tanstack/react-query';
import { fetchJson }     from '@/lib/fetcher';
import { ExternalLink, Radar, CheckCircle, AlertCircle, Clock, Target } from 'lucide-react';
import { cn }            from '@/lib/utils';
import Link              from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────
interface SignalSummary {
  id:                number;
  empresa:           string;
  tipoSenal:         string;
  ventanaCompra:     string;
  convergenciaMaoa?: string | null;
  accionRecomendada?: string | null;
  scoreFinalMaoa?:   number | null;
  tierClasificacion?: string | null;
  tirClasificacion?:  string | null;
  criteriosCumplidos?: string[] | null;
  totalCriterios?:   number | null;
  montoInversion?:   string | null;
  radarActivo:       string;
}

interface RadarSignalCardProps {
  empresaId?:    number | null;
  empresaNombre: string;
  visible:       boolean;
}

// ── Badge helpers ──────────────────────────────────────────────────────────
function AccionBadge({ accion }: { accion: string }) {
  const cfg = accion.includes('ABM')
    ? { bg: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300', label: '⚡ ABM ACTIVADO' }
    : accion.includes('MONITOREO')
    ? { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: '👁 MONITOREO ACTIVO' }
    : { bg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', label: '📦 ARCHIVAR' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function ConvergenciaBadge({ value }: { value: string }) {
  const cfg = value === 'Verificada'
    ? { icon: CheckCircle, color: 'text-emerald-600', label: 'Verificada' }
    : value === 'Pendiente'
    ? { icon: Clock,        color: 'text-amber-500',  label: 'Pendiente' }
    : { icon: AlertCircle,  color: 'text-gray-400',   label: 'Sin convergencia' };
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cfg.color)}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

function VentanaBadge({ ventana }: { ventana: string }) {
  const hot = ['0-6 Meses', '6-12 Meses'].includes(ventana);
  return (
    <span className={cn(
      'inline-flex rounded px-2 py-0.5 text-[11px] font-medium',
      hot
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-surface-muted text-muted-foreground',
    )}>
      {ventana || 'Sin señal'}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function RadarSignalCard({ empresaId, empresaNombre, visible }: RadarSignalCardProps) {
  // Fetch latest signal for this empresa (enabled only when visible)
  const { data: signals, isLoading } = useQuery<SignalSummary[]>({
    queryKey: ['radarSignalCard', empresaId],
    queryFn:  () => {
      const params = new URLSearchParams({ limit: '1', sort: 'created_at', order: 'desc' });
      if (empresaId) params.set('empresa_id', String(empresaId));
      return fetchJson<SignalSummary[]>(`/api/signals?${params}`);
    },
    enabled:      visible && !!empresaId,
    staleTime:    10_000,
    refetchOnWindowFocus: false,
  });

  if (!visible) return null;

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-4 dark:border-violet-800 dark:bg-violet-950/10">
        <div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
          <Radar size={15} className="animate-pulse shrink-0" />
          <span>Cargando resultado del radar…</span>
        </div>
      </div>
    );
  }

  const signal = signals?.[0];

  // ── No signal found (descarte or not yet persisted) ───────────────────
  if (!signal || signal.radarActivo !== 'Sí') {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-4 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radar size={15} className="shrink-0 text-gray-400" />
            <span>
              <strong className="text-foreground">{empresaNombre}</strong>
              {' '}— sin señal MAOA detectada
            </span>
          </div>
          <Link
            href="/results"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver resultados <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    );
  }

  // ── Signal found — show MAOA fields ──────────────────────────────────
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-3 dark:border-violet-800/60 dark:bg-violet-950/15">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar size={15} className="shrink-0 text-violet-600" />
          <span className="text-sm font-semibold text-violet-900 dark:text-violet-200 truncate">
            {signal.empresa}
          </span>
          {signal.tipoSenal && signal.tipoSenal !== 'Sin Señal' && (
            <span className="hidden sm:inline text-xs font-medium text-violet-700 dark:text-violet-300 truncate">
              · {signal.tipoSenal}
            </span>
          )}
        </div>
        <Link
          href={`/results${empresaId ? `?empresa_id=${empresaId}` : ''}`}
          className="flex shrink-0 items-center gap-1 text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200 transition-colors"
        >
          Ver detalles <ExternalLink size={11} />
        </Link>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {signal.accionRecomendada && (
          <AccionBadge accion={signal.accionRecomendada} />
        )}
        {signal.convergenciaMaoa && (
          <ConvergenciaBadge value={signal.convergenciaMaoa} />
        )}
        <VentanaBadge ventana={signal.ventanaCompra} />
      </div>

      {/* Score + TIER/TIR row */}
      {(signal.scoreFinalMaoa !== null && signal.scoreFinalMaoa !== undefined) && (
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Target size={11} className="text-violet-500" />
            Score MAOA:
            <span className="text-violet-700 dark:text-violet-300 font-bold">
              {signal.scoreFinalMaoa.toFixed(1)}
            </span>
          </span>
          {signal.tierClasificacion && (
            <span className="text-muted-foreground">
              TIER <strong className="text-foreground">{signal.tierClasificacion}</strong>
            </span>
          )}
          {signal.tirClasificacion && (
            <span className="text-muted-foreground">
              TIR <strong className="text-foreground">{signal.tirClasificacion}</strong>
            </span>
          )}
          {signal.montoInversion && signal.montoInversion !== 'No reportado' && (
            <span className="ml-auto text-muted-foreground truncate max-w-[160px]" title={signal.montoInversion}>
              {signal.montoInversion}
            </span>
          )}
        </div>
      )}

      {/* Criterios */}
      {signal.criteriosCumplidos && signal.criteriosCumplidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signal.criteriosCumplidos.slice(0, 4).map((c, i) => (
            <span key={i} className="rounded bg-white/80 dark:bg-white/10 border border-violet-100 dark:border-violet-800/50 px-2 py-0.5 text-[10px] text-violet-800 dark:text-violet-300">
              {c}
            </span>
          ))}
          {(signal.totalCriterios ?? 0) > 4 && (
            <span className="rounded bg-white/80 dark:bg-white/10 border border-violet-100 dark:border-violet-800/50 px-2 py-0.5 text-[10px] text-violet-500">
              +{(signal.totalCriterios ?? 0) - 4} más
            </span>
          )}
        </div>
      )}
    </div>
  );
}
