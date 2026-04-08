import { cn } from '@/lib/utils';
import type { LineaNegocio } from '@/lib/types';

const lineaStyles: Record<string, string> = {
  'BHS':            'bg-blue-900/60    text-blue-300   border border-blue-800',
  'Cartón':         'bg-amber-900/60   text-amber-300  border border-amber-800',
  'Intralogística': 'bg-emerald-900/60 text-emerald-300 border border-emerald-800',
  'Final de Línea': 'bg-violet-900/60  text-violet-300 border border-violet-800',
  'Motos':          'bg-orange-900/60  text-orange-300 border border-orange-800',
  'SOLUMAT':        'bg-cyan-900/60    text-cyan-300   border border-cyan-800',
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
