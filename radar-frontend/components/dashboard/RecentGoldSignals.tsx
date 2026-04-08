'use client';

import Link from 'next/link';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { ScoreBadge } from '@/components/ScoreBadge';
import { LineaBadge } from '@/components/LineaBadge';
import type { LineaNegocio } from '@/lib/types';

interface Signal {
  empresa: string;
  pais: string;
  linea: LineaNegocio | string;
  tipoSenal: string;
  scoreRadar: number;
  fuenteUrl?: string;
  fuente?: string;
}

interface RecentGoldSignalsProps {
  signals: Signal[];
  isLoading?: boolean;
}

function SignalSkeleton() {
  return (
    <div className="p-3 bg-surface-muted rounded-lg border border-border animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 bg-surface-muted rounded w-40" />
        <div className="h-5 bg-surface-muted rounded-full w-16" />
        <div className="h-5 bg-surface-muted rounded-full w-14" />
      </div>
      <div className="h-3 bg-surface-muted rounded w-3/4" />
    </div>
  );
}

export function RecentGoldSignals({ signals, isLoading }: RecentGoldSignalsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <SignalSkeleton key={i} />)}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        No hay señales ORO activas. Lanza un escaneo para detectar oportunidades.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((s, i) => (
        <div key={i} className="flex items-start justify-between p-3 bg-surface-muted rounded-lg border border-border hover:border-yellow-300 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-foreground text-sm truncate">{s.empresa}</span>
              <LineaBadge linea={s.linea} />
              <ScoreBadge score={s.scoreRadar} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{s.pais}</span>
              {s.tipoSenal && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-blue-600">{s.tipoSenal}</span>
                </>
              )}
              {s.fuenteUrl && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <a
                    href={s.fuenteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-muted-foreground hover:text-muted-foreground underline truncate max-w-32"
                  >
                    <ExternalLink size={10} />
                    {s.fuente || 'Fuente'}
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="ml-3 shrink-0 text-right">
            <div className={`text-xl font-bold ${s.scoreRadar >= 70 || s.scoreRadar >= 8 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
              {s.scoreRadar}
            </div>
          </div>
        </div>
      ))}

      <Link
        href="/results?tier=ORO"
        className="flex items-center justify-center gap-2 mt-2 text-xs text-blue-600 hover:text-blue-700 py-2 border border-dashed border-border rounded-lg hover:border-blue-400 transition-colors"
      >
        Ver todas las señales ORO
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
