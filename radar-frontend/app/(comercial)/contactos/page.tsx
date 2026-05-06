import Link from 'next/link';
import { Suspense } from 'react';
import { Users, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProspectorWizard } from './components/ProspectorWizard';

export const dynamic = 'force-dynamic';

export default function ContactosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-contactos-tint)', color: 'var(--agent-contactos)' }}
          >
            <Users size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-contactos)' }}>
              Agente 03 — Prospector v2
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">Contactos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Búsqueda nativa con Apollo en vivo. Selecciona línea, sub-línea, modo (Auto/Manual) y dispara la prospección.
            </p>
          </div>
        </div>
        <Link href="/comercial/contactos/historial">
          <Button variant="outline" size="sm">
            <History size={13} className="mr-1.5" />
            Ver historial
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
        <ProspectorWizard />
      </Suspense>
    </div>
  );
}
