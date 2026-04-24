import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm">Cargando...</p>
      </div>
    </div>
  );
}
