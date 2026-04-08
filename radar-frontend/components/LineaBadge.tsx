import { cn } from '@/lib/utils';
import type { LineaNegocio } from '@/lib/types';

const lineaStyles: Record<string, string> = {
  'BHS':            'bg-blue-50    text-blue-700    border border-blue-200',
  'Cartón':         'bg-amber-50   text-amber-700   border border-amber-200',
  'Intralogística': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Final de Línea': 'bg-violet-50  text-violet-700  border border-violet-200',
  'Motos':          'bg-orange-50  text-orange-700  border border-orange-200',
  'SOLUMAT':        'bg-cyan-50    text-cyan-700    border border-cyan-200',
};

interface LineaBadgeProps {
  linea: LineaNegocio | string;
  className?: string;
}

export function LineaBadge({ linea, className }: LineaBadgeProps) {
  const style = lineaStyles[linea] ?? 'bg-surface-muted text-muted-foreground border border-border';
  return (
    <span className={cn(
      'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
      style,
      className,
    )}>
      {linea}
    </span>
  );
}
