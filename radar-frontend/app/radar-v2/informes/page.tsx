'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText } from 'lucide-react';
import { InformeEjecucion } from '@/app/radar-v2/components/InformeEjecucion';

interface Session {
  session_id:       string;
  linea_negocio:    string;
  created_at:       string;
  empresas_count:   number;
  total_cost_usd:   number;
}

interface RawResult {
  session_id?:    string;
  linea_negocio?: string;
  created_at?:    string;
  cost_usd?:      number;
}

// Color mapping for linea_negocio left border
const LINEA_BORDER: Record<string, string> = {
  'BHS':             'border-l-blue-500',
  'Intralogística':  'border-l-purple-500',
  'Cartón':          'border-l-amber-500',
  'Final de Línea':  'border-l-orange-500',
  'Motos':           'border-l-red-500',
  'SOLUMAT':         'border-l-teal-500',
  'Solumat':         'border-l-teal-500',
  'Cargo':           'border-l-sky-500',
};

const LINEA_BADGE: Record<string, string> = {
  'BHS':             'bg-blue-500/10 text-blue-700',
  'Intralogística':  'bg-purple-500/10 text-purple-700',
  'Cartón':          'bg-amber-500/10 text-amber-700',
  'Final de Línea':  'bg-orange-500/10 text-orange-700',
  'Motos':           'bg-red-500/10 text-red-700',
  'SOLUMAT':         'bg-teal-500/10 text-teal-700',
  'Solumat':         'bg-teal-500/10 text-teal-700',
  'Cargo':           'bg-sky-500/10 text-sky-700',
};

function getLineBorder(linea: string): string {
  return LINEA_BORDER[linea] ?? 'border-l-border';
}

function getLineBadge(linea: string): string {
  return LINEA_BADGE[linea] ?? 'bg-muted text-muted-foreground';
}

export default function InformesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [informeOpen, setInformeOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/radar-v2/results?limit=50')
      .then(r => r.ok ? r.json() : [])
      .then((rows: RawResult[]) => {
        // Agrupa por session_id
        const grouped = new Map<string, Session>();
        for (const r of rows) {
          if (!r.session_id) continue;
          const existing = grouped.get(r.session_id);
          if (existing) {
            existing.empresas_count += 1;
            existing.total_cost_usd += r.cost_usd ?? 0;
          } else {
            grouped.set(r.session_id, {
              session_id:     r.session_id,
              linea_negocio:  r.linea_negocio ?? '',
              created_at:     r.created_at ?? '',
              empresas_count: 1,
              total_cost_usd: r.cost_usd ?? 0,
            });
          }
        }
        setSessions(
          Array.from(grouped.values()).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          ),
        );
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Informes de Ejecución</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText size={32} className="mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Sin informes disponibles — ejecuta un escaneo en /radar-v2/escanear
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Informes de Ejecución</h1>
      {sessions.map((s, idx) => (
        <Card
          key={s.session_id}
          className={`flex items-center justify-between gap-3 border-l-4 p-4 ${getLineBorder(s.linea_negocio)}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getLineBadge(s.linea_negocio)}`}
              >
                {s.linea_negocio || 'Sin línea'}
              </span>
              <Badge variant="secondary" className="text-xs">
                {s.empresas_count} {s.empresas_count === 1 ? 'empresa' : 'empresas'}
              </Badge>
              {idx === 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                  Última sesión
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(s.created_at).toLocaleString('es-CO')} · ${s.total_cost_usd.toFixed(4)} USD
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInformeOpen(s.session_id)}
            >
              <FileText size={13} className="mr-1" /> Ver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/radar-v2/export?sessionId=${s.session_id}`)}
            >
              <Download size={13} className="mr-1" /> Excel
            </Button>
          </div>
        </Card>
      ))}
      {informeOpen && (
        <InformeEjecucion
          sessionId={informeOpen}
          open={!!informeOpen}
          onClose={() => setInformeOpen(null)}
        />
      )}
    </div>
  );
}
