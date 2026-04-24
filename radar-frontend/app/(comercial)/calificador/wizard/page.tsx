import { Suspense } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { CalificadorWizard } from '../components/CalificadorWizard';

export const dynamic = 'force-dynamic';

export default function CalificadorWizardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardCheck size={20} className="text-primary" />
            Nueva Calificación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evalúa empresas en 7 dimensiones con IA y asigna tier comercial
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      }>
        <CalificadorWizard />
      </Suspense>
    </div>
  );
}
