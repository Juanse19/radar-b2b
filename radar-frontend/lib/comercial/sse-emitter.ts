/**
 * sse-emitter.ts — Factory for SSE emitters (Fase G).
 *
 * Wraps a WritableStreamDefaultWriter<Uint8Array> and exposes `emit(event, data)`
 * that serializes to the SSE wire format:
 *
 *   event: <name>
 *   data: <json>
 *   id: <seq>
 *   <blank line>
 *
 * Also maintains an in-memory ring buffer keyed by sessionId so that a browser
 * reconnecting with `Last-Event-ID` can resume from where it left off. Events
 * are ephemeral — nothing is persisted to disk or DB.
 */
import 'server-only';
import type { SSEEmitter } from './providers/types';
import type { StreamEvent, StreamEventType } from './stream-events';

const BUFFER_LIMIT = 200;
const BUFFER_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface SessionBuffer {
  events:   StreamEvent[];
  nextId:   number;
  lastSeen: number;
}

const sessionBuffers = new Map<string, SessionBuffer>();

function gcBuffers() {
  const now = Date.now();
  for (const [key, buf] of sessionBuffers) {
    if (now - buf.lastSeen > BUFFER_TTL_MS) sessionBuffers.delete(key);
  }
}

function getBuffer(sessionId: string): SessionBuffer {
  let buf = sessionBuffers.get(sessionId);
  if (!buf) {
    buf = { events: [], nextId: 1, lastSeen: Date.now() };
    sessionBuffers.set(sessionId, buf);
  }
  buf.lastSeen = Date.now();
  return buf;
}

/**
 * Return buffered events with `id > lastEventId` so a reconnecting client
 * can resume. Returns `null` if the session is unknown (client should
 * treat this as a fresh stream).
 */
export function getReplayEvents(
  sessionId: string,
  lastEventId: number,
): StreamEvent[] | null {
  gcBuffers();
  const buf = sessionBuffers.get(sessionId);
  if (!buf) return null;
  return buf.events.filter(e => e.id > lastEventId);
}

export interface EmitterHandle extends SSEEmitter {
  /** Close the underlying writer. Safe to call multiple times. */
  close(): Promise<void>;
  /** Whether the writer is still open. */
  readonly closed: boolean;
}

/**
 * Build an SSEEmitter bound to a WritableStreamDefaultWriter. Events are
 * written to the wire AND pushed into the session ring buffer so later
 * reconnects can replay them.
 */
export function createSSEEmitter(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  sessionId: string,
): EmitterHandle {
  const encoder = new TextEncoder();
  const buf = getBuffer(sessionId);
  let closed = false;

  const serialize = (event: StreamEvent): string =>
    `event: ${event.type}\n` +
    `id: ${event.id}\n` +
    `data: ${JSON.stringify(event.data)}\n\n`;

  const writeRaw = async (chunk: string) => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      closed = true;
    }
  };

  return {
    emit(event: string, data: unknown) {
      if (closed) return;
      const ev: StreamEvent = {
        id:   buf.nextId++,
        type: event as StreamEventType,
        data,
        ts:   Date.now(),
      };
      buf.events.push(ev);
      if (buf.events.length > BUFFER_LIMIT) {
        buf.events.splice(0, buf.events.length - BUFFER_LIMIT);
      }
      // Fire-and-forget — SSE is unidirectional; we don't block provider logic.
      void writeRaw(serialize(ev));
    },

    async close() {
      if (closed) return;
      closed = true;
      try { await writer.close(); } catch { /* already closed */ }
    },

    get closed() {
      return closed;
    },
  };
}

/**
 * Write pre-existing buffered events (replay) directly to a writer.
 * Used by the SSE route to flush Last-Event-ID replay before live stream starts.
 */
export async function replayBuffered(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  events: StreamEvent[],
): Promise<void> {
  const encoder = new TextEncoder();
  for (const ev of events) {
    const chunk =
      `event: ${ev.type}\n` +
      `id: ${ev.id}\n` +
      `data: ${JSON.stringify(ev.data)}\n\n`;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      return;
    }
  }
}

/**
 * Write an SSE heartbeat comment. Keeps idle connections alive through proxies.
 */
export async function writeHeartbeat(
  writer: WritableStreamDefaultWriter<Uint8Array>,
): Promise<boolean> {
  const encoder = new TextEncoder();
  try {
    await writer.write(encoder.encode(': heartbeat\n\n'));
    return true;
  } catch {
    return false;
  }
}
