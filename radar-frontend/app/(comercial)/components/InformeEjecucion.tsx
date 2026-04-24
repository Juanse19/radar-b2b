'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FuenteBadge } from './FuenteBadge';
import type { Informe, VerificationFlag } from '@/lib/comercial/types';

interface Props {
  sessionId: string;
  open:      boolean;
  onClose:   () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function InformeEjecucion({ sessionId, open, onClose }: Props) {
  const [informe,  setInforme]  = useState<Informe | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return;

    let cancelled = false;

    // Defer synchronous setState calls by one microtask to satisfy
    // react-compiler/react-compiler lint rule while maintaining expected UX.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setInforme(null);
      setNotFound(false);
    });

    fetch(`/api/comercial/reports/${sessionId}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Informe>;
      })
      .then(data => {
        if (cancelled) return;
        if (data) setInforme(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, sessionId]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {informe
              ? `Informe — ${informe.session.linea_negocio} — ${formatDate(informe.session.created_at)}`
              : 'Informe de Ejecución'}
          </DialogTitle>
        </DialogHeader>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {/* Not found state */}
        {!loading && notFound && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Informe no disponible para esta sesión.
          </p>
        )}

        {/* Content */}
        {!loading && informe && (
          <div className="space-y-5">
            {/* KPI summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiBlock label="Empresas"   value={informe.session.empresas_count} />
              <KpiBlock
                label="Activas"
                value={informe.session.activas_count}
                className="text-green-700 dark:text-green-400"
              />
              <KpiBlock
                label="Descartadas"
                value={informe.session.descartadas_count}
                className="text-muted-foreground"
              />
              <KpiBlock
                label="Costo USD"
                value={`$${informe.session.total_cost_usd.toFixed(4)}`}
              />
            </div>

            {/* Señales activas */}
            {informe.activas.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Señales activas ({informe.activas.length})
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Empresa</th>
                        <th className="px-3 py-2 text-left font-medium">Ventana</th>
                        <th className="px-3 py-2 text-left font-medium">Monto</th>
                        <th className="px-3 py-2 text-left font-medium">Fuente</th>
                        <th className="px-3 py-2 text-left font-medium">Verificada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {informe.activas.map((a, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 hover:bg-muted/20"
                        >
                          <td className="max-w-[160px] truncate px-3 py-2 font-medium">
                            {a.empresa}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {a.ventana ?? '—'}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2">
                            {a.monto ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {a.fuente_link ? (
                              <a
                                href={a.fuente_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <ExternalLink size={11} />
                                Fuente
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <FuenteBadge
                              status={a.fuente_verificada as VerificationFlag | null}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Descartadas */}
            {informe.descartes.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descartadas ({informe.descartes.length})
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Empresa</th>
                        <th className="px-3 py-2 text-left font-medium">Motivo de descarte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {informe.descartes.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 hover:bg-muted/20"
                        >
                          <td className="max-w-[160px] truncate px-3 py-2 font-medium">
                            {d.empresa}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground italic">
                            {d.motivo_descarte ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* No results at all */}
            {informe.activas.length === 0 && informe.descartes.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin resultados en esta sesión.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          {informe && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/comercial/reports/${sessionId}?format=md`)}
            >
              <Download size={13} className="mr-1.5" />
              Descargar .md
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Internal helper ──────────────────────────────────────────────────────────

function KpiBlock({
  label,
  value,
  className,
}: {
  label:      string;
  value:      string | number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold leading-none ${className ?? ''}`}>{value}</p>
    </div>
  );
}

// Re-export Badge for use in session column of ResultadosTable (avoids re-import)
export { Badge };
