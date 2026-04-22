'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { EmpresaRollupCounts, TierLetter } from '@/lib/comercial/types';

interface TierStatStripProps {
  counts:  EmpresaRollupCounts;
  loading: boolean;
}

interface TierChipProps {
  label:   string;
  value:   number;
  color:   string;      // Tailwind text color class
  bg:      string;      // Tailwind bg class
  border:  string;      // Tailwind border class
  loading: boolean;
}

function TierChip({ label, value, color, bg, border, loading }: TierChipProps) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2.5 min-w-[64px]', bg, border)}>
      {loading ? (
        <Skeleton className="h-6 w-8 rounded" />
      ) : (
        <span className={cn('text-xl font-bold tabular-nums leading-none', color)}>{value}</span>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

const TIER_CONFIG: Array<{
  key:    TierLetter | 'null';
  label:  string;
  color:  string;
  bg:     string;
  border: string;
}> = [
  { key: 'A',             label: 'Tier A',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/5',  border: 'border-amber-500/20' },
  { key: 'B',             label: 'Tier B',   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/5',   border: 'border-blue-500/20'  },
  { key: 'C',             label: 'Tier C',   color: 'text-zinc-500 dark:text-zinc-400',    bg: 'bg-zinc-500/5',   border: 'border-zinc-500/20'  },
  { key: 'D',             label: 'Tier D',   color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-500/5',    border: 'border-red-500/20'   },
  { key: 'sin_calificar', label: 'Sin cal.', color: 'text-muted-foreground',               bg: 'bg-muted/20',     border: 'border-border'       },
];

export function TierStatStrip({ counts, loading }: TierStatStripProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {/* Total */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-4 py-2.5 min-w-[72px]">
        {loading ? (
          <Skeleton className="h-6 w-10 rounded" />
        ) : (
          <span className="text-xl font-bold tabular-nums leading-none text-foreground">{counts.total}</span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empresas</span>
      </div>

      {/* Tier chips */}
      {TIER_CONFIG.map(({ key, label, color, bg, border }) => (
        <TierChip
          key={key}
          label={label}
          value={counts.por_tier[key] ?? 0}
          color={color}
          bg={bg}
          border={border}
          loading={loading}
        />
      ))}

      {/* Con señal */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 min-w-[72px]">
        {loading ? (
          <Skeleton className="h-6 w-8 rounded" />
        ) : (
          <span className="text-xl font-bold tabular-nums leading-none text-green-600 dark:text-green-400">{counts.con_radar}</span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Con señal</span>
      </div>
    </div>
  );
}
