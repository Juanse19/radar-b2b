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
    <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 bg-gray-700 rounded w-40" />
        <div className="h-5 bg-gray-700 rounded-full w-16" />
        <div className="h-5 bg-gray-700 rounded-full w-14" />
      </div>
      <div className="h-3 bg-gray-700 rounded w-3/4" />
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
      <p className="text-gray-500 text-sm text-center py-8">
        No hay señales ORO activas. Lanza un escaneo para detectar oportunidades.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((s, i) => (
        <div key={i} className="flex items-start justify-between p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-yellow-800/50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-white text-sm truncate">{s.empresa}</span>
              <LineaBadge linea={s.linea} />
              <ScoreBadge score={s.scoreRadar} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{s.pais}</span>
              {s.tipoSenal && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-blue-400">{s.tipoSenal}</span>
                </>
              )}
              {s.fuenteUrl && (
                <>
                  <span className="text-gray-600">·</span>
                  <a
                    href={s.fuenteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-300 underline truncate max-w-32"
                  >
                    <ExternalLink size={10} />
                    {s.fuente || 'Fuente'}
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="ml-3 shrink-0 text-right">
            <div className={`text-xl font-bold ${s.scoreRadar >= 70 || s.scoreRadar >= 8 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {s.scoreRadar}
            </div>
          </div>
        </div>
      ))}

      <Link
        href="/results?tier=ORO"
        className="flex items-center justify-center gap-2 mt-2 text-xs text-blue-400 hover:text-blue-300 py-2 border border-dashed border-gray-700 rounded-lg hover:border-blue-800 transition-colors"
      >
        Ver todas las señales ORO
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
