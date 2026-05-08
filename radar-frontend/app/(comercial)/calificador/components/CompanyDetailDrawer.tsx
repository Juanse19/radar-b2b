'use client';

/**
 * CompanyDetailDrawer — sheet lateral con detalle de una empresa calificada.
 *
 * V3 (post-feedback): vista VERTICAL única igual al diseño aprobado en
 * commit anterior — Score Global + Evaluación por dimensión + Signals Link
 * (señales / contactos) + Footer con CTAs. El historial vuelve a una
 * sección colapsable al final.
 *
 * Reemplaza navegación a /calificador/cuentas/[id] (que daba 404):
 * datos en memoria desde el dashboard, abre <100ms.
 */
import { useEffect, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star, TrendingUp, Archive, MinusCircle, Radar, Users,
  Clock, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import type { Tier, Dimension } from '@/lib/comercial/calificador/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawerCalificacion {
  id:                       number;
  empresa_id:               number | null;
  empresa_nombre:           string | null;
  pais:                     string | null;
  linea_negocio:            string | null;
  tier_calculado:           string;
  score_total:              number | string | null;
  score_impacto:            number | null;
  score_multiplanta:        number | null;
  score_recurrencia:        number | null;
  score_referente:          number | null;
  score_acceso_al_decisor:  number | null;
  score_anio:               number | null;
  score_prioridad:          number | null;
  score_cuenta_estrategica: number | null;
  provider:                 string | null;
  created_at:               string;
  senales_count:            number | null;
  contactos_count:          number | null;
}

interface HistoryRow {
  id:               number;
  tier_calculado:   string;
  score_total:      number | string | null;
  created_at:       string;
}

// ─── Tier visual (legacy B-Alta/B-Baja → B) ───────────────────────────────────

function toTierKey(raw: string): Tier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  if (raw === 'B-Alta' || raw === 'B-Baja') return 'B';
  return 'C';
}

const TIER_ICON: Record<Tier, typeof Star> = {
  A: Star, B: TrendingUp, C: Archive, D: MinusCircle,
};

const TIER_BADGE_CLS: Record<Tier, string> = {
  A: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  B: 'bg-blue-500/15  text-blue-700  border-blue-500/30',
  C: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  D: 'bg-muted        text-muted-foreground',
};

const TIER_TEXT_CLS: Record<Tier, string> = {
  A: 'text-amber-500',
  B: 'text-blue-500',
  C: 'text-slate-500',
  D: 'text-muted-foreground',
};

const TIER_RING_COLOR: Record<Tier, string> = {
  A: '#b9842a',
  B: '#1f5d8d',
  C: '#5c6f81',
  D: '#8b9099',
};

const TIER_SUBTITLE: Record<Tier, string> = {
  A: 'Cuenta de alta prioridad',
  B: 'Seguimiento activo',
  C: 'Potencial a largo plazo',
  D: 'Sin potencial actual',
};

// ─── Dimension labels ─────────────────────────────────────────────────────────

const DIM_LABELS: Record<Dimension, string> = {
  impacto_presupuesto: 'Impacto presupuesto',
  multiplanta:         'Multiplanta',
  recurrencia:         'Recurrencia',
  referente_mercado:   'Referente mercado',
  acceso_al_decisor:   'Acceso al decisor',
  anio_objetivo:       'Año objetivo',
  prioridad_comercial: 'Prioridad comercial',
  cuenta_estrategica:  'Cuenta estratégica',
};

const DIM_ORDER: Dimension[] = [
  'impacto_presupuesto',
  'multiplanta',
  'recurrencia',
  'referente_mercado',
  'acceso_al_decisor',
  'anio_objetivo',
  'prioridad_comercial',
  'cuenta_estrategica',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  if (days < 30) return `hace ${days} días`;
  if (days < 60) return 'hace 1 mes';
  return `hace ${Math.floor(days / 30)} meses`;
}

function dimBarColor(score: number): string {
  if (score >= 8) return '#b9842a';
  if (score >= 5) return '#1f5d8d';
  if (score >= 3) return '#5c6f81';
  return '#8b9099';
}

// ─── Score gauge (circle with number) ─────────────────────────────────────────

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius        = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped       = Math.max(0, Math.min(10, score));
  const offset        = circumference - (clamped / 10) * circumference;

  return (
    <div className="relative h-20 w-20">
      <svg width={80} height={80} className="-rotate-90">
        <circle cx={40} cy={40} r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={6} />
        <circle
          cx={40} cy={40} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold tabular-nums leading-none" style={{ color }}>
          {score.toFixed(0)}
        </span>
        <span className="text-[9px] text-muted-foreground tracking-wide">/ 10</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  calificacion: DrawerCalificacion | null;
  onClose:      () => void;
}

export function CompanyDetailDrawer({ calificacion, onClose }: Props) {
  const open = !!calificacion;

  // Historial expandible — lazy-load la primera vez que se abre
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory]         = useState<HistoryRow[] | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);

  // Reset cuando cambia la empresa
  useEffect(() => {
    if (calificacion) {
      setHistoryOpen(false);
      setHistory(null);
    }
  }, [calificacion?.id]);

  // Lazy fetch del historial cuando se abre
  useEffect(() => {
    if (!historyOpen || !calificacion?.empresa_id || history !== null || loadingHist) return;
    setLoadingHist(true);
    fetch(`/api/calificador/empresa/${calificacion.empresa_id}/historial`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setHistory(d.items ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHist(false));
  }, [historyOpen, calificacion?.empresa_id, history, loadingHist]);

  if (!calificacion) return null;

  const tier      = toTierKey(calificacion.tier_calculado);
  const TierIcon  = TIER_ICON[tier];
  const score     = typeof calificacion.score_total === 'string'
    ? Number(calificacion.score_total)
    : (calificacion.score_total ?? 0);
  const scoreOver10  = score; // backend ya entrega 0-10

  const scores: Partial<Record<Dimension, number>> = {
    impacto_presupuesto: calificacion.score_impacto ?? undefined,
    multiplanta:         calificacion.score_multiplanta ?? undefined,
    recurrencia:         calificacion.score_recurrencia ?? undefined,
    referente_mercado:   calificacion.score_referente ?? undefined,
    acceso_al_decisor:   calificacion.score_acceso_al_decisor ?? undefined,
    anio_objetivo:       calificacion.score_anio ?? undefined,
    prioridad_comercial: calificacion.score_prioridad ?? undefined,
    cuenta_estrategica:  calificacion.score_cuenta_estrategica ?? undefined,
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        {/* ── Header empresa ── */}
        <SheetHeader className="space-y-2 pb-4 border-b border-border/60">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Empresa
          </p>
          <SheetTitle className="text-2xl font-bold leading-tight">
            {calificacion.empresa_nombre ?? 'Empresa sin nombre'}
          </SheetTitle>
          <p className="font-mono text-xs text-muted-foreground">
            {calificacion.empresa_id ? `ID #${calificacion.empresa_id}` : '—'}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {calificacion.pais && (
              <Badge variant="outline" className="h-5 text-[10px]">{calificacion.pais}</Badge>
            )}
            {calificacion.linea_negocio && (
              <Badge variant="outline" className="h-5 text-[10px]">{calificacion.linea_negocio}</Badge>
            )}
            <Badge variant="outline" className={cn('h-5 gap-1 border text-[10px]', TIER_BADGE_CLS[tier])}>
              <TierIcon size={10} className={TIER_TEXT_CLS[tier]} />
              {TIER_LABEL[tier]}
            </Badge>
          </div>
        </SheetHeader>

        {/* ── Score Global ── */}
        <Card className="mt-4 p-4">
          <div className="flex items-center gap-4">
            <ScoreGauge score={scoreOver10} color={TIER_RING_COLOR[tier]} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Score Global
              </p>
              <p className="mt-0.5 text-base font-semibold">{TIER_SUBTITLE[tier]}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Calificada {relativeDate(calificacion.created_at)}
                {calificacion.provider && <> · provider <span className="font-mono">{calificacion.provider}</span></>}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Evaluación por dimensión ── */}
        <div className="mt-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Evaluación por dimensión
          </p>
          <div className="space-y-2.5">
            {DIM_ORDER.map((dim) => {
              const value  = scores[dim];
              const known  = value !== undefined && value !== null;
              const pct    = known ? Math.min(100, Math.max(0, (value / 10) * 100)) : 0;
              const color  = known ? dimBarColor(value) : 'transparent';
              return (
                <div key={dim} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{DIM_LABELS[dim]}</span>
                    <span className={cn('font-mono font-semibold tabular-nums', !known && 'text-muted-foreground/40')}>
                      {known ? `${value.toFixed(0)}/10` : '—'}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Signals Link ── */}
        <div className="mt-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Signals Link
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Radar size={14} className="text-primary" />
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {calificacion.senales_count ?? 0}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">señales detectadas</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-primary" />
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {calificacion.contactos_count ?? 0}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">contactos extraídos</p>
            </Card>
          </div>
        </div>

        {/* ── Historial (collapsible) ── */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-widest">
              <Clock size={11} /> Historial de calificaciones
            </span>
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-1.5">
              {loadingHist && (
                <p className="py-3 text-center text-xs text-muted-foreground">Cargando historial…</p>
              )}
              {!loadingHist && history !== null && history.length === 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Esta es la primera calificación de la empresa.
                </p>
              )}
              {history?.map((h) => {
                const t = toTierKey(h.tier_calculado);
                const s = typeof h.score_total === 'string' ? Number(h.score_total) : (h.score_total ?? 0);
                return (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium">{TIER_LABEL[t]}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(h.created_at)}</p>
                    </div>
                    <span className={cn('font-mono font-semibold tabular-nums', TIER_TEXT_CLS[t])}>
                      {s.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer CTAs ── */}
        <div className="mt-6 flex gap-2 border-t border-border/60 pt-4">
          <Button variant="outline" size="sm" className="flex-1 gap-1">
            <RefreshCw size={13} /> Re-escanear
          </Button>
          <Button size="sm" className="flex-1 gap-1">
            <Users size={13} /> Buscar contactos
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
