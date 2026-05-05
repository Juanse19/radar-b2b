'use client';

import { Building2, Sparkles, History, MessageSquare } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { CalificadorWizard } from './CalificadorWizard';
import { SignalsWizardLocal } from '../../senales/components/SignalsWizardLocal';
import { CalHistorico } from './CalHistorico';
import { ChatPanel } from '../../chat/components/ChatPanel';

const TABS: AgentTab[] = [
  {
    id:    'empresa',
    label: 'Empresa',
    icon:  Building2,
    render: () => <CalificadorWizard />,
  },
  {
    id:    'automatico',
    label: 'Señales',
    icon:  Sparkles,
    render: () => <SignalsWizardLocal />,
  },
  {
    id:    'historico',
    label: 'Histórico',
    icon:  History,
    render: () => <CalHistorico />,
  },
  {
    id:    'chat',
    label: 'Chat',
    icon:  MessageSquare,
    render: () => <ChatPanel />,
  },
];

export function CalificadorTabs() {
  return <AgentModeTabs tabs={TABS} defaultTab="empresa" />;
}
