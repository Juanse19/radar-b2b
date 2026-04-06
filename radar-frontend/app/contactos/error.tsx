'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContactosError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('[Contactos] Error:', error); }, [error]);
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="p-3 bg-red-950 rounded-full">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Error cargando contactos</h2>
          <p className="text-sm text-gray-400">{error.message || 'Intenta de nuevo.'}</p>
        </div>
        <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <RotateCcw size={14} /> Reintentar
        </Button>
      </div>
    </div>
  );
}
