'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RadarV2Result } from '@/lib/radar-v2/types';
import { FuenteBadge } from './FuenteBadge';
import { MotivoDescarte } from './MotivoDescarte';

interface Props {
  result: RadarV2Result;
}

const ventanaColor: Record<string, string> = {
  '0-6 Meses':   'bg-red-500/15 text-red-700 dark:text-red-400',
  '6-12 Meses':  'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  '12-18 Meses': 'bg-yellow-500/15 text-yellow-700',
  '18-24 Meses': 'bg-blue-500/15 text-blue-600',
  '> 24 Meses':  'bg-muted text-muted-foreground',
  'Sin señal':   'bg-muted text-muted-foreground',
};

export function ResultCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const active = result.radar_activo === 'Sí';

  return (
    <Card
      className={cn(
        'border-l-4 transition-colors',
        active ? 'border-l-green-500' : 'border-l-red-400',
      )}
      data-company={result.empresa_evaluada}
    >
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">
              {result.empresa_evaluada}
            </CardTitle>
            {result.pais && (
              <p className="mt-0.5 text-xs text-muted-foreground">{result.pais}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              className={cn(
                'text-xs font-semibold',
                active
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25'
                  : 'bg-red-500/15 text-red-600 hover:bg-red-500/25',
              )}
              variant="secondary"
            >
              {active ? '✓ Señal activa' : '✗ Descartada'}
            </Badge>
            {active && result.ventana_compra && result.ventana_compra !== 'Sin señal' && (
              <Badge
                className={cn('text-xs', ventanaColor[result.ventana_compra] ?? '')}
                variant="secondary"
              >
                {result.ventana_compra}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Type + evaluacion */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {result.tipo_senal && result.tipo_senal !== 'Sin Señal' && (
            <span className="font-medium text-foreground">{result.tipo_senal}</span>
          )}
          {result.evaluacion_temporal && (
            <span>{result.evaluacion_temporal.split(' ')[0]}</span>
          )}
          {result.total_criterios > 0 && (
            <span>{result.total_criterios}/6 criterios</span>
          )}
        </div>

        {/* Summary */}
        {result.descripcion_resumen && (
          <p className={cn('text-sm text-foreground/80', !expanded && 'line-clamp-2')}>
            {result.descripcion_resumen}
          </p>
        )}

        {/* Motivo descarte */}
        {!active && (
          <MotivoDescarte
            motivoDescarte={result.motivo_descarte}
            descripcionResumen={result.descripcion_resumen}
          />
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {/* Criterios */}
            {result.criterios_cumplidos?.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Criterios cumplidos
                </p>
                <ul className="space-y-0.5">
                  {result.criterios_cumplidos.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Proyecto */}
            {result.empresa_o_proyecto && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyecto</p>
                <p className="text-sm">{result.empresa_o_proyecto}</p>
              </div>
            )}

            {/* Monto */}
            {result.monto_inversion && result.monto_inversion !== 'No reportado' && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto</p>
                <p className="text-sm font-medium">{result.monto_inversion}</p>
              </div>
            )}

            {/* Fuente */}
            {result.fuente_link && result.fuente_link !== 'No disponible' && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fuente — {result.fuente_nombre}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={result.fuente_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink size={11} />
                    {result.fuente_link.slice(0, 80)}{result.fuente_link.length > 80 ? '…' : ''}
                  </a>
                  <FuenteBadge
                    status={result.fuente_verificada}
                    notas={result.verificacion_notas}
                  />
                </div>
                {result.fecha_senal && result.fecha_senal !== 'No disponible' && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{result.fecha_senal}</span>
                )}
              </div>
            )}

            {/* Observaciones */}
            {result.observaciones && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observaciones</p>
                <p className="text-xs text-muted-foreground italic">{result.observaciones}</p>
              </div>
            )}

            {/* Cost */}
            {result.cost_usd != null && (
              <p className="text-right text-[10px] text-muted-foreground">
                Costo: ${result.cost_usd.toFixed(4)} USD
                {result.tokens_input ? ` · ${result.tokens_input.toLocaleString()} tokens entrada` : ''}
              </p>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-6 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp size={13} className="mr-1" /> : <ChevronDown size={13} className="mr-1" />}
          {expanded ? 'Menos detalle' : 'Ver detalle completo'}
        </Button>
      </CardContent>
    </Card>
  );
}
