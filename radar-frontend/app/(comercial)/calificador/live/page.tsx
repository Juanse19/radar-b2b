'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck } from 'lucide-react';
import { CalificadorLivePanel } from '../components/CalificadorLivePanel';

interface EmpresaInput {
  id?:     number;
  name:    string;
  country: string;
}

function parseEmpresas(raw: string | null): EmpresaInput[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as unknown[]).flatMap<EmpresaInput>((item) => {
      if (
        typeof item === 'object' && item !== null &&
        'name' in item && 'country' in item &&
        typeof (item as Record<string, unknown>).name    === 'string' &&
        typeof (item as Record<string, unknown>).country === 'string'
      ) {
        const rec = item as Record<string, unknown>;
        return [{ id: typeof rec.id === 'number' ? rec.id : undefined, name: rec.name as string, country: rec.country as string }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function LiveInner() {
  const params     = useSearchParams();
  const sessionId  = params.get('sessionId');
  const linea      = params.get('linea');
  const provider   = params.get('provider') ?? 'claude';
  const ragEnabled = params.get('rag') !== 'false';
  const subRaw     = params.get('subLineaId');
  const subLineaId = subRaw ? Number(subRaw) : undefined;
  const model      = params.get('model') ?? undefined;
  const empresas   = useMemo(() => parseEmpresas(params.get('empresas')), [params]);

  if (!sessionId || !linea || empresas.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ClipboardCheck size={32} className="mx-auto mb-3 text-muted-foreground/40" />
        <h1 className="mb-2 text-xl font-semibold">Calificación en vivo</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Inicia una calificación desde el asistente para ver el progreso en tiempo real.
        </p>
        <Link href="/calificador/wizard">
          <Button>Ir al asistente</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calificando en vivo</h1>
        <p className="text-sm text-muted-foreground">
          {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} · {linea}
        </p>
      </div>
      <CalificadorLivePanel
        sessionId={sessionId}
        linea={linea}
        empresas={empresas}
        subLineaId={subLineaId}
        provider={provider}
        ragEnabled={ragEnabled}
        model={model}
      />
    </div>
  );
}

export default function CalificadorLivePage() {
  return (
    <Suspense fallback={
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Cargando…
      </Card>
    }>
      <LiveInner />
    </Suspense>
  );
}
