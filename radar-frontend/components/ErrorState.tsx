'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/fetcher';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

/**
 * Inline error card for failed queries.
 * Used inside cards/tabs so a single failure doesn't blow up the whole page.
 */
export function ErrorState({ error, onRetry, title = 'No se pudo cargar', className }: ErrorStateProps) {
  const message =
    error instanceof ApiError
      ? error.status === 0
        ? 'Sin conexión con el servidor'
        : `Error ${error.status} del servidor`
      : error instanceof Error
        ? error.message
        : 'Error desconocido';

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle size={22} className="text-destructive" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5"
          >
            <RotateCcw size={13} />
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
