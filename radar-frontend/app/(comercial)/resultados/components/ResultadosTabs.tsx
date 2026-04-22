'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ResultadosOverview } from './ResultadosOverview';
import { EmpresaDetailSheet } from './EmpresaDetailSheet';
import type { EmpresaRollup } from '@/lib/comercial/types';

interface ResultadosTabsProps {
  children: React.ReactNode;
}

export function ResultadosTabs({ children }: ResultadosTabsProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab') === 'detalle' ? 'detalle' : 'overview';

  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaRollup | null>(null);

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleSelectEmpresa(empresa: EmpresaRollup) {
    setSelectedEmpresa(empresa);
  }

  function handleCloseSheet() {
    setSelectedEmpresa(null);
  }

  return (
    <>
      <Tabs defaultValue={initialTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Por empresa</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <ResultadosOverview onSelectEmpresa={handleSelectEmpresa} />
        </TabsContent>

        <TabsContent value="detalle" className="mt-0">
          {children}
        </TabsContent>
      </Tabs>

      <EmpresaDetailSheet
        empresa={selectedEmpresa}
        onClose={handleCloseSheet}
      />
    </>
  );
}
