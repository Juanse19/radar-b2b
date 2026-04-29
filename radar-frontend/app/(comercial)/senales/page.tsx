import { Suspense } from 'react';
import { Radar } from 'lucide-react';
import { SenalesScanForm } from './components/SenalesScanForm';

export const dynamic = 'force-dynamic';

export default function SenalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Radar size={20} className="text-primary" />
            Modo Señales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Descubrí empresas con señales de inversión activas en una línea + países —
            sin partir de una empresa preestablecida.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          v5 · MAOA
        </span>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
        <SenalesScanForm />
      </Suspense>
    </div>
  );
}
