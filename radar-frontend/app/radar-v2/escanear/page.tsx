import { Suspense } from 'react';
import { ScanLine } from 'lucide-react';
import { Wizard } from './components/Wizard';

export const dynamic = 'force-dynamic';

function WizardFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded bg-muted" />
    </div>
  );
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EscanearPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawStep = Number(params['step'] ?? '1');
  const step = rawStep >= 1 && rawStep <= 3 ? rawStep : 1;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ScanLine size={20} className="text-primary" />
            Nuevo Escaneo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura y ejecuta un análisis de señales de inversión
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          Paso {step} de 3
        </span>
      </div>

      <Suspense fallback={<WizardFallback />}>
        <Wizard />
      </Suspense>
    </div>
  );
}
