import { Suspense } from 'react';
import { Wizard } from './components/Wizard';
import { LineaLanding } from './components/LineaLanding';

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
  const linea = params['linea'];
  const hasLinea = typeof linea === 'string' && linea.length > 0;

  if (!hasLinea) {
    // LineaLanding is a static client component — no Suspense needed
    return <LineaLanding />;
  }

  return (
    <Suspense fallback={<WizardFallback />}>
      <Wizard />
    </Suspense>
  );
}
