'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ProspectorEventType,
  ContactResult,
  RateLimitPayload,
} from '@/lib/prospector/stream-events';

export interface ProspectorEvent<T = unknown> {
  id:   number;
  type: ProspectorEventType;
  data: T;
  ts:   number;
}

export interface ContactCardState extends ContactResult {
  status:    'enriching' | 'ready';
  contacto_id?: number;
  saved:     boolean;
  unlocking: boolean;
  unlock_error?: string;
}

export interface ProspectorStreamState {
  status:           'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'cancelled';
  events:           ProspectorEvent[];
  contacts:         ContactCardState[];
  error?:           string;
  lastEventTs?:     number;
  totals: {
    found:    number;
    saved:    number;
    skipped:  number;
    contacts: number;
  };
  currentEmpresa?: string;
  rateLimit?: RateLimitPayload;
}

export interface SearchPayload {
  sessionId:         string;
  modo:              'auto' | 'manual';
  sublineas:         string[];
  tiers?:            string[];
  empresas:          Array<{
    empresa_id?: number;
    empresa:     string;
    pais:        string;
    dominio?:    string | null;
    sublinea?:   string | null;
    tier?:       string | null;
  }>;
  job_titles?:       string[];
  max_contactos:     number;
  reveal_phone_auto: boolean;
}

export function useProspectorStream() {
  const [state, setState] = useState<ProspectorStreamState>({
    status:   'idle',
    events:   [],
    contacts: [],
    totals:   { found: 0, saved: 0, skipped: 0, contacts: 0 },
  });

  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (payload: SearchPayload) => {
    abortRef.current?.abort();

    setState({
      status:   'connecting',
      events:   [],
      contacts: [],
      totals:   { found: 0, saved: 0, skipped: 0, contacts: 0 },
    });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/prospector/v2/search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  ac.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        setState(prev => ({ ...prev, status: 'error', error: `HTTP ${res.status}: ${text.slice(0, 200)}` }));
        return;
      }
      if (!res.body) {
        setState(prev => ({ ...prev, status: 'error', error: 'No response stream' }));
        return;
      }

      setState(prev => ({ ...prev, status: 'streaming' }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE chunks separated by blank lines.
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const ev = parseSseChunk(chunk);
          if (!ev) continue;
          applyEvent(ev, setState);
        }
      }

      // Drain buffer at EOF
      const last = parseSseChunk(buffer);
      if (last) applyEvent(last, setState);

      setState(prev => prev.status === 'streaming' ? { ...prev, status: 'done' } : prev);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(prev => ({ ...prev, status: 'cancelled' }));
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, status: 'error', error: msg }));
    }
  }, []);

  const cancel = useCallback(async (sessionId: string) => {
    try {
      await fetch('/api/prospector/v2/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      });
    } catch {/* non-fatal */}
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      status:   'idle',
      events:   [],
      contacts: [],
      totals:   { found: 0, saved: 0, skipped: 0, contacts: 0 },
    });
  }, []);

  const updateContact = useCallback((apolloId: string, patch: Partial<ContactCardState>) => {
    setState(prev => ({
      ...prev,
      contacts: prev.contacts.map(c => c.apollo_id === apolloId ? { ...c, ...patch } : c),
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return { state, start, cancel, reset, updateContact };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RawEvent { event: string; id?: number; data: unknown }

function parseSseChunk(chunk: string): RawEvent | null {
  if (!chunk.trim()) return null;
  let event = 'message';
  let id: number | undefined;
  let data: unknown = null;
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = Number.parseInt(line.slice(3).trim(), 10);
    else if (line.startsWith('data:')) {
      const body = line.slice(5).trim();
      try { data = JSON.parse(body); } catch { data = body; }
    }
  }
  return { event, id, data };
}

function applyEvent(
  ev: RawEvent,
  setState: React.Dispatch<React.SetStateAction<ProspectorStreamState>>,
) {
  setState(prev => {
    const newEvent: ProspectorEvent = {
      id:   ev.id ?? prev.events.length + 1,
      type: ev.event as ProspectorEventType,
      data: ev.data,
      ts:   Date.now(),
    };
    let next: ProspectorStreamState = {
      ...prev,
      events: [...prev.events, newEvent].slice(-300),
      lastEventTs: newEvent.ts,
    };

    switch (ev.event) {
      case 'company_started': {
        const d = ev.data as { empresa: string };
        next = { ...next, currentEmpresa: d.empresa };
        break;
      }
      case 'found': {
        const d = ev.data as { candidates: number };
        next = { ...next, totals: { ...next.totals, found: next.totals.found + d.candidates } };
        break;
      }
      case 'enriching': {
        const d = ev.data as {
          nombre: string; cargo: string; nivel: string; empresa: string; pais: string;
        };
        // Not yet a contact card — those appear on `contact`
        next = { ...next };
        void d;
        break;
      }
      case 'contact': {
        const c = ev.data as ContactResult;
        const exists = next.contacts.find(x => x.apollo_id === c.apollo_id);
        const cardState: ContactCardState = {
          ...c,
          status:    'ready',
          saved:     false,
          unlocking: false,
        };
        next = {
          ...next,
          contacts: exists
            ? next.contacts.map(x => x.apollo_id === c.apollo_id ? { ...x, ...cardState } : x)
            : [...next.contacts, cardState],
          totals: {
            ...next.totals,
            contacts: next.totals.contacts + (exists ? 0 : 1),
          },
        };
        break;
      }
      case 'saved': {
        const d = ev.data as { apollo_id: string; contacto_id: number };
        next = {
          ...next,
          contacts: next.contacts.map(c =>
            c.apollo_id === d.apollo_id
              ? { ...c, saved: true, contacto_id: d.contacto_id }
              : c,
          ),
          totals: { ...next.totals, saved: next.totals.saved + 1 },
        };
        break;
      }
      case 'skipped_duplicate': {
        next = { ...next, totals: { ...next.totals, skipped: next.totals.skipped + 1 } };
        break;
      }
      case 'rate_limit': {
        next = { ...next, rateLimit: ev.data as RateLimitPayload };
        break;
      }
      case 'session_done': {
        next = { ...next, status: 'done', currentEmpresa: undefined, rateLimit: undefined };
        break;
      }
      case 'error': {
        const d = ev.data as { message: string };
        next = { ...next, status: 'error', error: d.message };
        break;
      }
    }

    return next;
  });
}
