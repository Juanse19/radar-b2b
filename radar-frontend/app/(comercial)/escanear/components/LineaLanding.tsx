'use client';

import { useRouter } from 'next/navigation';
import { ScanLine } from 'lucide-react';
import { LineaLandingCards } from '@/app/(comercial)/components/LineaLandingCards';

export function LineaLanding() {
  const router = useRouter();

  function handleSelect(linea: string) {
    const params = new URLSearchParams({ linea, step: '1' });
    router.push(`/escanear?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ScanLine size={20} className="text-primary" />
            Nuevo Escaneo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccioná la línea de negocio para escanear
          </p>
        </div>
      </div>

      <LineaLandingCards onSelect={handleSelect} />
    </div>
  );
}
