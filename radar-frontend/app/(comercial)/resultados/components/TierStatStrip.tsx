'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { EmpresaRollupCounts, TierLetter } from '@/lib/comercial/types';

interface TierStatStripProps {
  counts:  EmpresaRollupCounts;
  loading: boolean;
}

interface StatChipProps {
  label:   string;
  value:   number | string;
  accent?: 'amber' | 'blue' | 'zinc' | 'red' | 'green' | 'muted' | 'default';
  loading: boolean;
}

function StatChip({ label, value, accent = 'default', loading }: StatChipProps) {
  const valueClass = cn(
    'block text-xl font-bold tabular-nums leading-none',
    accent === 'amber'   && 'text-amber-600 dark:text-amber-400',
    accent === 'blue'    && 'text-blue-600 dark:text-blue-400',
    accent === 'zinc'    && 'text-zinc-500 dark:text-zinc-400',
    accent === 'red'     && 'text-red-600 dark:text-red-400',
    accent === 'green'   && 'text-green-600 dark:text-green-400',
    accent === 'muted'   && 'text-muted-foreground',
    accent === 'default' && 'text-foreground',
  );

  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2">
      {loading ? (
        <Skeleton className="h-6 w-8 rounded" />
      ) : (
        <span className={valueClass}>{value}</span>
      )}
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

const TIER_CONFIG: Array<{ key: TierLetter | 'null'; label: string; accent: StatChipProps['accent'] }> = [
  { key: 'A',             label: 'Tier A',   accent: 'amber' },
  { key: 'B',             label: 'Tier B',   accent: 'blue'  },
  { key: 'C',             label: 'Tier C',   accent: 'zinc'  },
  { key: 'D',             label: 'Tier D',   accent: 'red'   },
  { key: 'sin_calificar', label: 'Sin cal.', accent: 'muted' },
];

export function TierStatStrip({ counts, loading }: TierStatStripProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-0 rounded-xl border border-border bg-card overflow-hidden">
      <StatChip
        label="empresas"
        value={counts.total}
        accent="default"
        loading={loading}
      />

      {TIER_CONFIG.map(({ key, label, accent }) => (
        <div key={key} className="flex items-stretch">
          <div className="w-px bg-border/50 self-stretch" aria-hidden />
          <StatChip
            label={label}
            value={counts.por_tier[key] ?? 0}
            accent={accent}
            loading={loading}
          />
        </div>
      ))}

      <div className="flex items-stretch">
        <div className="w-px bg-border/50 self-stretch" aria-hidden />
        <StatChip
          label="con señal"
          value={counts.con_radar}
          accent="green"
          loading={loading}
        />
      </div>
    </div>
  );
}
