import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function CronogramaPage() {
  return (
    <Card className="p-8 text-center">
      <Calendar size={32} className="mx-auto mb-3 text-muted-foreground/40" />
      <h1 className="mb-2 text-xl font-semibold">Cronograma</h1>
      <p className="text-sm text-muted-foreground">
        Programación automática de escaneos — próximamente.
      </p>
    </Card>
  );
}
