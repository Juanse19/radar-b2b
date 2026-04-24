// components/tracker/StatusDot.tsx
import { cn } from '@/lib/utils';

export type DotStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting' | 'partial';

interface StatusDotProps {
  status: DotStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const COLORS: Record<DotStatus, string> = {
  idle:    'bg-gray-400',
  running: 'bg-blue-500',
  waiting: 'bg-amber-500',
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  partial: 'bg-violet-500',
};

const SIZES: Record<NonNullable<StatusDotProps['size']>, string> = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
};

export function StatusDot({ status, size = 'md', className }: StatusDotProps) {
  const isAnimated = status === 'running' || status === 'waiting';
  return (
    <span
      role="status"
      aria-label={status}
      className={cn(
        'inline-block rounded-full shrink-0',
        COLORS[status],
        SIZES[size],
        isAnimated && 'animate-pulse',
        className,
      )}
    />
  );
}
