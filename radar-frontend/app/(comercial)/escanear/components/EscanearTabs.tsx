'use client';

import { Building2, MessageSquare } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { Wizard } from './Wizard';
import { ChatPanel } from '../../chat/components/ChatPanel';

const TABS: AgentTab[] = [
  {
    id:    'empresa',
    label: 'Empresa',
    icon:  Building2,
    render: () => <Wizard />,
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
