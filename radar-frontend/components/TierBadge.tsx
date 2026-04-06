import { cn } from '@/lib/utils';

const tierStyles: Record<string, string> = {
  'Tier A':      'bg-purple-900/60 text-purple-300 border border-purple-800',
  'Tier B-Alta': 'bg-indigo-900/60 text-indigo-300 border border-indigo-800',
  'Tier B':      'bg-gray-800      text-gray-300   border border-gray-700',
  'Tier B-Baja': 'bg-gray-800      text-gray-400   border border-gray-700',
  'Tier C':      'bg-gray-900      text-gray-500   border border-gray-800',
  'Tier D':      'bg-gray-900      text-gray-600   border border-gray-800',
};

interface TierBadgeProps {
  tier: string;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const style = tierStyles[tier] ?? 'bg-gray-800 text-gray-400 border border-gray-700';
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
