'use client';
// Scan activity store — persists across navigation using module-level singleton.
// Uses a simple pub/sub singleton so it survives client-side route transitions.

export type ScanEventType =
  | 'scan_started'
  | 'company_start'
  | 'company_done'
  | 'company_error'
  | 'session_done'
  | 'budget_warning'
  | 'error';

export interface ScanEvent {
  type: ScanEventType;
  data: Record<string, unknown>;
  ts:   number;
}

export interface ActiveScan {
  sessionId:   string;
  line:        string;
  empresas:    string[];
  provider:    string;
  events:      ScanEvent[];
  startedAt:   number;
  status:      'running' | 'done' | 'error';
  totalCost:   number;
  activas:     number;
  descartadas: number;
}

type Listener = () => void;

class ScanActivityStore {
  private activeScan: ActiveScan | null = null;
  private history: ActiveScan[] = [];
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    this.listeners.forEach(fn => fn());
  }

  getActiveScan(): ActiveScan | null {
    return this.activeScan;
  }

  getHistory(): ActiveScan[] {
    return this.history;
  }

  startScan(
    sessionId: string,
    line: string,
    empresas: string[],
    provider = 'claude',
  ): void {
    this.activeScan = {
      sessionId,
      line,
      empresas,
      provider,
      events:      [],
      startedAt:   Date.now(),
      status:      'running',
      totalCost:   0,
      activas:     0,
      descartadas: 0,
    };
    this.notify();
  }

  addEvent(event: ScanEvent): void {
    if (!this.activeScan) return;
    this.activeScan.events.push(event);

    if (event.type === 'session_done') {
      const d = event.data as { total_cost_usd?: number; activas_count?: number; descartadas_count?: number };
      this.activeScan.status      = 'done';
      this.activeScan.totalCost   = d.total_cost_usd    ?? 0;
      this.activeScan.activas     = d.activas_count     ?? 0;
      this.activeScan.descartadas = d.descartadas_count ?? 0;
      this.history.unshift({ ...this.activeScan, events: [...this.activeScan.events] });
      if (this.history.length > 10) this.history.pop();
    }

    if (event.type === 'error') {
      this.activeScan.status = 'error';
    }

    if (event.type === 'company_done') {
      const d = event.data as { cost_usd?: number };
      this.activeScan.totalCost += d.cost_usd ?? 0;
    }

    this.notify();
  }

  clearActive(): void {
    this.activeScan = null;
    this.notify();
  }
}

export const scanActivityStore = new ScanActivityStore();
