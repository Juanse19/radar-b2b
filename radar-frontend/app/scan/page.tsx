'use client';

// /scan — Modo manual unificado.
//
// Esta página permite al usuario disparar UN agente individual a la vez:
//   - Calificación (WF01)
//   - Radar de Inversión (WF02)  ← tab por defecto, es el más usado en operación
//   - Prospección (WF03)
//
// Toda la lógica de cada formulario vive en `<ManualAgentForm agent="..." />`.
// Al disparar, el agente aparece automáticamente en el tracker global flotante
// (esquina inferior-derecha) gracias a useInflightExecutions invalidando la
// query después de POST /api/agent.
//
// La cascada automática WF01 → WF02 → WF03 se queda en /schedule, NO aquí.
// Aquí es 100% manual y cada agente es independiente.

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManualAgentForm } from '@/components/scan/ManualAgentForm';
import { ClipboardCheck, Radar, Users } from 'lucide-react';

export default function ScanPage() {
  return (
    <div className="space-y-5 max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Escanear</h1>
        <p className="text-sm text-muted-foreground">
          Dispara cada agente de forma individual sobre las empresas que elijas.
          La cascada automática (Calificación → Radar → Prospección) corre desde
          el módulo Cronograma.
        </p>
      </header>

      <Tabs defaultValue="radar">
        <TabsList variant="line">
          <TabsTrigger value="calificador">
            <ClipboardCheck size={14} />
            Calificación
          </TabsTrigger>
          <TabsTrigger value="radar">
            <Radar size={14} />
            Radar
          </TabsTrigger>
          <TabsTrigger value="prospector">
            <Users size={14} />
            Prospección
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calificador" className="pt-6">
          <ManualAgentForm agent="calificador" />
        </TabsContent>
        <TabsContent value="radar" className="pt-6">
          <ManualAgentForm agent="radar" />
        </TabsContent>
        <TabsContent value="prospector" className="pt-6">
          <ManualAgentForm agent="prospector" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
