import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { ContactosTabs } from './components/ContactosTabs';

export const dynamic = 'force-dynamic';

export default function ContactosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--agent-contactos-tint)', color: 'var(--agent-contactos)' }}
        >
          <Users size={18} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-contactos)' }}>
            Agente 03 — Prospector
          </p>
          <h1 className="text-xl font-semibold leading-tight text-foreground">Contactos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tres modos: por empresa, búsqueda masiva con Apollo o conversación.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
        <ContactosTabs />
      </Suspense>
    </div>
  );
}
