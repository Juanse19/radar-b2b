import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TierBadge } from './TierBadge';
import { RagBadge } from './RagBadge';
import type { EmpresaRollup } from '@/lib/comercial/types';

interface EmpresaRollupTableProps {
  empresas: EmpresaRollup[];
  loading:  boolean;
  onSelect: (e: EmpresaRollup) => void;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border/40">
          <td className="px-3 py-3"><Skeleton className="h-4 w-32 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-16 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-10 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-5 w-12 rounded-full" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-16 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-8 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-16 rounded-full" /></td>
          <td className="px-3 py-3"><Skeleton className="h-7 w-12 rounded" /></td>
        </tr>
      ))}
    </>
  );
}

export function EmpresaRollupTable({ empresas, loading, onSelect }: EmpresaRollupTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-medium">Empresa</th>
            <th className="px-3 py-2.5 text-left font-medium">País</th>
            <th className="px-3 py-2.5 text-left font-medium">Tier</th>
            <th className="px-3 py-2.5 text-left font-medium">Cal.</th>
            <th className="px-3 py-2.5 text-left font-medium">Radar</th>
            <th className="px-3 py-2.5 text-left font-medium">Ventana</th>
            <th className="px-3 py-2.5 text-left font-medium">Contactos</th>
            <th className="px-3 py-2.5 text-left font-medium">RAG</th>
            <th className="px-3 py-2.5 text-left font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : (
            empresas.map((empresa, i) => {
              const hasRadar = empresa.radar_activo === 'Sí';
              const hasScore = empresa.calif_score !== null && empresa.calif_score !== undefined;

              return (
                <tr
                  key={empresa.empresa_id ?? `${empresa.empresa_evaluada}-${i}`}
                  className={cn(
                    'border-b border-border/40 transition-colors',
                    hasRadar
                      ? 'bg-green-500/[0.02] hover:bg-green-500/[0.06]'
                      : i % 2 === 0
                        ? 'bg-background hover:bg-muted/20'
                        : 'bg-muted/[0.02] hover:bg-muted/20',
                  )}
                >
                  {/* Empresa */}
                  <td className="px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium max-w-[180px]">{empresa.empresa_evaluada}</p>
                      {empresa.linea_negocio && (
                        <p className="truncate text-[10px] text-muted-foreground max-w-[180px]">
                          {empresa.linea_negocio}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* País */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {empresa.pais ?? '—'}
                    </span>
                  </td>

                  {/* Tier */}
                  <td className="px-3 py-2.5">
                    <TierBadge tier={empresa.tier_actual} size="sm" />
                  </td>

                  {/* Cal. score */}
                  <td className="px-3 py-2.5">
                    {hasScore ? (
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums',
                          (empresa.calif_score ?? 0) > 7
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        {empresa.calif_score}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Radar */}
                  <td className="px-3 py-2.5">
                    {hasRadar ? (
                      <Badge className="border-green-500/30 bg-green-500/10 text-[10px] font-semibold text-green-700 dark:text-green-400">
                        Activo
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>

                  {/* Ventana */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {empresa.ventana_compra ?? '—'}
                    </span>
                  </td>

                  {/* Contactos */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs tabular-nums font-medium">
                      {empresa.contactos_total}
                    </span>
                  </td>

                  {/* RAG */}
                  <td className="px-3 py-2.5">
                    <RagBadge vectors={empresa.rag_vectors} />
                  </td>

                  {/* Acción */}
                  <td className="px-3 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => onSelect(empresa)}
                      aria-label={`Ver detalle de ${empresa.empresa_evaluada}`}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
