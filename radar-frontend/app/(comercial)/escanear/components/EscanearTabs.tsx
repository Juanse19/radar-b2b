'use client';

import { Building2, Radar, MessageSquare } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { Wizard } from './Wizard';
import { SenalesScanForm } from '../../senales/components/SenalesScanForm';
import { ChatPanel } from '../../chat/components/ChatPanel';

const TABS: AgentTab[] = [
  {
    id:    'empresa',
    label: 'Empresa',
    icon:  Building2,
    render: () => <Wizard />,
  },
  {
    id:    'senales',
    label: 'Señales',
    icon:  Radar,
    render: () => <SenalesScanForm />,
  },
  {
    id:    'chat',
    label: 'Chat',
    icon:  MessageSquare,
    render: () => <ChatPanel />,
  },
];

export function EscanearTabs() {
  return <AgentModeTabs tabs={TABS} defaultTab="empresa" />;
}
