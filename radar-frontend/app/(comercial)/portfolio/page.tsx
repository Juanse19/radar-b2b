import { Suspense } from 'react';
import { Briefcase } from 'lucide-react';
import { PortfolioView } from './components/PortfolioView';

export const dynamic = 'force-dynamic';

export default function PortfolioPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Briefcase size={20} className="text-primary" />
            Portafolio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista consolidada de empresas con TIER, último radar, calificación y contactos.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
        <PortfolioView />
      </Suspense>
    </div>
  );
}
