'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Plane, Truck, Factory, Zap, type LucideIcon } from 'lucide-react';
import type { ScanPreset } from '@/lib/comercial/presets';

const iconMap: Record<string, LucideIcon> = {
  Plane,
  Truck,
  Factory,
  Zap,
};

export function PresetCard({ preset }: { preset: ScanPreset }) {
  const router = useRouter();
  const Icon = iconMap[preset.icon] ?? Zap;

  return (
    <Card
      onClick={() =>
        router.push(`/escanear?preset=${preset.id}&step=3`)
      }
      className="group cursor-pointer p-5 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <Icon size={24} className="text-primary" />
        <span className="text-xl leading-none" aria-hidden>
          {preset.countryFlag}
        </span>
      </div>
      <h3 className="text-base font-semibold">{preset.label}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{preset.description}</p>
      <p className="mt-3 text-xs text-primary group-hover:underline">
        {preset.companyCount} empresas →
      </p>
    </Card>
  );
}
