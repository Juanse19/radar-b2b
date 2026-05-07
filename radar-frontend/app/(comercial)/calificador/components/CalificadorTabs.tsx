'use client';

import { Building2, History } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { CalDashboard } from './CalDashboard';
import { CalHistorico } from './CalHistorico';

// Calificador V2 — solo 2 tabs según convención del equipo comercial:
//   - Empresas:  distribución por Tier + tabla de empresas calificadas
//   - Histórico: lista de escaneos / sesiones de calificación
// El wizard se accede desde /calificador/wizard (botón "Nueva calificación").
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
