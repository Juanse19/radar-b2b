'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, XCircle, Star, TrendingUp,
  Archive, Brain, Globe, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DimensionStrip, type DimDetailUI } from './DimensionStrip';
import { TriggerRadarModal } from './TriggerRadarModal';
import { shouldSuggestRadar, TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import type { Dimension, Tier, DimScores } from '@/lib/comercial/calificador/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmpresaInput {
  id?:     number;
  name:    string;
  country: string;
}

interface CompanyState {
  name:        string;
  country:     string;
  status:      'pending' | 'running' | 'done' | 'error';
  scores:      Partial<DimScores>;
  /** V2 categorical detail per dimension (valor + justificacion). */
  dimensiones: Partial<Record<Dimension, DimDetailUI>>;
  scoreTotal?: number;
  tier?:       Tier;
  razonamientoPreview?: string;
  thinking:    string[];
  error?:      string;
  expanded:    boolean;
  costUsd?:    number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  sessionId:  string;
  linea:      string;
  empresas:   EmpresaInput[];
  subLineaId?: number;
  provider:   string;
  ragEnabled: boolean;
  model?:     string;
}

export function CalificadorLivePanel({
  sessionId, linea, empresas, subLineaId, provider, ragEnabled, model,
}: Props) {
  const [companies, setCompanies] = useState<CompanyState[]>(
    empresas.map(e => ({
      name: e.name, country: e.country, status: 'pending',
      scores: {}, dimensiones: {}, thinking: [], expanded: false,
    })),
  );
  const [totalCost, setTotalCost]       = useState(0);
  const [sessionDone, setSessionDone]   = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [radarModal, setRadarModal]     = useState<{
    open: boolean; empresa: string; tier: Tier; score: number; country: string;
  }>({ open: false, empresa: '', tier: 'A', score: 0, country: '' });

  const esRef     = useRef<EventSource | null>(null);
  const shownModal = useRef(new Set<string>());

  useEffect(() => {
    const qs = new URLSearchParams({
      sessionId,
      linea,
      empresas:   JSON.stringify(empresas),
      provider,
      rag:        String(ragEnabled),
    });
    if (subLineaId) qs.set('subLineaId', String(subLineaId));
    if (model)      qs.set('model', model);

    const es = new EventSource(`/api/comercial/calificar?${qs}`);
    esRef.current = es;

    function updateCompany(name: string, updater: (c: CompanyState) => Partial<CompanyState>) {
      setCompanies(prev =>
        prev.map(c => c.name === name ? { ...c, ...updater(c) } : c),
      );
    }

    es.addEventListener('empresa_started', (e) => {
      const d = JSON.parse(e.data) as { empresa: string };
      updateCompany(d.empresa, () => ({ status: 'running' }));
    });

    es.addEventListener('thinking', (e) => {
      const d = JSON.parse(e.data) as { empresa: string; chunk: string };
      updateCompany(d.empresa, (c) => ({ thinking: [...c.thinking.slice(-4), d.chunk] }));
    });

    es.addEventListener('profiling_web', (e) => {
      const d = JSON.parse(e.data) as { empresa: string };
      updateCompany(d.empresa, () => ({})); // marks activity
    });

    es.addEventListener('dim_scored', (e) => {
      const d = JSON.parse(e.data) as {
        empresa: string;
        dim:     Dimension;
        value:   number;
        valor?:  string;
        justificacion?: string;
      };
      updateCompany(d.empresa, (c) => ({
        scores:      { ...c.scores, [d.dim]: d.value },
        dimensiones: d.valor
          ? { ...c.dimensiones, [d.dim]: { valor: d.valor, justificacion: d.justificacion } }
          : c.dimensiones,
      }));
    });

    es.addEventListener('tier_assigned', (e) => {
      const d = JSON.parse(e.data) as {
        empresa: string; tier: Tier; scoreTotal: number; razonamientoPreview: string;
      };
      updateCompany(d.empresa, () => ({
        tier:  d.tier,
        scoreTotal: d.scoreTotal,
        razonamientoPreview: d.razonamientoPreview,
      }));

      // Auto-open modal for companies that suggest Radar (once per empresa)
      if (shouldSuggestRadar(d.tier) && !shownModal.current.has(d.empresa)) {
        shownModal.current.add(d.empresa);
        const emp = empresas.find(e => e.name === d.empresa);
        setRadarModal({
          open:    true,
          empresa: d.empresa,
          tier:    d.tier,
          score:   d.scoreTotal,
          country: emp?.country ?? '',
        });
      }
    });

    es.addEventListener('empresa_done', (e) => {
      const d = JSON.parse(e.data) as { empresa: string; costUsd: number };
      updateCompany(d.empresa, () => ({ status: 'done', costUsd: d.costUsd }));
      setTotalCost(prev => prev + (d.costUsd ?? 0));
    });

    es.addEventListener('company_error', (e) => {
      const d = JSON.parse(e.data) as { empresa: string; error: string };
      updateCompany(d.empresa, () => ({ status: 'error', error: d.error }));
    });

    es.addEventListener('session_done', () => {
      setSessionDone(true);
      es.close();
    });

    es.addEventListener('error', (e) => {
      const d = JSON.parse((e as MessageEvent).data ?? '{}') as { message?: string };
      setSessionError(d.message ?? 'Error en la sesión');
      es.close();
    });

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const doneCount = companies.filter(c => c.status === 'done').length;
  const errorCount = companies.filter(c => c.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {!sessionDone && !sessionError && (
            <Loader2 size={14} className="animate-spin text-primary" />
          )}
          {sessionDone && <CheckCircle2 size={14} className="text-green-500" />}
          {sessionError && <XCircle size={14} className="text-destructive" />}
          <span className="font-medium">
            {sessionDone ? 'Sesión completa' : sessionError ? 'Error en sesión' : 'Calificando…'}
          </span>
          <span className="text-muted-foreground">
            {doneCount}/{companies.length} empresas
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Cost ticker */}
          {totalCost > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatCost(totalCost)} USD
            </span>
          )}
          {/* Provider badge */}
          <Badge variant="outline" className="h-5 gap-1 text-[10px]">
            {provider === 'claude' && <Brain size={10} />}
            {provider === 'openai' && <Sparkles size={10} />}
            {provider === 'gemini' && <Globe size={10} />}
            {provider}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${companies.length > 0 ? (doneCount / companies.length) * 100 : 0}%` }}
        />
      </div>

      {/* Company cards */}
      <div className="space-y-3">
        {companies.map((c) => {
          const TierIcon = c.tier ? TIER_ICON[c.tier] : null;

          return (
            <Card key={c.name} className={cn(
              'overflow-hidden transition-all',
              c.status === 'running' && 'border-primary/40 shadow-sm shadow-primary/10',
              c.status === 'done'    && 'border-border',
              c.status === 'error'   && 'border-destructive/40',
            )}>
              {/* Card header row */}
              <div
                className="flex cursor-pointer items-center gap-3 px-4 py-3"
                onClick={() => setCompanies(prev =>
                  prev.map(x => x.name === c.name ? { ...x, expanded: !x.expanded } : x),
                )}
                role="button"
                tabIndex={0}
                aria-expanded={c.expanded}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCompanies(prev =>
                      prev.map(x => x.name === c.name ? { ...x, expanded: !x.expanded } : x),
                    );
                  }
                }}
              >
                {/* Status icon */}
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

                {/* Name + country */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.country}</p>
                </div>

                {/* Tier + score */}
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

                {c.expanded ? (
                  <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                )}
              </div>

              {/* Expanded content */}
              {c.expanded && (
                <div className="border-t border-border/50 px-4 py-3 space-y-4">
                  {/* Thinking stream */}
                  {c.thinking.length > 0 && c.status === 'running' && (
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                      {c.thinking[c.thinking.length - 1]}
                    </div>
                  )}

                  {/* Dimension bars */}
                  {Object.keys(c.scores).length > 0 && (
                    <DimensionStrip scores={c.scores} dimensiones={c.dimensiones} animate />
                  )}

                  {/* Razonamiento preview */}
                  {c.razonamientoPreview && (
                    <div className="text-xs text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">Razonamiento</p>
                      <p className="line-clamp-3">{c.razonamientoPreview}</p>
                    </div>
                  )}

                  {/* Error */}
                  {c.error && (
                    <p className="text-xs text-destructive">{c.error}</p>
                  )}

                  {/* Cost */}
                  {c.costUsd !== undefined && (
                    <p className="text-right text-[11px] text-muted-foreground">
                      {formatCost(c.costUsd)} USD
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Session error */}
      {sessionError && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          {sessionError}
        </Card>
      )}

      {/* Done CTA */}
      {sessionDone && (
        <div className="flex flex-wrap gap-3">
          <Link href="/calificador/cuentas">
            <Button variant="outline" size="sm">Ver historial</Button>
          </Link>
          <Link href="/calificador/wizard">
            <Button size="sm">Nueva calificación</Button>
          </Link>
        </div>
      )}

      {/* Trigger Radar modal */}
      <TriggerRadarModal
        open={radarModal.open}
        empresa={radarModal.empresa}
        tier={radarModal.tier}
        scoreTotal={radarModal.score}
        linea={linea}
        country={radarModal.country}
        onClose={() => setRadarModal(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
