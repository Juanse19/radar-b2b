import Link from 'next/link';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const FEATURES = [
  'Programa escaneos recurrentes por línea de negocio con frecuencia configurable (diaria, semanal, mensual)',
  'Notificaciones automáticas por email cuando se detectan señales ORO en el período programado',
  'Historial de ejecuciones con métricas de costo y tasa de activación por período',
];

export default function CronogramaPage() {
  return (
    <div className="mx-auto max-w-lg space-y-8 py-12">
      {/* Icon + title */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/30">
          <CalendarClock size={28} className="text-primary" />
        </div>
        <div className="mb-3 flex justify-center">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Próximamente en v5
          </Badge>
        </div>
        <h1 className="text-2xl font-bold">Programación Automática</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Programa escaneos automáticos por línea y frecuencia
        </p>
      </div>

      {/* Feature teaser */}
      <Card className="divide-y divide-border overflow-hidden p-0">
        {FEATURES.map((feat, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-4">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary/60" />
            <p className="text-sm text-muted-foreground">{feat}</p>
          </div>
        ))}
      </Card>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/escanear"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ejecutar manualmente ahora
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
