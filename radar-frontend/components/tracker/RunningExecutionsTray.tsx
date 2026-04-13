// components/tracker/RunningExecutionsTray.tsx
//
// Global floating tray that surfaces all in-flight (and recently finished)
// agent runs. Mounted ONCE in <AppShell /> so it stays visible no matter
// which page the user is on.
//
// Visual states:
//   - Hidden completely when there are no inflight pipelines AND no recent
//     ones (recent = finished within the last 10 minutes).
//   - Collapsed pill at fixed bottom-4 right-4: shows a pulse icon + count.
//     Color matches dominant status (running=blue, success=green, error=red).
//   - Expanded popover (Base UI Popover): scrollable panel with one
//     <AgentPipelineCardEmbedded /> per agent grouped by pipeline_id.

'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Radar, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useInflightExecutions } from '@/hooks/useInflightExecutions';
import { AgentPipelineCardEmbedded } from './AgentPipelineCard';

function pluralAgentes(n: number) {
  return n === 1 ? '1 agente corriendo' : `${n} agentes corriendo`;
}

export function RunningExecutionsTray() {
  const { inflight, recent, anyRunning, invalidate } = useInflightExecutions();
  const [clearing, setClearing] = useState(false);

  async function handleClearAll() {
    setClearing(true);
    try {
      const res = await fetch('/api/executions/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanMinutes: 0 }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      invalidate();
      toast.success('Ejecuciones limpiadas');
    } catch {
      toast.error('Error al limpiar las ejecuciones');
    } finally {
      setClearing(false);
    }
  }

  // Hidden completely when there's nothing to show.
  if (inflight.length === 0 && recent.length === 0) return null;

  const inflightAgentCount = inflight.reduce((sum, p) => sum + p.agents.length, 0);
  const dominantPillColor = anyRunning
    ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
    : recent.some(p => p.status === 'error')
      ? 'bg-red-600 text-white border-red-500 hover:bg-red-700'
      : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700';

  return (
    <Popover.Root>
      <Popover.Trigger
        data-testid="tray-pill"
        className={cn(
          'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-blue-500',
          dominantPillColor,
        )}
        aria-label={anyRunning ? pluralAgentes(inflightAgentCount) : 'Ver ejecuciones recientes'}
      >
        <Radar size={16} className={anyRunning ? 'animate-pulse' : ''} />
        <span>
          {anyRunning
            ? pluralAgentes(inflightAgentCount)
            : `${recent.length} ${recent.length === 1 ? 'ejecución reciente' : 'ejecuciones recientes'}`}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={8}>
          <Popover.Popup
            className={cn(
              'z-50 w-[360px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto',
              'rounded-2xl border border-border bg-card shadow-2xl',
              'p-3 space-y-3',
              'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
              'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
              'transition-[opacity,transform] duration-150 ease-out origin-bottom-right',
            )}
          >
            <header className="flex items-center justify-between">
              <Popover.Title className="font-heading text-sm font-semibold text-foreground">
                Ejecuciones de agentes
              </Popover.Title>
              <div className="flex items-center gap-1">
                {inflight.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-amber-500 border border-amber-700/40 hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                  >
                    {clearing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                    {clearing ? '…' : 'Limpiar'}
                  </button>
                )}
                <Popover.Close
                  aria-label="Cerrar"
                  className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  <X size={14} />
                </Popover.Close>
              </div>
            </header>

            {/* In-flight section */}
            {inflight.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  En curso ({inflight.length})
                </h3>
                <div className="space-y-2">
                  {inflight.flatMap(pipeline =>
                    pipeline.agents.map(agent => (
                      <AgentPipelineCardEmbedded
                        key={`${pipeline.pipeline_id}-${agent.id}`}
                        agent={agent}
                      />
                    )),
                  )}
                </div>
              </section>
            )}

            {/* Recent (finished) section */}
            {recent.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Recientes ({recent.length})
                </h3>
                <div className="space-y-2">
                  {recent.flatMap(pipeline =>
                    pipeline.agents.map(agent => (
                      <AgentPipelineCardEmbedded
                        key={`${pipeline.pipeline_id}-${agent.id}`}
                        agent={agent}
                      />
                    )),
                  )}
                </div>
              </section>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
