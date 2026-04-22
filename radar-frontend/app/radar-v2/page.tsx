import { Radar } from 'lucide-react';
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

export default async function RadarV2LandingPage() {
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
    </div>
  );
}
