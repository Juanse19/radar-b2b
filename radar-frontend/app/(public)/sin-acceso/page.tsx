import { ShieldX } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Sin acceso — Matec Radar B2B',
};

export default function SinAccesoPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <ShieldX size={48} className="mx-auto text-red-500" />
        <h1 className="text-2xl font-bold text-foreground">Sin acceso</h1>
        <p className="text-muted-foreground">
          No tienes permisos para acceder a esta sección.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
