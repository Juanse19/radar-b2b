'use client';

import dynamic from 'next/dynamic';
import { Building2, History } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { CalDashboard } from './CalDashboard';

// CalHistorico es ~800 líneas: lazy-load para que no bloquee el render
// inicial del tab Empresas (que es el default).
const CalHistorico = dynamic(
  () => import('./CalHistorico').then((m) => ({ default: m.CalHistorico })),
  {
    ssr:     false,
    loading: () => (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Cargando histórico…
      </div>
    ),
  },
);

// Calificador V2 — solo 2 tabs según convención del equipo comercial:
//   - Empresas:  distribución por Tier + tabla de empresas calificadas
//   - Histórico: lista de escaneos / sesiones de calificación
// El wizard se accede desde /calificador/wizard.
const TABS: AgentTab[] = [
  {
    id:    'empresas',
    label: 'Empresas',
    icon:  Building2,
    render: () => <CalDashboard />,
  },
  {
    id:    'historico',
    label: 'Histórico',
    icon:  History,
    render: () => <CalHistorico />,
  },
];

export function CalificadorTabs() {
  return <AgentModeTabs tabs={TABS} defaultTab="empresas" />;
}
