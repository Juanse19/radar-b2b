'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { EventCard } from './EventCard';
import type {
  StreamEvent,
  StreamEventType,
  SessionDonePayload,
} from '@/lib/radar-v2/stream-events';

const EVENT_LIMIT = 100;

interface Props {
  sessionId: string;
  empresas:  Array<{ id?: number; name: string; country: string }>;
  line:      string;
  provider?: string;
}

type Phase = 'connecting' | 'live' | 'done' | 'error';

export function LiveTimeline({ sessionId, empresas, line, provider }: Props) {
  const [events, setEvents]         = useState<StreamEvent[]>([]);
  const [phase,  setPhase]          = useState<Phase>('connecting');
  const [summary, setSummary]       = useState<SessionDonePayload | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [now, setNow]               = useState<number>(() => Date.now());
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Tick for relative timestamps ("hace 2s")
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Open EventSource. Deps are strings only so the effect doesn't loop on
  // parent re-renders that hand us new array identities.
  const empresasJson = JSON.stringify(empresas);
  useEffect(() => {
    if (!sessionId || !line || empresas.length === 0) return;

    const params = new URLSearchParams({
      sessionId,
      line,
      empresas: empresasJson,
    });
    if (provider) params.set('provider', provider);

    const es = new EventSource(`/api/radar-v2/stream?${params.toString()}`);

    const handlers: Partial<Record<StreamEventType, (ev: MessageEvent) => void>> = {
      session_done: (ev) => {
        try {
          const payload = JSON.parse(ev.data) as SessionDonePayload;
          setSummary(payload);
        } catch { /* ignore */ }
        setPhase('done');
        es.close();
      },
      error: (ev) => {
        try {
          const payload = JSON.parse(ev.data) as { message: string };
          setErrorMsg(payload.message);
        } catch { /* ignore */ }
      },
    };

    const pushEvent = (ev: MessageEvent, type: StreamEventType) => {
      if (phase === 'connecting') setPhase('live');
      let data: unknown;
      try { data = JSON.parse(ev.data); } catch { data = ev.data; }
      const rec: StreamEvent = {
        id:   Number.parseInt(ev.lastEventId || '0', 10) || 0,
        type,
        data,
        ts:   Date.now(),
      };
      setEvents(prev => {
        const next = [...prev, rec];
        if (next.length > EVENT_LIMIT) next.splice(0, next.length - EVENT_LIMIT);
        return next;
      });
    };

    const types: StreamEventType[] = [
      'scan_started', 'thinking', 'search_query', 'reading_source',
      'criteria_eval', 'signal_detected', 'signal_discarded', 'token_tick',
      'company_done', 'company_error', 'session_done', 'error',
    ];
    const listeners: Array<[string, (ev: MessageEvent) => void]> = [];

    for (const t of types) {
      const fn = (ev: MessageEvent) => {
        handlers[t]?.(ev);
        pushEvent(ev, t);
      };
      es.addEventListener(t, fn as EventListener);
      listeners.push([t, fn]);
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setPhase(prev => (prev === 'done' ? 'done' : 'error'));
      }
    };

    return () => {
      for (const [t, fn] of listeners) es.removeEventListener(t, fn as EventListener);
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, line, empresasJson, provider]);

  // Auto-scroll to bottom, but only if user hasn't scrolled away manually.
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  if (phase === 'connecting' && events.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} />
          Conectando al stream…
        </div>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          {phase === 'live' && <Loader2 size={14} className="animate-spin text-primary" />}
          <span className="text-sm font-medium">
            {phase === 'live'  && `Escaneando ${empresas.length} empresa${empresas.length === 1 ? '' : 's'}`}
            {phase === 'done'  && 'Escaneo finalizado'}
            {phase === 'error' && 'Error de conexión'}
            {phase === 'connecting' && 'Conectando…'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{line}</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[60vh] min-h-[360px] space-y-1.5 overflow-y-auto px-4 py-3"
      >
        {events.map((e, idx) => (
          <EventCard key={`${e.id}-${idx}`} event={e} now={now} />
        ))}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && phase === 'live' && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
          className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown size={14} /> Ir a eventos recientes
        </button>
      )}

      {(phase === 'done' || phase === 'error') && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {summary && (
              <>
                {summary.activas_count} activas · {summary.descartadas_count} descartadas
                {summary.errors_count > 0 && ` · ${summary.errors_count} errores`}
                {' · '}${summary.total_cost_usd.toFixed(4)}
              </>
            )}
            {errorMsg && <span className="text-destructive">{errorMsg}</span>}
          </div>
          <Link href="/radar-v2/resultados">
            <Button size="sm">Ver resultados</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
