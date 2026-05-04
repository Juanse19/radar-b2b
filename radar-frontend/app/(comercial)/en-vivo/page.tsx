'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { LiveTimeline } from './components/LiveTimeline';

interface CompanyInput {
  id?:     number;
  name:    string;
  country: string;
}

function parseEmpresasParam(raw: string | null): CompanyInput[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as unknown[]).flatMap<CompanyInput>((item) => {
      if (
        typeof item === 'object' && item !== null &&
        'name' in item && 'country' in item &&
        typeof (item as Record<string, unknown>).name    === 'string' &&
        typeof (item as Record<string, unknown>).country === 'string'
      ) {
        const rec = item as Record<string, unknown>;
        return [{
          id:      typeof rec.id === 'number' ? rec.id : undefined,
          name:    rec.name    as string,
          country: rec.country as string,
        }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function VivoInner() {
  const params    = useSearchParams();
  const sessionId = params.get('sessionId');
  const line      = params.get('line');
  const provider  = params.get('provider') ?? undefined;
  const empresas  = useMemo(() => parseEmpresasParam(params.get('empresas')), [params]);

  if (!sessionId || !line || empresas.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' }}
        >
          <Activity size={24} />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Vista en vivo</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Inicia un escaneo desde el asistente para ver el streaming en tiempo real.
        </p>
        <Link href="/escanear">
          <Button>Ir al asistente</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' }}
        >
          <Activity size={18} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-radar)' }}>
            Agente 02 — Radar de Inversión
          </p>
          <h1 className="text-xl font-semibold leading-tight text-foreground">En vivo</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Seguimiento en tiempo real del escaneo — tipo Perplexity.
          </p>
        </div>
      </div>
      <LiveTimeline
        sessionId={sessionId}
        line={line}
        empresas={empresas}
        provider={provider}
      />
    </div>
  );
}

export default function VivoPage() {
  return (
    <Suspense
      fallback={
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Cargando…
        </Card>
      }
    >
      <VivoInner />
    </Suspense>
  );
}
