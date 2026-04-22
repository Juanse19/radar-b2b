'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FuenteBadge } from '@/app/(comercial)/components/FuenteBadge';
import type { ComercialResult } from '@/lib/comercial/types';

interface Props {
  results:        ComercialResult[];
  loading?:       boolean;
  onLoadMore?:    () => void;
  hasMore?:       boolean;
  onVerInforme?:  (sessionId: string) => void;
}

const ventanaShort: Record<string, string> = {
  '0-6 Meses':   '0-6m',
  '6-12 Meses':  '6-12m',
  '12-18 Meses': '12-18m',
  '18-24 Meses': '18-24m',
  '> 24 Meses':  '>24m',
  'Sin señal':   '—',
};

export function ResultadosTable({ results, loading, onLoadMore, hasMore, onVerInforme }: Props) {
  if (loading && !results.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Cargando resultados...</p>;
  }

  if (!results.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sin resultados para los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">Empresa</th>
              <th className="px-3 py-2.5 text-left font-medium">Radar</th>
              <th className="px-3 py-2.5 text-left font-medium">Tipo señal</th>
              <th className="px-3 py-2.5 text-left font-medium">Ventana</th>
              <th className="px-3 py-2.5 text-left font-medium">Monto</th>
              <th className="px-3 py-2.5 text-left font-medium">Fuente</th>
              <th className="px-3 py-2.5 text-left font-medium">Verificada</th>
              <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
              {onVerInforme && (
                <th className="px-3 py-2.5 text-left font-medium">Informe</th>
              )}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={r.id ?? i}
                className={cn(
                  'border-b border-border/50 transition-colors hover:bg-muted/30',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                )}
              >
                <td className="max-w-[180px] px-3 py-2.5">
                  <p className="truncate font-medium">{r.empresa_evaluada}</p>
                  {r.pais && <p className="text-xs text-muted-foreground">{r.pais}</p>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs font-semibold',
                      r.radar_activo === 'Sí'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-red-500/15 text-red-600',
                    )}
                  >
                    {r.radar_activo === 'Sí' ? '✓ Sí' : '✗ No'}
                  </Badge>
                </td>
                <td className="max-w-[140px] px-3 py-2.5">
                  <p className="truncate text-xs">{r.tipo_senal ?? '—'}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium">
                    {ventanaShort[r.ventana_compra] ?? r.ventana_compra ?? '—'}
                  </span>
                </td>
                <td className="max-w-[120px] px-3 py-2.5">
                  <p className="truncate text-xs">
                    {r.monto_inversion && r.monto_inversion !== 'No reportado'
                      ? r.monto_inversion
                      : <span className="text-muted-foreground">—</span>}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  {r.fuente_link && r.fuente_link !== 'No disponible' ? (
                    <a
                      href={r.fuente_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={11} />
                      {r.fuente_nombre?.split('(')[0]?.trim() ?? 'Fuente'}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <FuenteBadge
                    status={r.fuente_verificada}
                    notas={r.verificacion_notas}
                  />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                    : '—'}
                </td>
                {onVerInforme && (
                  <td className="px-3 py-2.5">
                    {r.session_id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onVerInforme(r.session_id!)}
                      >
                        <FileText size={12} className="mr-1" />
                        Ver
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Cargando...' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  );
}
