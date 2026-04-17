import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EscanearPage() {
  return (
    <Card className="p-8 text-center">
      <h1 className="mb-2 text-xl font-semibold">Escanear — Wizard</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        El wizard de 3 pasos estará disponible próximamente.
      </p>
      <Link href="/radar-v2">
        <Button>Volver a landing</Button>
      </Link>
    </Card>
  );
}
