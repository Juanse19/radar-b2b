import { Suspense } from 'react';
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

export default function EscanearPage() {
  return (
    <Suspense fallback={<WizardFallback />}>
      <Wizard />
    </Suspense>
  );
}
