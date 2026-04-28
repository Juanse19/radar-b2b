'use client';

import { useRouter } from 'next/navigation';
import { LineaLandingCards } from '@/app/(comercial)/components/LineaLandingCards';

export function LineaSelectorClient() {
  const router = useRouter();

  function handleSelect(linea: string) {
    const params = new URLSearchParams({ linea, step: '1' });
    router.push(`/calificador/wizard?${params.toString()}`);
  }

  return <LineaLandingCards onSelect={handleSelect} />;
}
