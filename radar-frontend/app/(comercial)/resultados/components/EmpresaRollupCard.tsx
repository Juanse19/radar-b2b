import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TierBadge } from './TierBadge';
import { RagBadge } from './RagBadge';
import type { EmpresaRollup } from '@/lib/comercial/types';

interface EmpresaRollupCardProps {
  empresa:  EmpresaRollup;
  onSelect: (e: EmpresaRollup) => void;
}

export function EmpresaRollupCard({ empresa, onSelect }: EmpresaRollupCardProps) {
  const hasRadar  = empresa.radar_activo === 'Sí';
  const hasScore  = empresa.calif_score !== null && empresa.calif_score !== undefined;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        hasRadar
          ? 'border-green-500/25 bg-green-500/[0.03]'
          : 'border-border bg-card',
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-snug">{empresa.empresa_evaluada}</p>
          {empresa.pais && (
            <p className="mt-0.5 text-xs text-muted-foreground">{empresa.pais}</p>
          )}
        </div>
        <TierBadge tier={empresa.tier_actual} size="sm" />
      </div>

      {/* Badges row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {hasRadar && (
          <Badge className="border-green-500/30 bg-green-500/10 text-[10px] font-semibold text-green-700 dark:text-green-400">
            Señal activa
          </Badge>
        )}
        {hasScore && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
              (empresa.calif_score ?? 0) >= 7
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            Cal: {empresa.calif_score}/10
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {empresa.contactos_total} contactos
        </span>
        <RagBadge vectors={empresa.rag_vectors} />
      </div>

      {/* Action */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => onSelect(empresa)}
          aria-label={`Ver detalle de ${empresa.empresa_evaluada}`}
        >
          Ver detalle
        </Button>
      </div>
    </div>
  );
}
