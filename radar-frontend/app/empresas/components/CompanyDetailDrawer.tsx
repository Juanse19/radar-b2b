'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink, MapPin, BarChart2, Users,
  Zap, Clock, ArrowUpRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LineaBadge } from '@/components/LineaBadge';
import { TierBadge } from '@/components/TierBadge';
import { ScoreBadge } from '@/components/ScoreBadge';
import { EmptyState } from '@/components/EmptyState';
import { HubSpotStatusBadge } from '@/components/contactos/HubSpotStatusBadge';
import type { Contacto } from '@/lib/types';

interface EmpresaRow {
  id: string;
  nombre: string;
  pais: string;
  linea: string;
  tier: string;
  dominio?: string;
}

interface Signal {
  id: number;
  tipoSenal: string;
  scoreRadar: number;
  ventanaCompra: string;
  descripcion: string;
  fuente: string;
  fuenteUrl: string;
  fechaEscaneo: string;
}

interface Calificacion {
  id: number;
  score_total: number;
  tier_calculado: string;
  created_at: string;
  impacto_presupuesto: string | null;
  anio_objetivo: string | null;
  recurrencia: string | null;
  multiplanta: string | null;
  ticket_estimado: string | null;
  referente_mercado: string | null;
  prioridad_comercial: string | null;
}

interface Props {
  empresa: EmpresaRow | null;
  open: boolean;
  onClose: () => void;
}

const LINE_COLOR: Record<string, string> = {
  BHS: 'var(--agent-radar)',
  Cartón: 'var(--agent-calificador)',
  Intralogística: 'var(--agent-contactos)',
};

export function CompanyDetailDrawer({ empresa, open, onClose }: Props) {
  const [tab, setTab] = useState('resumen');

  // Reset to resumen tab whenever a different empresa opens
  useEffect(() => {
    if (open) setTab('resumen');
  }, [open, empresa?.id]);

  const enabled = open && !!empresa?.id;

  const { data: senales = [], isLoading: loadingSignals } = useQuery<Signal[]>({
    queryKey: ['signals', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/signals?empresa_id=${empresa!.id}&limit=100`)
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : [])),
    enabled: enabled && (tab === 'radar' || tab === 'resumen'),
    staleTime: 60_000,
  });

  const { data: contactos = [], isLoading: loadingContactos } = useQuery<Contacto[]>({
    queryKey: ['contactos', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/contacts?empresa_id=${empresa!.id}&limit=100`)
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : [])),
    enabled: enabled && (tab === 'contactos' || tab === 'resumen'),
    staleTime: 60_000,
  });

  const { data: calificaciones = [], isLoading: loadingCal } = useQuery<Calificacion[]>({
    queryKey: ['calificaciones', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/calificaciones?empresa_id=${empresa!.id}&limit=10`)
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : [])),
    enabled: enabled && tab === 'calificador',
    staleTime: 60_000,
  });

  const avgScore =
    senales.length > 0
      ? Math.round(senales.reduce((s, sig) => s + sig.scoreRadar, 0) / senales.length)
      : null;

  const lineColor = empresa
    ? (LINE_COLOR[empresa.linea] ?? 'var(--agent-radar)')
    : 'var(--agent-radar)';

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[580px]"
        showCloseButton
      >
        {empresa && (
          <>
            {/* ── Header ────────────────────────────────────────────────── */}
            <div
              className="h-0.5 w-full shrink-0"
              style={{ background: lineColor }}
            />
            <SheetHeader className="shrink-0 border-b border-border px-5 pb-4 pt-4">
              <div className="flex items-start gap-3 pr-8">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="line-clamp-1 text-base font-semibold leading-tight">
                    {empresa.nombre}
                  </SheetTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <LineaBadge linea={empresa.linea} />
                    <TierBadge tier={empresa.tier} />
                    {empresa.pais && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={11} />
                        {empresa.pais}
                      </span>
                    )}
                    {empresa.dominio && (
                      <a
                        href={`https://${empresa.dominio}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
                      >
                        <ExternalLink size={11} />
                        {empresa.dominio}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI strip */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Señales</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">
                    {loadingSignals ? '…' : senales.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contactos</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">
                    {loadingContactos ? '…' : contactos.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score Prom.</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">
                    {avgScore !== null ? avgScore : '—'}
                  </p>
                </div>
              </div>
            </SheetHeader>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <Tabs
              value={tab}
              onValueChange={setTab}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList
                variant="line"
                className="h-10 w-full shrink-0 justify-start gap-0 rounded-none border-b border-border bg-muted/10 px-2"
              >
                <TabsTrigger value="resumen" className="px-3 text-xs">Resumen</TabsTrigger>
                <TabsTrigger value="radar" className="px-3 text-xs">Radar</TabsTrigger>
                <TabsTrigger value="calificador" className="px-3 text-xs">Calificador</TabsTrigger>
                <TabsTrigger value="contactos" className="px-3 text-xs">Contactos</TabsTrigger>
                <TabsTrigger value="historial" className="px-3 text-xs">Historial</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                {/* ── Resumen ─────────────────────────────────────────── */}
                <TabsContent value="resumen" className="m-0 space-y-4 p-4">
                  {loadingSignals ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> Cargando...
                    </div>
                  ) : senales.length > 0 ? (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Última señal
                      </p>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <ScoreBadge score={senales[0]!.scoreRadar} showNumber />
                          <span className="text-sm text-muted-foreground">
                            {senales[0]!.tipoSenal || 'Sin tipo'}
                          </span>
                        </div>
                        {senales[0]!.descripcion && (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {senales[0]!.descripcion}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                          {senales[0]!.fechaEscaneo}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 py-6 text-center">
                      <Zap size={20} className="mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Sin señales registradas</p>
                    </div>
                  )}

                  {!loadingContactos && contactos.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Contacto principal
                      </p>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">{contactos[0]!.nombre}</p>
                        {contactos[0]!.cargo && (
                          <p className="text-xs text-muted-foreground">{contactos[0]!.cargo}</p>
                        )}
                        {contactos[0]!.email && (
                          <a
                            href={`mailto:${contactos[0]!.email}`}
                            className="text-xs text-blue-500 hover:text-blue-400"
                          >
                            {contactos[0]!.email}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/empresas/${empresa.id}`}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                  >
                    Ver perfil completo
                    <ArrowUpRight size={12} className="ml-auto" />
                  </Link>
                </TabsContent>

                {/* ── Radar ───────────────────────────────────────────── */}
                <TabsContent value="radar" className="m-0">
                  {loadingSignals ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> Cargando señales...
                    </div>
                  ) : senales.length === 0 ? (
                    <EmptyState
                      icon={Zap}
                      title="Sin señales registradas"
                      description="Lanza un escaneo para detectar señales CAPEX para esta empresa."
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {senales.map((s, i) => (
                        <div
                          key={s.id ?? i}
                          className="px-4 py-3 transition-colors hover:bg-muted/20"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <ScoreBadge score={s.scoreRadar} showNumber />
                            <span className="text-sm text-muted-foreground">
                              {s.tipoSenal || 'Sin tipo'}
                            </span>
                          </div>
                          {s.descripcion && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {s.descripcion}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                            <span>{s.fechaEscaneo}</span>
                            {s.ventanaCompra && <span>{s.ventanaCompra}</span>}
                            {s.fuenteUrl && (
                              <a
                                href={s.fuenteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-500 hover:text-blue-400"
                              >
                                <ExternalLink size={10} />
                                {s.fuente || 'Fuente'}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Calificador ─────────────────────────────────────── */}
                <TabsContent value="calificador" className="m-0">
                  {loadingCal ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> Cargando calificaciones...
                    </div>
                  ) : calificaciones.length === 0 ? (
                    <EmptyState
                      icon={BarChart2}
                      title="Sin calificaciones"
                      description="Las calificaciones aparecen cuando el Agente 01 evalúa esta empresa."
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {calificaciones.map((c, i) => (
                        <div
                          key={c.id ?? i}
                          className="px-4 py-3 transition-colors hover:bg-muted/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ScoreBadge score={c.score_total * 10} showNumber />
                              <span className="text-sm font-medium text-foreground">{c.tier_calculado}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : ''}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {[
                              ['Impacto', c.impacto_presupuesto],
                              ['Año obj.', c.anio_objetivo],
                              ['Recurrencia', c.recurrencia],
                              ['Multiplanta', c.multiplanta],
                              ['Ticket', c.ticket_estimado],
                              ['Prioridad', c.prioridad_comercial],
                            ].filter(([, v]) => v).map(([k, v]) => (
                              <div key={k as string} className="text-xs text-muted-foreground">
                                <span className="font-medium">{k}:</span> {v}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Contactos ───────────────────────────────────────── */}
                <TabsContent value="contactos" className="m-0">
                  {loadingContactos ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> Cargando contactos...
                    </div>
                  ) : contactos.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="Sin contactos"
                      description="Los contactos aparecen cuando el Agente Prospector actúa sobre esta empresa."
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {contactos.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{c.nombre}</p>
                            {c.cargo && (
                              <p className="text-xs text-muted-foreground">{c.cargo}</p>
                            )}
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="text-xs text-blue-500 hover:text-blue-400"
                              >
                                {c.email}
                              </a>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {c.linkedinUrl && (
                              <a
                                href={c.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                            <HubSpotStatusBadge status={c.hubspotStatus} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Historial ───────────────────────────────────────── */}
                <TabsContent value="historial" className="m-0 p-4">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Historial completo de escaneos y eventos para esta empresa.
                    </p>
                    <Link
                      href={`/empresas/${empresa.id}/timeline`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                    >
                      <Clock size={14} />
                      Ver línea de tiempo completa
                      <ArrowUpRight size={12} className="ml-auto" />
                    </Link>
                    <Link
                      href={`/empresas/${empresa.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                    >
                      Ver perfil completo
                      <ArrowUpRight size={12} className="ml-auto" />
                    </Link>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
