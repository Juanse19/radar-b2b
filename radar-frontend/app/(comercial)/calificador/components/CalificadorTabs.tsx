'use client';

import dynamic from 'next/dynamic';
import { Sparkles, History } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { useCalLiveStore } from '@/lib/comercial/calificador/live-store';
import { CalificadorWizard } from './CalificadorWizard';
import { CalificadorLivePanel } from './CalificadorLivePanel';

// Dashboard del histórico es el componente más pesado (drawer + tabla
// paginada). Lazy-load para que no bloquee el primer paint del tab Nueva.
const CalDashboard = dynamic(
  () => import('./CalDashboard').then((m) => ({ default: m.CalDashboard })),
  {
    ssr:     false,
    loading: () => (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Cargando histórico…
      </div>
    ),
  },
);

// Tab "Nueva calificación":
//   - Si hay sesión activa o recién terminada en el store → muestra LivePanel
//   - Si no hay sesión → muestra el wizard
function NuevaCalificacionTab() {
  const status = useCalLiveStore((s) => s.status);
  if (status === 'running' || status === 'done') {
    return <CalificadorLivePanel />;
  }
  return <CalificadorWizard />;
}

// V2 — 2 tabs según prototipo `comercial-v1`:
//   - Nueva calificación → wizard de 3 pasos (o panel en vivo si scan activo)
//   - Histórico          → 4 cards Tier + tabla con drawer lateral
const TABS: AgentTab[] = [
  {
    id:    'nueva',
    label: 'Nueva calificación',
    icon:  Sparkles,
    render: () => <NuevaCalificacionTab />,
  },
  {
    id:    'historico',
    label: 'Histórico',
    icon:  History,
    render: () => <CalDashboard />,
  },
];

export function CalificadorTabs() {
  return <AgentModeTabs tabs={TABS} defaultTab="nueva" />;
}
