import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TierBadge } from './TierBadge';
import { Zap, Users, ChevronRight } from 'lucide-react';
import type { EmpresaRollup } from '@/lib/comercial/types';

interface EmpresaRollupTableProps {
  empresas: EmpresaRollup[];
  loading:  boolean;
  onSelect: (e: EmpresaRollup) => void;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <tr key={i} className="border-b border-border/40">
          <td className="px-0 py-3.5">
            <div className="pl-4 pr-3">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="mt-1 h-3 w-24 rounded" />
            </div>
          </td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-14 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-6 w-8 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-8 rounded" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-7 w-16 rounded-md" /></td>
        </tr>
      ))}
    </>
  );
}

const ventanaShort: Record<string, string> = {
  '0-6 Meses':   '0–6m',
  '6-12 Meses':  '6–12m',
  '12-18 Meses': '12–18m',
  '18-24 Meses': '18–24m',
  '> 24 Meses':  '>24m',
};

function ventanaStyle(v?: string | null) {
  if (!v || v === 'Sin señal') return 'bg-muted/50 text-muted-foreground border-border/60';
  if (v === '0-6 Meses')  return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-400/30';
  if (v === '6-12 Meses') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30';
  return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/30';
}

export function EmpresaRollupTable({ empresas, loading, onSelect }: EmpresaRollupTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />                            {/* Empresa — flexible */}
          <col style={{ width: '80px' }} />  {/* Tier */}
          <col style={{ width: '68px' }} />  {/* Score */}
          <col style={{ width: '108px' }} /> {/* Señal */}
          <col style={{ width: '88px' }} />  {/* Ventana */}
          <col style={{ width: '84px' }} />  {/* Contactos */}
          <col style={{ width: '88px' }} />  {/* Acción */}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empresa</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tier</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cal.</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Señal</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ventana</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contactos</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows />
          ) : (
            empresas.map((empresa, i) => {
              const hasRadar = empresa.radar_activo === 'Sí';
              const hasScore = empresa.calif_score !== null && empresa.calif_score !== undefined;
              const score    = empresa.calif_score ?? 0;
              const ventana  = empresa.ventana_compra ?? null;

              return (
                <tr
                  key={empresa.empresa_id ?? `${empresa.empresa_evaluada}-${i}`}
                  className={cn(
                    'group transition-colors cursor-pointer',
                    hasRadar
                      ? 'bg-green-500/[0.02] hover:bg-green-500/[0.06]'
                      : 'hover:bg-muted/25',
                  )}
                  onClick={() => onSelect(empresa)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(empresa); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle de ${empresa.empresa_evaluada}`}
                >
                  {/* Empresa — left accent + name + country/line */}
                  <td className="overflow-hidden px-0 py-0">
                    <div className="flex h-full items-stretch">
                      <div className={cn(
                        'w-[3px] shrink-0 rounded-r-full self-stretch my-1',
                        hasRadar ? 'bg-green-500' : 'bg-transparent',
                      )} aria-hidden />
                      <div className="min-w-0 py-3.5 pl-3 pr-4">
                        <p className="block truncate text-[13px] font-semibold text-foreground leading-snug">
                          {empresa.empresa_evaluada}
                        </p>
                        <p className="block truncate text-[11px] text-muted-foreground mt-0.5">
                          {[empresa.pais, empresa.linea_negocio].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3.5">
                    <TierBadge tier={empresa.tier_actual} size="sm" />
                  </td>

                  {/* Cal. score */}
                  <td className="px-4 py-3.5">
                    {hasScore ? (
                      <span className={cn(
                        'text-[15px] font-bold tabular-nums leading-none',
                        score >= 8
                          ? 'text-amber-600 dark:text-amber-400'
                          : score >= 5
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                      )}>
                        {score}
                        <span className="text-[10px] font-normal text-muted-foreground">/10</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Señal radar */}
                  <td className="px-4 py-3.5">
                    {hasRadar ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/12 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:text-green-400">
                        <Zap size={9} aria-hidden />
                        Activa
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">Sin señal</span>
                    )}
                  </td>

                  {/* Ventana */}
                  <td className="px-4 py-3.5">
                    {ventana && ventana !== 'Sin señal' ? (
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        ventanaStyle(ventana),
                      )}>
                        {ventanaShort[ventana] ?? ventana}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Contactos */}
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-foreground/70">
                      <Users size={10} className="text-muted-foreground" aria-hidden />
                      {empresa.contactos_total ?? 0}
                    </span>
                  </td>

                  {/* Acción */}
                  <td className="px-4 py-3.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); onSelect(empresa); }}
                      aria-label={`Ver detalle de ${empresa.empresa_evaluada}`}
                    >
                      Ver
                      <ChevronRight size={11} className="ml-0.5" />
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
