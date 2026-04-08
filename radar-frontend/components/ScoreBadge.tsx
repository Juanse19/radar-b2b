import { cn } from '@/lib/utils';

export type ScoreTier = 'ORO' | 'Monitoreo' | 'Contexto' | 'Sin Señal';

/**
 * Normaliza un score a escala 1-10.
 * Si el score es > 10 asume escala 0-100 y divide por 10.
 */
export function normalizeScore(score: number): number {
  if (score > 10) return Math.round(score / 10);
  return Math.round(score);
}

export function getScoreTier(raw: number): ScoreTier {
  const score = normalizeScore(raw);
  if (score >= 8) return 'ORO';
  if (score >= 5) return 'Monitoreo';
  if (score >= 1) return 'Contexto';
  return 'Sin Señal';
}

const tierStyles: Record<ScoreTier, string> = {
  ORO:        'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  Monitoreo:  'bg-blue-900/60  text-blue-300  border border-blue-700',
  Contexto:   'bg-surface-muted     text-muted-foreground  border border-border',
  'Sin Señal':'bg-surface     text-muted-foreground  border border-border',
};

interface ScoreBadgeProps {
  score: number;
  showNumber?: boolean;
  className?: string;
}

export function ScoreBadge({ score, showNumber = true, className }: ScoreBadgeProps) {
  const normalized = normalizeScore(score);
  const tier = getScoreTier(score);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      tierStyles[tier],
      className,
    )}>
      {tier === 'ORO' && <span aria-hidden>★</span>}
      {tier}
      {showNumber && (
        <span className="opacity-70">({normalized})</span>
      )}
    </span>
  );
}
