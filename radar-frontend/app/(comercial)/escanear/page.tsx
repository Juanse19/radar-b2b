import { Suspense } from 'react';
import { ScanLine } from 'lucide-react';
import { EscanearTabs } from './components/EscanearTabs';

export const dynamic = 'force-dynamic';

function WizardFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function EscanearPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ScanLine size={20} className="text-primary" />
            Escanear
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tres modos de detección de señales: por empresa específica, búsqueda libre o conversación.
          </p>
        </div>
      </div>

      <Suspense fallback={<WizardFallback />}>
        <EscanearTabs />
      </Suspense>
    </div>
  );
}
