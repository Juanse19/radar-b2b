import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title = 'Sin resultados',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 text-center',
      className,
    )}>
      {Icon && (
        <div className="p-3 bg-gray-800/60 rounded-full mb-3">
          <Icon size={28} className="text-gray-500" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {description && (
        <p className="text-xs text-gray-600 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
