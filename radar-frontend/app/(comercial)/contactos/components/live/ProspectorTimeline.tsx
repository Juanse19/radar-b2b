'use client';

import { useMemo } from 'react';
import { Search, Users, Sparkles, CheckCircle2, AlertCircle, SkipForward, Clock, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProspectorEvent } from './useProspectorStream';

interface Props {
  events: ProspectorEvent[];
}

interface VisibleEvent {
  id:       number;
  ts:       number;
  type:     string;
  empresa?: string;
  message:  string;
  icon:     LucideIcon;
  color:    string;
}

function describeEvent(ev: ProspectorEvent): VisibleEvent | null {
  const d = ev.data as Record<string, unknown>;
  const empresa = (d?.empresa as string | undefined) ?? undefined;

  switch (ev.type) {
    case 'session_started':
      return { id: ev.id, ts: ev.ts, type: ev.type, message: `Sesión iniciada · ${(d.empresas as unknown[])?.length ?? 0} empresa(s)`, icon: Sparkles, color: 'text-purple-600' };
    case 'company_started':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Iniciando ${empresa} (${d.index}/${d.total})`, icon: Users, color: 'text-blue-600' };
    case 'searching':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Buscando con ${d.titles_count} job titles en ${d.pais}`, icon: Search, color: 'text-blue-500' };
    case 'found':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `${d.candidates} candidatos encontrados`, icon: Users, color: 'text-emerald-600' };
    case 'no_results':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Sin resultados en ${d.pais}`, icon: AlertCircle, color: 'text-amber-600' };
    case 'enriching':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Enriqueciendo ${d.nombre} (${d.nivel}) — ${d.cargo}`, icon: Sparkles, color: 'text-violet-600' };
    case 'contact':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa: d.empresa as string, message: `Contacto: ${d.nombre} ${d.apellido} · ${d.email}`, icon: CheckCircle2, color: 'text-emerald-700' };
    case 'saved':
      return null; // Reduce ruido — la tarjeta ya muestra "Guardado"
    case 'skipped_duplicate':
      return { id: ev.id, ts: ev.ts, type: ev.type, message: `Skip duplicado (${(d.apollo_id as string)?.slice(0, 8)}…)`, icon: SkipForward, color: 'text-muted-foreground' };
    case 'rate_limit':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Apollo rate limit · esperando ${Math.round((d.retry_in_ms as number) / 1000)}s (intento ${d.attempt})`, icon: Clock, color: 'text-amber-700' };
    case 'company_done':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `${empresa} completa · ${d.saved} guardados, ${d.skipped} saltados`, icon: CheckCircle2, color: 'text-emerald-700' };
    case 'company_error':
      return { id: ev.id, ts: ev.ts, type: ev.type, empresa, message: `Error en ${empresa}: ${d.error}`, icon: AlertTriangle, color: 'text-destructive' };
    case 'session_done':
      return { id: ev.id, ts: ev.ts, type: ev.type, message: `Sesión completa · ${d.total_contacts} contactos · ${d.credits_used} créditos`, icon: Sparkles, color: 'text-purple-700' };
    case 'error':
      return { id: ev.id, ts: ev.ts, type: ev.type, message: `Error: ${d.message}`, icon: AlertTriangle, color: 'text-destructive' };
    default:
      return null;
  }
}

export function ProspectorTimeline({ events }: Props) {
  const items: VisibleEvent[] = useMemo(() => {
    const out: VisibleEvent[] = [];
    for (const ev of events) {
      const v = describeEvent(ev);
      if (v) out.push(v);
    }
    return out;
  }, [events]);

  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-6 italic">
        Esperando eventos…
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="flex items-start gap-2 py-1 text-xs">
            <Icon size={13} className={cn('mt-0.5 shrink-0', item.color)} />
            <span className="flex-1 leading-snug">
              {item.empresa && (
                <span className="font-medium">{item.empresa} · </span>
              )}
              <span className="text-muted-foreground">{item.message}</span>
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {formatTime(item.ts)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
