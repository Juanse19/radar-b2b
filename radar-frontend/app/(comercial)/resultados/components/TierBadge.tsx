import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TierLetter } from '@/lib/comercial/types';

interface TierBadgeProps {
  tier: TierLetter | null | string;
  size?: 'sm' | 'md';
}

const TIER_STYLES: Record<string, string> = {
  A: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/50 dark:border-amber-700/50',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/50 dark:border-blue-700/50',
  C: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 border-zinc-300/50 dark:border-zinc-600/50',
  D: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300/50 dark:border-red-700/50',
  sin_calificar: 'bg-muted text-muted-foreground border-border/50',
};

const TIER_LABELS: Record<string, string> = {
  A: 'Tier A — anteriormente ORO',
  B: 'Tier B — anteriormente MONITOREO',
  C: 'Tier C — anteriormente ARCHIVO',
  D: 'Tier D',
  sin_calificar: 'Sin calificar',
};

const TIER_DISPLAY: Record<string, string> = {
  A: 'Tier A',
  B: 'Tier B',
  C: 'Tier C',
  D: 'Tier D',
  sin_calificar: 'Sin cal.',
};

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  if (tier === null || tier === undefined) {
    return (
      <span className="text-xs text-muted-foreground" aria-label="Sin tier asignado">
        —
      </span>
    );
  }

  const key = tier as string;
  const styles = TIER_STYLES[key] ?? TIER_STYLES['sin_calificar'];
  const label  = TIER_LABELS[key]   ?? `Tier ${key}`;
  const display = TIER_DISPLAY[key] ?? key;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'inline-flex items-center rounded-full border font-semibold tabular-nums cursor-default',
            size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
            styles,
          )}
          aria-label={label}
        >
          {display}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
