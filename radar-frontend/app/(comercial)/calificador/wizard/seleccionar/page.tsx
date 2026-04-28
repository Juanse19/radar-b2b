import { Star } from 'lucide-react';
import { LineaSelectorClient } from '../components/LineaSelectorClient';

export default function SeleccionarLineaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Star size={20} className="text-primary" />
            Nueva Calificación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccioná la línea de negocio a calificar
          </p>
        </div>
      </div>

      <LineaSelectorClient />
    </div>
  );
}
