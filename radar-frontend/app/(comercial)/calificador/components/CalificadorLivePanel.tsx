'use client';

/**
 * CalificadorLivePanel — render del progreso de la sesión activa.
 *
 * Consume `useCalLiveStore`. La conexión SSE vive en el store (no en el
 * componente), así que la sesión sobrevive a tab switches y navegación.
 */
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, XCircle, Star, TrendingUp,
  Archive, Brain, Globe, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DimensionStrip } from './DimensionStrip';
import { TriggerRadarModal } from './TriggerRadarModal';
import { shouldSuggestRadar, TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import { useCalLiveStore } from '@/lib/comercial/calificador/live-store';
import type { Tier } from '@/lib/comercial/calificador/types';
import type { CompanyLive } from '@/lib/comercial/calificador/live-store';

// ─── Tier visual ──────────────────────────────────────────────────────────────

const TIER_ICON: Record<Tier, typeof Star> = {
  A: Star, B: TrendingUp, C: Archive, D: XCircle,
};

const TIER_CLS: Record<Tier, string> = {
  A: 'text-amber-500',
  B: 'text-blue-500',
  C: 'text-slate-500',
  D: 'text-muted-foreground',
};

const TIER_BADGE_CLS: Record<Tier, string> = {
  A: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  B: 'bg-blue-500/15  text-blue-700  border-blue-500/30',
  C: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  D: 'bg-muted        text-muted-foreground',
};

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
  return `$${usd.toFixed(4)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalificadorLivePanel() {
  // Subscriptions selectivas para evitar re-renders innecesarios
  const sessionId = useCalLiveStore((s) => s.sessionId);
  const status    = useCalLiveStore((s) => s.status);
  const companies = useCalLiveStore((s) => s.companies);
  const totalCost = useCalLiveStore((s) => s.totalCost);
  const provider  = useCalLiveStore((s) => s.provider);
  const errorMsg  = useCalLiveStore((s) => s.errorMessage);
  const reset     = useCalLiveStore((s) => s.reset);

  const linea     = useCalLiveStore((s) => s.linea);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [radarModal, setRadarModal] = useState<{
    open: boolean; empresa: string; tier: Tier; score: number; country: string;
  }>({ open: false, empresa: '', tier: 'A', score: 0, country: '' });

  // Empty state cuando no hay sesión activa
  if (!sessionId || status === 'idle') {
    return (
      <Card className="p-8 text-center">
        <Sparkles size={32} className="mx-auto mb-3 text-muted-foreground/40" />
        <h2 className="mb-2 text-lg font-semibold">Sin calificación activa</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Inicia una calificación desde el asistente para ver el progreso aquí.
        </p>
        <Link href="/calificador/wizard">
          <Button>Ir al asistente</Button>
        </Link>
      </Card>
    );
  }

  const sessionDone = status === 'done';
  const doneCount   = companies.filter((c) => c.status === 'done').length;
  const errorCount  = companies.filter((c) => c.status === 'error').length;

  function toggleExpand(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {!sessionDone && status !== 'error' && (
            <Loader2 size={14} className="animate-spin text-primary" />
          )}
          {sessionDone && <CheckCircle2 size={14} className="text-green-500" />}
          {status === 'error' && <XCircle size={14} className="text-destructive" />}
          <span className="font-medium">
            {sessionDone ? 'Sesión completa' : status === 'error' ? 'Error en sesión' : 'Calificando…'}
          </span>
          <span className="text-muted-foreground">
            {doneCount}/{companies.length} empresas
            {errorCount > 0 && <span className="ml-1 text-destructive">· {errorCount} error{errorCount !== 1 ? 'es' : ''}</span>}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalCost > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatCost(totalCost)} USD
            </span>
          )}
          {provider && (
            <Badge variant="outline" className="h-5 gap-1 text-[10px]">
              {provider === 'claude' && <Brain size={10} />}
              {provider === 'openai' && <Sparkles size={10} />}
              {provider === 'gemini' && <Globe size={10} />}
              {provider}
            </Badge>
          )}
          {sessionDone && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </p>
      )}

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${companies.length > 0 ? (doneCount / companies.length) * 100 : 0}%` }}
        />
      </div>

      {/* Company cards */}
      <div className="space-y-3">
        {companies.map((c) => (
          <CompanyCard
            key={c.name}
            company={c}
            expanded={!!expanded[c.name]}
            onToggle={() => toggleExpand(c.name)}
            onSuggestRadar={(tier, score) => {
              if (!shouldSuggestRadar(tier)) return;
              setRadarModal({ open: true, empresa: c.name, tier, score, country: c.country });
            }}
          />
        ))}
      </div>

      {sessionDone && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
          <span className="text-emerald-700">
            {doneCount} empresa{doneCount !== 1 ? 's' : ''} calificada{doneCount !== 1 ? 's' : ''} · costo total {formatCost(totalCost)}
          </span>
          <Link href="/calificador?tab=historico">
            <Button variant="outline" size="sm">Ver historial</Button>
          </Link>
        </div>
      )}

      <TriggerRadarModal
        open={radarModal.open}
        onClose={() => setRadarModal((m) => ({ ...m, open: false }))}
        empresa={radarModal.empresa}
        country={radarModal.country}
        tier={radarModal.tier}
        scoreTotal={radarModal.score}
        linea={linea ?? ''}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface CompanyCardProps {
  company:  CompanyLive;
  expanded: boolean;
  onToggle: () => void;
  onSuggestRadar: (tier: Tier, score: number) => void;
}

function CompanyCard({ company: c, expanded, onToggle, onSuggestRadar }: CompanyCardProps) {
  const TierIcon = c.tier ? TIER_ICON[c.tier] : null;

  // Auto-suggest radar at tier_assigned (one-shot)
  if (c.tier && c.scoreTotal !== undefined && shouldSuggestRadar(c.tier)) {
    // El modal está controlado en el panel padre; aquí solo notificamos.
    // (Se invoca solo cuando tier+scoreTotal aparecen; el padre evita duplicados.)
  }

  return (
    <Card className={cn(
      'overflow-hidden transition-all',
      c.status === 'running' && 'border-primary/40 shadow-sm shadow-primary/10',
      c.status === 'done'    && 'border-border',
      c.status === 'error'   && 'border-destructive/40',
    )}>
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="shrink-0">
          {c.status === 'pending' && <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
          {c.status === 'running' && <Loader2 size={14} className="animate-spin text-primary" />}
          {c.status === 'done'    && (
            c.tier && TierIcon
              ? <TierIcon size={14} className={TIER_CLS[c.tier]} />
              : <CheckCircle2 size={14} className="text-green-500" />
          )}
          {c.status === 'error'   && <XCircle size={14} className="text-destructive" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{c.name}</p>
          <p className="text-[11px] text-muted-foreground">{c.country}</p>
        </div>

        {c.tier && c.scoreTotal !== undefined && (
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('font-mono text-sm font-bold', TIER_CLS[c.tier])}>
              {c.scoreTotal.toFixed(1)}
            </span>
            <Badge
              variant="outline"
              className={cn('h-5 border text-[10px]', TIER_BADGE_CLS[c.tier])}
            >
              {TIER_LABEL[c.tier]}
            </Badge>
          </div>
        )}

        {c.status === 'running' && Object.keys(c.scores).length > 0 && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {Object.keys(c.scores).length}/8
          </span>
        )}

        {expanded ? (
          <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-4">
          {c.thinking.length > 0 && c.status === 'running' && (
            <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
              {c.thinking[c.thinking.length - 1]}
            </div>
          )}

          {Object.keys(c.scores).length > 0 && (
            <DimensionStrip scores={c.scores} dimensiones={c.dimensiones} animate />
          )}

          {c.razonamientoPreview && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Razonamiento</p>
              <p className="line-clamp-3">{c.razonamientoPreview}</p>
            </div>
          )}

          {c.error && <p className="text-xs text-destructive">{c.error}</p>}

          {c.costUsd !== undefined && (
            <p className="text-right text-[11px] text-muted-foreground">
              {formatCost(c.costUsd)} USD
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
