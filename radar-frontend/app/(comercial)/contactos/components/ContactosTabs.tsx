'use client';

import { Building2, Layers, MessageSquare } from 'lucide-react';
import { AgentModeTabs, type AgentTab } from '@/components/agent/AgentModeTabs';
import { ContactosEmpresaForm } from './ContactosEmpresaForm';
import { ContactosMasivoForm } from './ContactosMasivoForm';
import { ChatPanel } from '../../chat/components/ChatPanel';

const TABS: AgentTab[] = [
  {
    id:    'empresa',
    label: 'Empresa',
    icon:  Building2,
    render: () => <ContactosEmpresaForm />,
  },
  {
    id:    'masivo',
    label: 'Masivo',
    icon:  Layers,
    render: () => <ContactosMasivoForm />,
  },
  {
    id:    'chat',
    label: 'Chat',
    icon:  MessageSquare,
    render: () => <ChatPanel />,
  },
];

export function ContactosTabs() {
  return <AgentModeTabs tabs={TABS} defaultTab="empresa" />;
}
