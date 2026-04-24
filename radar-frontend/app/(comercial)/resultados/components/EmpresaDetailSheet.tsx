'use client';

import { useState } from 'react';
import { ExternalLink, Building2, Radio, Users, Brain, History } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TierBadge } from './TierBadge';
import { FeedbackButtons } from './FeedbackButtons';
import { EmpresaTimeline } from './EmpresaTimeline';
import type { EmpresaRollup } from '@/lib/comercial/types';

interface EmpresaDetailSheetProps {
  empresa: EmpresaRollup | null;
  onClose: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  } catch {
    return iso;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: 'amber' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        'text-xs text-right font-medium',
        accent === 'amber' && 'text-amber-600 dark:text-amber-400',
      )}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function EmpresaDetailSheet({ empresa, onClose }: EmpresaDetailSheetProps) {
  const [expanded,   setExpanded]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<'info' | 'historial'>('info');

  if (!empresa) return null;

  const hasRadar = empresa.radar_activo === 'Sí';

  const descripcion = empresa.descripcion_resumen?.trim() ?? '';
  const descripcionTruncada = !expanded && descripcion.length > 200
    ? `${descripcion.slice(0, 200)}…`
    : descripcion;

  return (
    <Sheet open={!!empresa} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg overflow-hidden"
        aria-label={`Detalle de ${empresa.empresa_evaluada}`}
      >
        {/* Header */}
        <SheetHeader className="border-b border-border bg-card px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Building2 size={16} className="text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base leading-snug">
                {empresa.empresa_evaluada}
              </SheetTitle>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {empresa.pais && (
                  <span className="text-xs text-muted-foreground">{empresa.pais}</span>
                )}
                <TierBadge tier={empresa.tier_actual} size="sm" />
                {hasRadar && (
                  <Badge className="border-green-500/30 bg-green-500/10 text-[10px] font-semibold text-green-700 dark:text-green-400">
                    Señal activa
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex gap-0 border-b -mb-4 -mx-5 px-5">
            {(['info', 'historial'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 pb-2 pt-1 text-xs font-medium transition-colors mr-4',
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                aria-selected={activeTab === tab}
              >
                {tab === 'info' ? (
                  <><Building2 size={12} />Info</>
                ) : (
                  <><History size={12} />Historial</>
                )}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {activeTab === 'info' ? (
            <>
              {/* Radar section */}
              {hasRadar && (
                <section>
                  <SectionLabel>
                    <Radio size={10} className="inline mr-1" />
                    Señal radar
                  </SectionLabel>
                  <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
                    {empresa.tipo_senal && (
                      <p className="text-xs font-semibold">{empresa.tipo_senal}</p>
                    )}
                    {descripcion && (
                      <div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {descripcionTruncada}
                        </p>
                        {descripcion.length > 200 && (
                          <button
                            type="button"
                            onClick={() => setExpanded(e => !e)}
                            className="mt-1 text-[11px] text-primary hover:underline"
                          >
                            {expanded ? 'Ver menos' : 'Ver más'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="pt-1 space-y-0">
                      <Row label="Monto"   value={empresa.monto_inversion}  accent="amber" />
                      <Row label="Ventana" value={empresa.ventana_compra} />
                      <Row label="Fecha"   value={formatDate(empresa.radar_at)} />
                      {empresa.fuente_nombre && (
                        <div className="flex items-start justify-between gap-3 py-1.5">
                          <span className="text-xs text-muted-foreground shrink-0">Fuente</span>
                          {empresa.fuente_link && empresa.fuente_link !== 'No disponible' ? (
                            <a
                              href={empresa.fuente_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline text-right"
                              aria-label={`Abrir fuente: ${empresa.fuente_nombre}`}
                            >
                              <ExternalLink size={10} />
                              <span className="max-w-[200px] truncate">{empresa.fuente_nombre}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-right">{empresa.fuente_nombre}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {empresa.session_id && (
                      <div className="pt-1 border-t border-border/30">
                        <FeedbackButtons resultadoId={empresa.session_id} />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Calificación section */}
              {(empresa.calif_score !== null || empresa.calif_tier) && (
                <section>
                  <SectionLabel>Calificación</SectionLabel>
                  <div className="rounded-lg border border-border/50 bg-card p-3 space-y-0">
                    <Row
                      label="Score"
                      value={empresa.calif_score !== null ? `${empresa.calif_score}/10` : null}
                      accent="amber"
                    />
                    <Row label="Tier"  value={empresa.calif_tier} />
                    <Row label="Fecha" value={formatDate(empresa.calif_at)} />
                  </div>
                </section>
              )}

              {/* Contactos section */}
              <section>
                <SectionLabel>
                  <Users size={10} className="inline mr-1" />
                  Contactos
                </SectionLabel>
                <div className="rounded-lg border border-border/50 bg-card p-3 space-y-0">
                  <Row label="Total"          value={empresa.contactos_total} />
                  <Row label="Última prospección" value={formatDate(empresa.ultima_prospeccion_at)} />
                </div>
              </section>

              {/* RAG section */}
              {empresa.rag_vectors > 0 && (
                <section>
                  <SectionLabel>
                    <Brain size={10} className="inline mr-1" />
                    Vectores RAG
                  </SectionLabel>
                  <div className="rounded-lg border border-violet-200/50 bg-violet-50/50 dark:border-violet-800/30 dark:bg-violet-900/10 p-3">
                    <p className="text-xs text-violet-700 dark:text-violet-400">
                      🧠 {empresa.rag_vectors} vectores similares usados en este scan
                    </p>
                  </div>
                </section>
              )}

              {/* Stats */}
              <section>
                <SectionLabel>Stats</SectionLabel>
                <div className="rounded-lg border border-border/50 bg-card p-3 space-y-0">
                  <Row label="Scans totales" value={empresa.scans_total} />
                  <Row label="Línea"         value={empresa.linea_negocio} />
                </div>
              </section>
            </>
          ) : (
            <section>
              <SectionLabel>Historial de eventos</SectionLabel>
              <EmpresaTimeline empresaId={empresa.empresa_id} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
