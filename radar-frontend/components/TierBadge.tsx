import { cn } from '@/lib/utils';

const tierStyles: Record<string, string> = {
  'Tier A':      'bg-purple-900/60 text-purple-300 border border-purple-800',
  'Tier B-Alta': 'bg-indigo-900/60 text-indigo-300 border border-indigo-800',
  'Tier B':      'bg-surface-muted      text-muted-foreground   border border-border',
  'Tier B-Baja': 'bg-surface-muted      text-muted-foreground   border border-border',
  'Tier C':      'bg-surface      text-muted-foreground   border border-border',
  'Tier D':      'bg-surface      text-muted-foreground   border border-border',
};

interface TierBadgeProps {
  tier: string;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const style = tierStyles[tier] ?? 'bg-surface-muted text-muted-foreground border border-border';
  return (
    <span className={cn(
      'inline-block px-2 py-0.5 rounded-full text-xs',
      style,
      className,
    )}>
      {tier}
    </span>
  );
}
