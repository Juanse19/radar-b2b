import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { ContactosTabs } from './components/ContactosTabs';

export const dynamic = 'force-dynamic';

export default function ContactosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Users size={20} className="text-primary" />
            Contactos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
