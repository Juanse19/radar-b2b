'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Zap, Target } from 'lucide-react';

interface Props {
  mode: 'auto' | 'manual';
}

const config = {
  auto: {
    Icon: Zap,
    label: 'Automático',
    subtext: 'Selecciona línea y cantidad',
  },
  manual: {
    Icon: Target,
    label: 'Manual',
    subtext: 'Elige empresas específicas',
  },
};

export function ModeCTA({ mode }: Props) {
  const router = useRouter();
  const { Icon, label, subtext } = config[mode];
  const color = mode === 'auto' ? 'text-primary' : 'text-foreground';

  return (
    <Card
      onClick={() => router.push(`/radar-v2/escanear?mode=${mode}&step=1`)}
      className="cursor-pointer p-6 text-center transition-all hover:border-primary hover:shadow-md"
    >
      <Icon size={32} className={`mx-auto mb-2 ${color}`} />
      <h3 className="text-base font-semibold">{label}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
    </Card>
  );
}
