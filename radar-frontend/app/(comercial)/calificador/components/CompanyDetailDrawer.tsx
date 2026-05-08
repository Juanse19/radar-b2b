'use client';

/**
 * CompanyDetailDrawer — sheet lateral con detalle de una empresa calificada.
 *
 * Reemplaza la navegación a /calificador/cuentas/[id]: en vez de hacer SSR
 * de una página completa, abre un drawer con los datos ya en memoria
 * (provenientes del endpoint /api/calificador/dashboard).
 *
 * 5 sub-tabs (siguiendo el HANDOFF §7):
 *   - Resumen     · score + razonamiento + perfil web
 *   - Calificador · 8 dimensiones con valores categóricos
 *   - Radar       · señales detectadas (count + listado básico)
 *   - Contactos   · contactos Apollo (count + listado básico)
 *   - Historial   · timeline de calificaciones previas de la empresa
 *
 * Lazy-loads detalle adicional (señales, contactos, historial) la primera
 * vez que el usuario abre cada sub-tab — evita queries innecesarias.
 */
import { useEffect, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, TrendingUp, Archive, MinusCircle, ExternalLink, Radar, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import { DimensionStrip } from './DimensionStrip';
import type { Tier } from '@/lib/comercial/calificador/types';

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

interface SignalRow      { id: number; tipo_senal: string | null; descripcion: string | null; created_at?: string }
interface ContactRow     { id: number; full_name: string | null; title: string | null; email: string | null }
interface HistoryRow     { id: number; tier_calculado: string; score_total: number | string | null; created_at: string }

// ─── Tier visual (label = "Tier A"; legacy B-Alta/B-Baja → B) ─────────────────

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  calificacion: DrawerCalificacion | null;
  onClose:      () => void;
}

export function CompanyDetailDrawer({ calificacion, onClose }: Props) {
  const open = !!calificacion;

  // Lazy state per tab — solo cargamos cuando el usuario abre el tab
  const [tab, setTab]               = useState<'resumen' | 'calificador' | 'radar' | 'contactos' | 'historial'>('resumen');
  const [details, setDetails]       = useState<{
    senales:    SignalRow[]      | null;
    contactos:  ContactRow[]     | null;
    historial:  HistoryRow[]     | null;
    loading:    Record<string, boolean>;
  }>({ senales: null, contactos: null, historial: null, loading: {} });

  // Reset tab cuando cambia la empresa
  useEffect(() => {
    if (calificacion) {
      setTab('resumen');
      setDetails({ senales: null, contactos: null, historial: null, loading: {} });
    }
  }, [calificacion?.id]);

  // Lazy fetch helper
  useEffect(() => {
    if (!calificacion) return;
    const empresaId = calificacion.empresa_id;
    if (!empresaId) return;

    if (tab === 'radar' && details.senales === null && !details.loading.senales) {
      setDetails((p) => ({ ...p, loading: { ...p.loading, senales: true } }));
      fetch(`/api/calificador/empresa/${empresaId}/senales`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setDetails((p) => ({ ...p, senales: d.items ?? [], loading: { ...p.loading, senales: false } })))
        .catch(() => setDetails((p) => ({ ...p, senales: [], loading: { ...p.loading, senales: false } })));
    }
    if (tab === 'contactos' && details.contactos === null && !details.loading.contactos) {
      setDetails((p) => ({ ...p, loading: { ...p.loading, contactos: true } }));
      fetch(`/api/calificador/empresa/${empresaId}/contactos`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setDetails((p) => ({ ...p, contactos: d.items ?? [], loading: { ...p.loading, contactos: false } })))
        .catch(() => setDetails((p) => ({ ...p, contactos: [], loading: { ...p.loading, contactos: false } })));
    }
    if (tab === 'historial' && details.historial === null && !details.loading.historial) {
      setDetails((p) => ({ ...p, loading: { ...p.loading, historial: true } }));
      fetch(`/api/calificador/empresa/${empresaId}/historial`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setDetails((p) => ({ ...p, historial: d.items ?? [], loading: { ...p.loading, historial: false } })))
        .catch(() => setDetails((p) => ({ ...p, historial: [], loading: { ...p.loading, historial: false } })));
    }
  }, [tab, calificacion, details.senales, details.contactos, details.historial, details.loading.senales, details.loading.contactos, details.loading.historial]);

  if (!calificacion) return null;

  const tier      = toTierKey(calificacion.tier_calculado);
  const TierIcon  = TIER_ICON[tier];
  const score     = typeof calificacion.score_total === 'string'
    ? Number(calificacion.score_total)
    : (calificacion.score_total ?? 0);

  const scores = {
    impacto_presupuesto: calificacion.score_impacto ?? 0,
    multiplanta:         calificacion.score_multiplanta ?? 0,
    recurrencia:         calificacion.score_recurrencia ?? 0,
    referente_mercado:   calificacion.score_referente ?? 0,
    acceso_al_decisor:   calificacion.score_acceso_al_decisor ?? 0,
    anio_objetivo:       calificacion.score_anio ?? 0,
    prioridad_comercial: calificacion.score_prioridad ?? 0,
    cuenta_estrategica:  calificacion.score_cuenta_estrategica ?? 0,
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl">
                {calificacion.empresa_nombre ?? 'Empresa sin nombre'}
              </SheetTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[calificacion.pais, calificacion.linea_negocio].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('font-mono text-2xl font-bold tabular-nums', TIER_TEXT_CLS[tier])}>
                {score.toFixed(1)}
              </span>
              <Badge variant="outline" className={cn('h-6 gap-1 border', TIER_BADGE_CLS[tier])}>
                <TierIcon size={11} className={TIER_TEXT_CLS[tier]} />
                {TIER_LABEL[tier]}
              </Badge>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calificada el {formatDate(calificacion.created_at)}
            {calificacion.provider && <> · provider <span className="font-mono">{calificacion.provider}</span></>}
          </p>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="calificador">Calificador</TabsTrigger>
            <TabsTrigger value="radar" className="gap-1">
              <Radar size={12} /> Radar
              {(calificacion.senales_count ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {calificacion.senales_count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contactos" className="gap-1">
              <Users size={12} /> Contactos
              {(calificacion.contactos_count ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {calificacion.contactos_count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historial">
              <Clock size={12} className="mr-1" /> Historial
            </TabsTrigger>
          </TabsList>

          {/* Resumen */}
          <TabsContent value="resumen" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Score total
              </p>
              <p className={cn('mt-1 font-mono text-3xl font-bold tabular-nums', TIER_TEXT_CLS[tier])}>
                {score.toFixed(1)} / 10
              </p>
            </div>
            <a
              href={`/calificador/cuentas/${calificacion.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Ver ficha completa <ExternalLink size={12} />
            </a>
          </TabsContent>

          {/* Calificador — 8 dimensiones */}
          <TabsContent value="calificador" className="mt-4">
            <DimensionStrip scores={scores} animate={false} />
          </TabsContent>

          {/* Radar — señales */}
          <TabsContent value="radar" className="mt-4 space-y-3">
            {details.loading.senales && <p className="text-sm text-muted-foreground">Cargando señales…</p>}
            {!details.loading.senales && details.senales !== null && details.senales.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Sin señales detectadas para esta empresa.
              </p>
            )}
            {details.senales?.map((s) => (
              <div key={s.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{s.tipo_senal ?? 'Señal'}</p>
                {s.descripcion && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.descripcion}</p>}
              </div>
            ))}
          </TabsContent>

          {/* Contactos */}
          <TabsContent value="contactos" className="mt-4 space-y-3">
            {details.loading.contactos && <p className="text-sm text-muted-foreground">Cargando contactos…</p>}
            {!details.loading.contactos && details.contactos !== null && details.contactos.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Sin contactos guardados para esta empresa.
              </p>
            )}
            {details.contactos?.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{c.full_name ?? 'Contacto'}</p>
                <p className="text-xs text-muted-foreground">
                  {[c.title, c.email].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </TabsContent>

          {/* Historial */}
          <TabsContent value="historial" className="mt-4 space-y-2">
            {details.loading.historial && <p className="text-sm text-muted-foreground">Cargando historial…</p>}
            {!details.loading.historial && details.historial !== null && details.historial.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Esta es la primera calificación de esta empresa.
              </p>
            )}
            {details.historial?.map((h) => {
              const t = toTierKey(h.tier_calculado);
              const s = typeof h.score_total === 'string' ? Number(h.score_total) : (h.score_total ?? 0);
              return (
                <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{TIER_LABEL[t]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.created_at)}</p>
                  </div>
                  <span className={cn('font-mono font-semibold', TIER_TEXT_CLS[t])}>
                    {s.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
