import { ClipboardCheck } from 'lucide-react';
import { CalificadorTabs } from './components/CalificadorTabs';

// Calificador V2 — página principal del módulo.
// Toda la UX vive dentro de los tabs (Empresas + Histórico).
// El wizard se accede desde el botón "Iniciar calificación" en cada tab
// vía /calificador/wizard.
export const dynamic = 'force-dynamic';

export default function CalificadorPage() {
  return (
    <div className="space-y-6">
      {/* Header compacto del módulo */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--agent-calificador-tint)', color: 'var(--agent-calificador)' }}
        >
          <ClipboardCheck size={18} />
        </div>
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--agent-calificador)' }}
          >
            Agente 01 — Calificador
          </p>
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            Calificar empresas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Evalúa el potencial comercial de empresas de tu base de datos con IA.
          </p>
        </div>
      </div>

      {/* Tabs: Empresas (dashboard) + Histórico */}
      <CalificadorTabs />
    </div>
  );
}
