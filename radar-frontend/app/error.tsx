'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[Radar B2B Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="p-3 bg-red-950 rounded-full">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Algo salió mal</h2>
          <p className="text-sm text-gray-400">
            {error.message || 'Ocurrió un error inesperado. Por favor intenta de nuevo.'}
          </p>
        </div>
        <Button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <RotateCcw size={15} />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
