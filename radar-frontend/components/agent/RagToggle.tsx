'use client';

/**
 * RagToggle — Toggle reusable para habilitar contexto RAG en cualquier agente.
 *
 * Usado por Calificador (contexto de calificaciones pasadas) y Radar
 * (contexto de señales de inversión pasadas). El label/description se
 * personaliza por contexto.
 */

import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Default: "Contexto RAG" */
  label?: string;
  /** Default: "Añade contexto de información pasada para mejorar precisión" */
  description?: string;
  /** Optional id for the underlying checkbox (multiple instances on same page). */
  id?: string;
}

export function RagToggle({
  enabled,
  onChange,
  label = 'Contexto RAG',
  description = 'Añade contexto de información pasada para mejorar precisión',
  id = 'rag-toggle',
}: Props) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        enabled
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-muted/20',
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Database size={14} className={enabled ? 'text-primary' : 'text-muted-foreground'} />
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {enabled && (
          <Badge variant="secondary" className="mt-1 h-5 text-[10px]">
            Activo
          </Badge>
        )}
      </label>
    </div>
  );
}
