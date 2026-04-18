'use client';

import { useSyncExternalStore, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scanActivityStore } from '@/lib/radar-v2/scan-activity-store';
import type { ActiveScan, ScanEvent } from '@/lib/radar-v2/scan-activity-store';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('es-CO', {
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function EventRow({ event }: { event: ScanEvent }) {
  const d = event.data as Record<string, unknown>;

  switch (event.type) {
    case 'scan_started':
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">🚀</span>
          <span className="text-muted-foreground">
            Iniciando escaneo de {String(d.empresas_count ?? '')} empresa(s)
          </span>
        </div>
      );
    case 'company_start':
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">🔍</span>
          <span className="text-muted-foreground">
            Escaneando <span className="font-medium text-foreground">{String(d.empresa ?? '')}</span>
          </span>
        </div>
      );
    case 'company_done':
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">✅</span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{String(d.empresa ?? '')}</span>
            {' — '}
            <span className={d.radar_activo === 'Sí' ? 'text-green-600 dark:text-green-400' : ''}>
              {String(d.radar_activo ?? '')}
            </span>
          </span>
        </div>
      );
    case 'company_error':
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">❌</span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{String(d.empresa ?? '')}</span>
            {' — '}
            {String(d.error ?? 'Error')}
          </span>
        </div>
      );
    case 'session_done': {
      const activas     = Number(d.activas_count     ?? 0);
      const descartadas = Number(d.descartadas_count ?? 0);
      const cost        = Number(d.total_cost_usd    ?? 0);
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">🏁</span>
          <span className="font-medium text-foreground">
            Finalizado: {activas} activas · {descartadas} descartadas · ${cost.toFixed(4)}
          </span>
        </div>
      );
    }
    case 'budget_warning': {
      const pct = Number(d.pct ?? d.percent ?? 0);
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="text-amber-600 dark:text-amber-400">
            {pct}% del presupuesto usado
          </span>
        </div>
      );
    }
    case 'error':
      return (
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="text-destructive">{String(d.message ?? 'Error desconocido')}</span>
        </div>
      );
    default:
      return null;
  }
}

function HistoryItem({ scan }: { scan: ActiveScan }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground truncate">{scan.line}</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            scan.status === 'done'    && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            scan.status === 'error'   && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            scan.status === 'running' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          )}
        >
          {scan.status === 'done' ? 'Completado' : scan.status === 'error' ? 'Error' : 'En curso'}
        </span>
      </div>
      <div className="text-muted-foreground">
        {scan.empresas.length} empresa{scan.empresas.length !== 1 ? 's' : ''}
        {scan.status === 'done' && (
          <> · {scan.activas} activas · ${scan.totalCost.toFixed(4)}</>
        )}
      </div>
      <div className="text-muted-foreground/70">{formatDate(scan.startedAt)}</div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function ScanActivityWidget() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab]           = useState<'active' | 'history'>('active');

  const activeScan = useSyncExternalStore(
    scanActivityStore.subscribe.bind(scanActivityStore),
    scanActivityStore.getActiveScan.bind(scanActivityStore),
    () => null,
  );

  const history = useSyncExternalStore(
    scanActivityStore.subscribe.bind(scanActivityStore),
    scanActivityStore.getHistory.bind(scanActivityStore),
    () => [] as ActiveScan[],
  );

  // Nothing to show
  if (activeScan === null && history.length === 0) return null;

  // ── collapsed pill ────────────────────────────────────────────────────────
  if (!expanded) {
    const scan = activeScan;
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        aria-label="Ver actividad de escaneo"
      >
        {scan?.status === 'running' && (
          <span className="animate-pulse h-2 w-2 rounded-full bg-green-400" />
        )}
        {scan?.status === 'done' && (
          <span className="h-2 w-2 rounded-full bg-green-400" />
        )}
        {scan?.status === 'error' && (
          <span className="h-2 w-2 rounded-full bg-red-400" />
        )}
        {scan === null && (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
        )}
        <span>
          {scan === null
            ? 'Historial de escaneos'
            : scan.status === 'running'
            ? 'Escaneo en curso'
            : scan.status === 'done'
            ? 'Escaneo completado'
            : 'Escaneo con error'}
        </span>
        {scan !== null && (
          <span className="text-xs opacity-70">{scan.empresas.length} empresas</span>
        )}
      </button>
    );
  }

  // ── expanded panel ────────────────────────────────────────────────────────
  const displayedEvents = activeScan
    ? activeScan.events.slice(-5)
    : [];

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-96 flex-col rounded-xl border border-border bg-background shadow-xl"
      style={{ maxHeight: '22rem' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">
          {activeScan?.status === 'running'
            ? 'Escaneo activo'
            : activeScan?.status === 'done'
            ? 'Escaneo completado'
            : activeScan?.status === 'error'
            ? 'Escaneo con error'
            : 'Actividad de escaneo'}
        </span>
        <div className="flex items-center gap-2">
          {activeScan && (
            <Link
              href={`/radar-v2/vivo?sessionId=${activeScan.sessionId}&line=${encodeURIComponent(activeScan.line)}&provider=${activeScan.provider}&empresas=${encodeURIComponent(JSON.stringify(activeScan.empresas.map(name => ({ name, country: '' }))))}`}
              className="text-xs text-primary hover:underline"
            >
              Ver en vivo
            </Link>
          )}
          <button
            onClick={() => setExpanded(false)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'active' ? 'En curso' : 'Historial'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'active' && (
          <>
            {activeScan === null ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No hay un escaneo en curso.
              </p>
            ) : displayedEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Iniciando…
              </p>
            ) : (
              <div className="space-y-2">
                {displayedEvents.map((ev, i) => (
                  <EventRow key={i} event={ev} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Sin escaneos previos.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((scan, i) => (
                  <HistoryItem key={`${scan.sessionId}-${i}`} scan={scan} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
