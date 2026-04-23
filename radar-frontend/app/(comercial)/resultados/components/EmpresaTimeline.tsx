'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Radio, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineEvent, TimelineEventType } from '@/lib/comercial/types';

interface EmpresaTimelineProps {
  empresaId: number | null;
}

const EVENT_CONFIG: Record<TimelineEventType, {
  icon:  React.ElementType;
  color: string;
  bg:    string;
}> = {
  calificacion: {
    icon:  CheckCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bg:    'bg-amber-100 dark:bg-amber-900/30',
  },
  radar: {
    icon:  Radio,
    color: 'text-blue-600 dark:text-blue-400',
    bg:    'bg-blue-100 dark:bg-blue-900/30',
  },
  contactos: {
    icon:  Users,
    color: 'text-violet-600 dark:text-violet-400',
    bg:    'bg-violet-100 dark:bg-violet-900/30',
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  } catch {
    return iso;
  }
}

export function EmpresaTimeline({ empresaId }: EmpresaTimelineProps) {
  const [events,  setEvents]  = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (empresaId === null) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/comercial/results/timeline/${empresaId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ events: TimelineEvent[] }>;
      })
      .then(data => setEvents(data.events))
      .catch(() => setError('No se pudo cargar el historial'))
      .finally(() => setLoading(false));
  }, [empresaId]);

  if (empresaId === null) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Sin ID de empresa — historial no disponible
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs">Cargando historial…</span>
      </div>
    );
  }

  if (error) {
    return <p className="py-4 text-center text-xs text-muted-foreground">{error}</p>;
  }

  if (!events.length) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Sin eventos registrados
      </p>
    );
  }

  return (
    <ol className="relative ml-2 border-l border-border/50 space-y-5 py-2">
      {events.map(event => {
        const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.radar;
        const Icon   = config.icon;

        return (
          <li key={event.id} className="ml-5">
            <span
              className={cn(
                'absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-border',
                config.bg,
              )}
              aria-hidden
            >
              <Icon size={12} className={config.color} />
            </span>

            <div className="rounded-lg border border-border/40 bg-card px-3 py-2">
              <p className="text-xs font-semibold leading-snug">{event.title}</p>
              {event.subtitle && (
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {event.subtitle}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {event.score !== null && (
                  <span className="text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    Score {event.score}
                  </span>
                )}
                {event.tier && (
                  <span className="text-[10px] text-muted-foreground">
                    {event.tier}
                  </span>
                )}
                <time
                  dateTime={event.created_at}
                  className="ml-auto text-[10px] text-muted-foreground/70"
                >
                  {formatDate(event.created_at)}
                </time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
