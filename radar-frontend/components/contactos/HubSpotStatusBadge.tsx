import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HubSpotStatus } from '@/lib/types';

const statusConfig: Record<HubSpotStatus, { label: string; icon: React.ReactNode; className: string }> = {
  sincronizado: {
    label: 'Sincronizado',
    icon: <CheckCircle2 size={11} />,
    className: 'bg-green-900/60 text-green-300 border border-green-800',
  },
  pendiente: {
    label: 'Pendiente',
    icon: <Clock size={11} />,
    className: 'bg-yellow-900/60 text-yellow-300 border border-yellow-800',
  },
  error: {
    label: 'Error',
    icon: <AlertCircle size={11} />,
    className: 'bg-red-900/60 text-red-300 border border-red-800',
  },
};

interface HubSpotStatusBadgeProps {
  status: HubSpotStatus | string;
  className?: string;
}

export function HubSpotStatusBadge({ status, className }: HubSpotStatusBadgeProps) {
  const config = statusConfig[status as HubSpotStatus] ?? statusConfig.pendiente;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      config.className,
      className,
    )}>
      {config.icon}
      {config.label}
    </span>
  );
}
