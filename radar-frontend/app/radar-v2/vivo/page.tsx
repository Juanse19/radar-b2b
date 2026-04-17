import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';

export default function VivoPage() {
  return (
    <Card className="p-8 text-center">
      <Activity size={32} className="mx-auto mb-3 text-muted-foreground/40" />
      <h1 className="mb-2 text-xl font-semibold">Vista en vivo</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Seguimiento en tiempo real de escaneos activos — próximamente (Fase G).
      </p>
      <Link href="/radar-v2">
        <Button variant="outline">Volver a landing</Button>
      </Link>
    </Card>
  );
}
