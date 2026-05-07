'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radar, Loader2, Star, TrendingUp, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/comercial/calificador/types';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';

const TIER_STYLE: Record<Tier, { icon: typeof Star; cls: string; badgeCls: string }> = {
  'A':      { icon: Star,       cls: 'text-amber-500',       badgeCls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  'B-Alta': { icon: TrendingUp, cls: 'text-blue-600',        badgeCls: 'bg-blue-500/20  text-blue-800  border-blue-500/40'  },
  'B-Baja': { icon: TrendingUp, cls: 'text-blue-400',        badgeCls: 'bg-blue-500/10  text-blue-600  border-blue-500/25'  },
  'C':      { icon: Archive,    cls: 'text-slate-500',       badgeCls: 'bg-slate-500/15 text-slate-700 border-slate-500/30' },
  'D':      { icon: Archive,    cls: 'text-muted-foreground',badgeCls: '' },
};

interface Props {
  open:        boolean;
  empresa:     string;
  tier:        Tier;
  scoreTotal:  number;
  linea:       string;
  country:     string;
  onClose:     () => void;
}

export function TriggerRadarModal({ open, empresa, tier, scoreTotal, linea, country, onClose }: Props) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const style  = TIER_STYLE[tier];
  const Icon   = style.icon;
  const label  = TIER_LABEL[tier];

  async function handleDispatch() {
    setError(null);
    setLoading(true);

    try {
      const sessionId  = crypto.randomUUID();
      const empresas   = [{ name: empresa, country }];
      const qs = new URLSearchParams({
        sessionId,
        line:     linea,
        empresas: JSON.stringify(empresas),
        provider: 'claude',
      });
      router.push(`/en-vivo?${qs.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar Radar');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar size={18} className="text-primary" />
            ¿Activar Radar de Inversión?
          </DialogTitle>
          <DialogDescription>
            La empresa fue calificada. ¿Deseas buscar señales de inversión activas?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Company summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{empresa}</p>
                <p className="text-sm text-muted-foreground">{country} · {linea}</p>
              </div>
              <Badge variant="outline" className={cn('shrink-0 border', style.badgeCls)}>
                <Icon size={11} className={cn('mr-1', style.cls)} />
                {label}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Score:</span>
              <span className={cn('font-mono font-bold', style.cls)}>
                {scoreTotal.toFixed(1)} / 10
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            El Radar buscará señales CAPEX, licitaciones y proyectos de inversión recientes
            para esta empresa en LATAM.
          </p>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Omitir
          </Button>
          <Button onClick={handleDispatch} disabled={loading} className="gap-2">
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Iniciando…</>
            ) : (
              <><Radar size={14} /> Activar Radar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
