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
    <div className="space-y-4">
      <header className="pb-3 border-b border-border">
        <h1 className="heading-xl">Escanear</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Dispara los agentes de IA para detectar señales de inversión B2B en las 6 líneas de negocio.
        </p>
      </header>

      <Tabs defaultValue="radar" className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="calificador" className="flex items-center gap-1.5">
            <ClipboardCheck size={14} />
            Calificación
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-1.5">
            <Radar size={14} />
            Radar
          </TabsTrigger>
          <TabsTrigger value="prospector" className="flex items-center gap-1.5">
            <Users size={14} />
            Prospección
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calificador" className="pt-4">
          <ManualAgentForm agent="calificador" />
        </TabsContent>
        <TabsContent value="radar" className="pt-4">
          <ManualAgentForm agent="radar" />
        </TabsContent>
        <TabsContent value="prospector" className="pt-4">
          <ManualAgentForm agent="prospector" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
