'use client';

/**
 * /calificador/live — vista standalone del progreso de calificación.
 *
 * V3: el panel consume el store Zustand. Esta ruta queda como standalone
 * por compatibilidad con bookmarks viejos; el flujo nuevo va por el tab
 * "Nueva calificación" en /calificador?tab=nueva.
 */
import { CalificadorLivePanel } from '../components/CalificadorLivePanel';

export default function CalificadorLivePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calificación en vivo</h1>
        <p className="text-sm text-muted-foreground">
          Progreso de la sesión activa. Puedes navegar a otras secciones — el
          escaneo continúa en segundo plano y verás un indicador flotante
          mientras esté en curso.
        </p>
      </div>
      <CalificadorLivePanel />
    </div>
  );
}
