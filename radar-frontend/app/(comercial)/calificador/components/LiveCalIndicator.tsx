'use client';

/**
 * LiveCalIndicator — widget flotante que muestra el progreso de una sesión
 * de calificación en curso, visible desde cualquier ruta del módulo
 * comercial. Solo se renderiza cuando `useCalLiveStore.status === 'running'`.
 *
 * Click → navega a /calificador?tab=nueva (donde está el live panel completo).
 */
import Link from 'next/link';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';
import { useCalLiveStore } from '@/lib/comercial/calificador/live-store';
import { Button } from '@/components/ui/button';

export function LiveCalIndicator() {
  const status     = useCalLiveStore((s) => s.status);
  const companies  = useCalLiveStore((s) => s.companies);
  const totalCost  = useCalLiveStore((s) => s.totalCost);
  const cancel     = useCalLiveStore((s) => s.cancelSession);
  const reset      = useCalLiveStore((s) => s.reset);

  if (status !== 'running' && status !== 'done') return null;

  const total = companies.length;
  const done  = companies.filter((c) => c.status === 'done' || c.status === 'error').length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const isDone = status === 'done';

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        {isDone ? (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
        ) : (
          <Sparkles size={16} className="shrink-0 animate-pulse text-amber-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold">
            {isDone ? 'Calificación completada' : 'Calificando empresas…'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {done}/{total} empresas · ${totalCost.toFixed(4)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={isDone ? reset : cancel}
          aria-label={isDone ? 'Cerrar' : 'Cancelar'}
        >
          <X size={12} />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        href="/calificador?tab=nueva"
        className="mt-2 block text-center text-[11px] text-primary hover:underline"
      >
        Ver detalle →
      </Link>
    </div>
  );
}
