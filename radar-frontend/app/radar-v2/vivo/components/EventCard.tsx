'use client';

import {
  Brain,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
  Ban,
  Flag,
  AlertTriangle,
  Radar,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamEvent, StreamEventType } from '@/lib/radar-v2/stream-events';

interface Props {
  event: StreamEvent;
  now:   number;
}

const iconForType: Record<StreamEventType, React.ComponentType<{ size?: number; className?: string }>> = {
  scan_started:     Radar,
  thinking:         Brain,
  search_query:     Search,
  reading_source:   FileText,
  criteria_eval:    CheckCircle2,
  signal_detected:  Sparkles,
  signal_discarded: Ban,
  token_tick:       Brain,
  company_done:     CheckCircle2,
  company_error:    AlertTriangle,
  provider_fallback: RefreshCw,
  session_done:     Flag,
  error:            AlertTriangle,
};

const borderForType: Record<StreamEventType, string> = {
  scan_started:     'border-l-primary',
  thinking:         'border-l-muted-foreground/40',
  search_query:     'border-l-primary',
  reading_source:   'border-l-primary/70',
  criteria_eval:    'border-l-emerald-500',
  signal_detected:  'border-l-emerald-500',
  signal_discarded: 'border-l-red-400',
  token_tick:       'border-l-muted-foreground/30',
  company_done:     'border-l-emerald-500',
  company_error:    'border-l-destructive',
  provider_fallback: 'border-l-amber-400',
  session_done:     'border-l-primary',
  error:            'border-l-destructive',
};

const iconColorForType: Record<StreamEventType, string> = {
  scan_started:     'text-primary',
  thinking:         'text-muted-foreground',
  search_query:     'text-primary',
  reading_source:   'text-primary/80',
  criteria_eval:    'text-emerald-500',
  signal_detected:  'text-emerald-500',
  signal_discarded: 'text-red-400',
  token_tick:       'text-muted-foreground',
  company_done:     'text-emerald-500',
  company_error:    'text-destructive',
  provider_fallback: 'text-amber-500',
  session_done:     'text-primary',
  error:            'text-destructive',
};

function relativeTime(fromMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - fromMs);
  if (diff < 2000) return 'ahora';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  return `hace ${m}m`;
}

function truncateUrl(u: string): string {
  try {
    const url = new URL(u);
    const path = url.pathname.length > 40 ? url.pathname.slice(0, 40) + '…' : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return u.length > 60 ? u.slice(0, 60) + '…' : u;
  }
}

function formatBody(event: StreamEvent): { title: string; detail?: string } {
  const d = event.data as Record<string, unknown>;
  switch (event.type) {
    case 'scan_started':
      return {
        title:  'Escaneo iniciado',
        detail: `${Array.isArray(d.empresas) ? (d.empresas as unknown[]).length : 0} empresas — línea ${d.linea as string}`,
      };
    case 'thinking':
      return { title: `Pensando sobre ${d.empresa as string}`, detail: `Línea: ${d.linea as string}` };
    case 'search_query':
      return { title: `Buscando: "${d.query as string}"`, detail: d.empresa as string };
    case 'reading_source': {
      const url   = d.url as string;
      const title = d.title as string | undefined;
      return {
        title:  title ? title : 'Leyendo fuente',
        detail: truncateUrl(url),
      };
    }
    case 'criteria_eval':
      return {
        title:  `${d.cumplido ? '✓' : '✗'} ${d.criterio as string}`,
        detail: d.empresa as string,
      };
    case 'signal_detected': {
      const parts: string[] = [];
      if (d.tipo_senal)      parts.push(d.tipo_senal as string);
      if (d.monto_inversion) parts.push(d.monto_inversion as string);
      if (d.ventana_compra)  parts.push(d.ventana_compra as string);
      return {
        title:  `✨ Señal detectada — ${d.empresa as string}`,
        detail: parts.join(' · ') || undefined,
      };
    }
    case 'signal_discarded':
      return {
        title:  `Descartada — ${d.empresa as string}`,
        detail: (d.motivo_descarte as string) || undefined,
      };
    case 'token_tick':
      return {
        title:  `Tokens ${(d.tokens_in as number).toLocaleString()} in · ${(d.tokens_out as number).toLocaleString()} out`,
        detail: `Costo acumulado: $${(d.cost_usd_total as number).toFixed(4)}`,
      };
    case 'company_done':
      return {
        title:  `Empresa completada — ${d.empresa as string}`,
        detail: `${d.radar_activo as string === 'Sí' ? 'ACTIVA' : 'Descartada'} · ${Math.round((d.duration_ms as number) / 1000)}s · $${(d.cost_usd as number).toFixed(4)}`,
      };
    case 'company_error': {
      const errText = (d.error as string) ?? '';
      const isQuota = errText.includes('cuota agotada')
                   || errText.includes('quota')
                   || errText.includes('429')
                   || errText.includes('credit balance');
      return {
        title:  `Error — ${d.empresa as string}`,
        detail: isQuota
          ? `${errText.slice(0, 180)} → Revisa Admin → Configuración de API`
          : errText.slice(0, 200),
      };
    }
    case 'provider_fallback':
      return {
        title:  `Proveedor ${(d.original_provider as string | undefined) ?? ''} sin cuota — ${d.empresa as string}`,
        detail: (d.reason as string | undefined)?.slice(0, 120),
      };
    case 'session_done':
      return {
        title:  '🏁 Escaneo finalizado',
        detail: `${d.activas_count as number} activas · ${d.descartadas_count as number} descartadas · ${Math.round((d.duration_ms as number) / 1000)}s · $${(d.total_cost_usd as number).toFixed(4)}`,
      };
    case 'error':
      return { title: 'Error del stream', detail: (d.message as string).slice(0, 160) };
    default:
      return { title: event.type };
  }
}

export function EventCard({ event, now }: Props) {
  const Icon = iconForType[event.type] ?? Brain;
  const { title, detail } = formatBody(event);

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm',
        'border-l-4 transition-opacity animate-in fade-in slide-in-from-bottom-1 duration-200',
        borderForType[event.type] ?? 'border-l-border',
        event.type === 'provider_fallback' && 'bg-amber-50 dark:bg-amber-950/20',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', iconColorForType[event.type] ?? 'text-foreground')}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn(
            'truncate font-medium',
            event.type === 'signal_detected' && 'font-semibold text-emerald-600 dark:text-emerald-400',
          )}>
            {title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relativeTime(event.ts, now)}
          </span>
        </div>
        {detail && (
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        )}
      </div>
    </div>
  );
}
