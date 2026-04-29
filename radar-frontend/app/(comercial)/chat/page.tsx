import { Suspense } from 'react';
import { MessageSquare } from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <MessageSquare size={20} className="text-primary" />
            Chat RADAR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pregunta en lenguaje natural — el agente interpreta línea, países y dispara el scan.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
        <ChatPanel />
      </Suspense>
    </div>
  );
}
