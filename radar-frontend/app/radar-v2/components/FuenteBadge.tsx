'use client';

import { ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { VerificationFlag } from '@/lib/radar-v2/types';

interface Props {
  status?: VerificationFlag | null;
  notas?:  string | null;
}

const CONFIG = {
  verificada: {
    icon:  ShieldCheck,
    label: 'Verificada',
    className: 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25',
  },
  no_verificable: {
    icon:  ShieldX,
    label: 'No verificable',
    className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/25',
  },
  pendiente: {
    icon:  Clock,
    label: 'Pendiente',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
} as const;

export function FuenteBadge({ status, notas }: Props) {
  if (!status || status === 'no_aplica') return null;

  const cfg = CONFIG[status];
  if (!cfg) return null;

  const { icon: Icon, label, className } = cfg;

  const badge = (
    <Badge
      variant="secondary"
      className={cn('inline-flex items-center gap-1 text-xs font-medium', className)}
    >
      <Icon size={11} />
      {label}
    </Badge>
  );

  if (!notas) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{notas}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
