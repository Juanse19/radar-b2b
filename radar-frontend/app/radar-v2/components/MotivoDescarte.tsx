'use client';

import { useState } from 'react';
import { XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  motivoDescarte?:   string | null;
  descripcionResumen?: string | null;
}

export function MotivoDescarte({ motivoDescarte, descripcionResumen }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasMotivo      = Boolean(motivoDescarte);
  const hasDescripcion = Boolean(descripcionResumen);

  if (!hasMotivo && !hasDescripcion) return null;

  return (
    <div className="mt-1.5 space-y-1.5">
      {hasMotivo && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <XCircle size={13} className="mt-0.5 shrink-0" />
          <span className="italic">{motivoDescarte}</span>
        </div>
      )}

      {hasDescripcion && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded
              ? <ChevronUp size={12} className="mr-1" />
              : <ChevronDown size={12} className="mr-1" />}
            {expanded ? 'Ocultar búsqueda' : '¿Qué se buscó?'}
          </Button>
          {expanded && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {descripcionResumen}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
