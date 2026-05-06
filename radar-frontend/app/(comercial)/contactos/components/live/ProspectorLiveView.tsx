'use client';

import { useMemo } from 'react';
import { Loader2, X, RotateCcw, ArrowLeft, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContactCardLive } from './ContactCardLive';
import { ProspectorTimeline } from './ProspectorTimeline';
import type { ProspectorStreamState } from './useProspectorStream';

interface Props {
  sessionId: string;
  state:     ProspectorStreamState;
  onCancel:  () => void;
  onReset:   () => void;
  onBack:    () => void;
  onPhoneUnlocked: (apolloId: string, telMovil: string) => void;
}

const ACCENT      = 'var(--agent-contactos)';
const ACCENT_TINT = 'var(--agent-contactos-tint)';

export function ProspectorLiveView({ sessionId, state, onCancel, onReset, onBack, onPhoneUnlocked }: Props) {
  const isStreaming = state.status === 'streaming' || state.status === 'connecting';
  const isDone      = state.status === 'done';
  const isError     = state.status === 'error';
  const isCancelled = state.status === 'cancelled';

  const principales = useMemo(
    () => state.contacts.filter(c => c.es_principal),
    [state.contacts],
  );
  const otros = useMemo(
    () => state.contacts.filter(c => !c.es_principal),
    [state.contacts],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {(isDone || isError || isCancelled) && (
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft size={14} className="mr-1" />
              Volver al wizard
            </Button>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Sesión <span className="font-mono">{sessionId.slice(0, 8)}</span>
            </p>
            <p className="text-sm font-medium">
              {isStreaming && (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" />
                  {state.currentEmpresa
                    ? `Procesando ${state.currentEmpresa}…`
                    : 'Buscando…'}
                </span>
              )}
              {isDone && <span style={{ color: ACCENT }}>Búsqueda completa</span>}
              {isError && <span className="text-destructive">Error</span>}
              {isCancelled && <span className="text-amber-700">Cancelada</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              <X size={14} className="mr-1" />
              Detener
            </Button>
          )}
          {(isDone || isError || isCancelled) && (
            <Button type="button" size="sm" onClick={onReset} style={{ background: ACCENT, color: '#fff' }}>
              <RotateCcw size={14} className="mr-1" />
              Nueva búsqueda
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Encontrados" value={state.totals.found} />
        <Stat label="Contactos" value={state.totals.contacts} highlight />
        <Stat label="Guardados" value={state.totals.saved} />
        <Stat label="Saltados (dup)" value={state.totals.skipped} />
      </div>

      {/* Rate limit notice */}
      {state.rateLimit && isStreaming && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm flex items-center gap-2">
          <AlertCircle size={14} className="text-amber-700" />
          <span className="text-amber-900">
            Apollo rate limit · esperando {Math.round((state.rateLimit.retry_in_ms ?? 0) / 1000)}s (intento {state.rateLimit.attempt})
          </span>
        </div>
      )}

      {/* Error */}
      {isError && state.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Cards + timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {state.contacts.length === 0 ? (
            <Card className="p-8 text-center" style={{ borderColor: ACCENT, background: ACCENT_TINT }}>
              {isStreaming ? (
                <>
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: ACCENT }} />
                  <p className="text-sm font-medium" style={{ color: ACCENT }}>
                    Esperando primer contacto…
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apollo Search → Enrich → tarjeta aparecerá aquí
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sin contactos esta sesión.
                  </p>
                </>
              )}
            </Card>
          ) : (
            <>
              {principales.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Contactos principales ({principales.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {principales.map(c => (
                      <ContactCardLive
                        key={c.apollo_id}
                        contact={c}
                        onUnlocked={onPhoneUnlocked}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otros.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Otros contactos ({otros.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {otros.map(c => (
                      <ContactCardLive
                        key={c.apollo_id}
                        contact={c}
                        onUnlocked={onPhoneUnlocked}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actividad
            </h3>
            <ProspectorTimeline events={state.events} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className="text-2xl font-semibold leading-tight tabular-nums"
        style={highlight ? { color: ACCENT } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
