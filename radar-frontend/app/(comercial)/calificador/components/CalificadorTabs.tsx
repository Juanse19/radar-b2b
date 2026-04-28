'use client';

import { Building2, Sparkles, MessageSquare } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { CalificadorWizard } from './CalificadorWizard';
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
    label: 'Automático',
    icon:  Sparkles,
    render: () => <CalificadorWizard />,
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
