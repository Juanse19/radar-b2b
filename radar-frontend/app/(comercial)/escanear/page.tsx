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
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' }}
        >
          <ScanLine size={18} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-radar)' }}>
            Agente 02 — Radar de Inversión
          </p>
          <h1 className="text-xl font-semibold leading-tight text-foreground">Escanear señales</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Detecta señales CAPEX por empresa específica, por línea o en conversación con IA.
          </p>
        </div>
      </div>

      <Suspense fallback={<WizardFallback />}>
        <EscanearTabs />
      </Suspense>
    </div>
  );
}
