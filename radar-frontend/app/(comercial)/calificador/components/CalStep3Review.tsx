'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Brain, Zap, Play, Loader2 } from 'lucide-react';
import type { CalWizardState } from '@/lib/comercial/calificador-wizard-state';
import type { ComercialCompany } from '@/lib/comercial/types';

const PROVIDERS = [
  {
    value:   'claude',
    label:   'Claude',
    sub:     'Anthropic · Mejor razonamiento',
    icon:    Brain,
    badge:   'Recomendado',
    badgeCls: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  },
  {
    value:   'openai',
    label:   'GPT-4o',
    sub:     'OpenAI · Alta precisión',
    icon:    Sparkles,
    badge:   null,
    badgeCls: '',
  },
  {
    value:   'gemini',
    label:   'Gemini',
    sub:     'Google · Búsqueda integrada',
    icon:    Zap,
    badge:   null,
    badgeCls: '',
  },
];

interface Props {
  state:    CalWizardState;
  onChange: (updates: Partial<CalWizardState>) => void;
}

export function CalStep3Review({ state, onChange }: Props) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleLaunch() {
    setError(null);
    setLoading(true);

    try {
      const sessionId = crypto.randomUUID();

      // Fetch companies to build the empresas list
      let empresas: Array<{ id?: number; name: string; country: string }> = [];

      if (state.mode === 'manual' && state.selectedIds.length > 0) {
        const params = new URLSearchParams({ linea: state.linea, limit: '200' });
        const res = await fetch(`/api/comercial/companies?${params}`);
        if (res.ok) {
          const all: ComercialCompany[] = await res.json() as ComercialCompany[];
          empresas = all
            .filter(c => state.selectedIds.includes(c.id))
            .map(c => ({ id: c.id, name: c.name, country: c.country }));
        }
      } else {
        // Auto mode: fetch top N companies for the line
        const params = new URLSearchParams({
          linea: state.linea,
          limit: String(state.count),
        });
        const res = await fetch(`/api/comercial/companies?${params}`);
        if (res.ok) {
          const all: ComercialCompany[] = await res.json() as ComercialCompany[];
          empresas = all.slice(0, state.count).map(c => ({
            id:      c.id,
            name:    c.name,
            country: c.country,
          }));
        }
      }

      if (empresas.length === 0) {
        setError('No se encontraron empresas para los criterios seleccionados.');
        setLoading(false);
        return;
      }

      // Navigate to live panel with all params encoded in URL
      const qs = new URLSearchParams({
        sessionId,
        linea:      state.linea,
        empresas:   JSON.stringify(empresas),
        provider:   state.provider,
        rag:        String(state.ragEnabled),
      });
      if (state.subLineaId) qs.set('subLineaId', String(state.subLineaId));
      if (state.model)      qs.set('model', state.model);

      router.push(`/calificador/live?${qs.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar calificación');
      setLoading(false);
    }
  }

  const displayCount = state.mode === 'auto' ? state.count : state.selectedIds.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <h3 className="mb-2 font-semibold">Resumen</h3>
        <dl className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <dt>Línea:</dt>
            <dd className="font-medium text-foreground">{state.linea || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Empresas:</dt>
            <dd className="font-medium text-foreground">{displayCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Modo:</dt>
            <dd className="font-medium text-foreground capitalize">{state.mode}</dd>
          </div>
          <div className="flex justify-between">
            <dt>RAG:</dt>
            <dd className="font-medium text-foreground">{state.ragEnabled ? 'Activo' : 'Desactivado'}</dd>
          </div>
        </dl>
      </div>

      {/* Provider selector */}
      <div>
        <p className="mb-3 text-sm font-medium">Proveedor de IA</p>
        <div className="grid gap-2">
          {PROVIDERS.map(({ value, label, sub, icon: Icon, badge, badgeCls }) => {
            const selected = state.provider === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ provider: value })}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all',
                  selected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <Icon size={20} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium text-sm', selected && 'text-primary')}>{label}</span>
                    {badge && (
                      <Badge variant="outline" className={cn('h-4 text-[10px]', badgeCls)}>
                        {badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                {selected && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Launch button */}
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleLaunch}
        disabled={loading || !state.linea || displayCount === 0}
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Iniciando…</>
        ) : (
          <><Play size={16} /> Calificar {displayCount} empresa{displayCount !== 1 ? 's' : ''}</>
        )}
      </Button>
    </div>
  );
}
