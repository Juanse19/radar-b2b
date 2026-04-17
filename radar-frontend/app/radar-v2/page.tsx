'use client';

import { PresetCard } from './components/landing/PresetCard';
import { ModeCTA } from './components/landing/ModeCTA';
import { PRESETS } from '@/lib/radar-v2/presets';
import { Radar } from 'lucide-react';

export default function RadarV2LandingPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Radar size={24} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Radar de Inversiones</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Detecta señales de inversión en LATAM antes que la competencia
        </p>
      </div>

      {/* Presets */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Escaneos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <PresetCard key={p.id} preset={p} />
          ))}
        </div>
      </section>

      {/* Modes */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Escaneo personalizado
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCTA mode="auto" />
          <ModeCTA mode="manual" />
        </div>
      </section>
    </div>
  );
}
