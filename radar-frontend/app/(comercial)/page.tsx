import { Radar, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { LineasSelectorGrid } from './components/landing/LineasSelectorGrid';

async function getCompanyCounts(): Promise<Record<string, number>> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/companies?count=true`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    return res.json() as Promise<Record<string, number>>;
  } catch {
    return {};
  }
}

export default async function ComercialLandingPage() {
  const counts = await getCompanyCounts();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Radar size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Radar de Inversiones</h1>
            <p className="text-sm text-muted-foreground">
              Detecta señales en LATAM antes que la competencia
            </p>
          </div>
        </div>
      </header>

      <LineasSelectorGrid counts={counts} />

      <div className="mt-8 border-t pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Herramientas adicionales
        </p>
        <Link
          href="/calificador"
          className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-4 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">Calificador de Cuentas</p>
            <p className="text-xs text-muted-foreground">
              Evalúa empresas por 7 dimensiones y genera scores ORO / MONITOREO / ARCHIVO
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
