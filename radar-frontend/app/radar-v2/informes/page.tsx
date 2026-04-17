'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
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
      {sessions.map(s => (
        <Card
          key={s.session_id}
          className="flex items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{s.linea_negocio}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(s.created_at).toLocaleString('es-CO')} · {s.empresas_count} empresas · ${s.total_cost_usd.toFixed(4)} USD
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
