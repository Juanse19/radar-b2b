'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar } from 'lucide-react';
import { ExecutionStatusBadge } from '@/components/ExecutionStatus';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import type { ResultadoRadar } from '@/lib/types';
import { fetchJson, fetchJsonSafe } from '@/lib/fetcher';

// Charts pesados con Recharts (~150KB) → lazy.
// Skeleton mientras cargan: una caja con la altura final para evitar layout shift.
const ChartFallback = ({ h = 200 }: { h?: number }) => (
  <div className="animate-pulse rounded-lg bg-surface-muted/40" style={{ height: h }} />
);
const SignalsByLineChart = dynamic(
  () => import('@/components/dashboard/SignalsByLineChart').then(m => m.SignalsByLineChart),
  { ssr: false, loading: () => <ChartFallback h={200} /> },
);
const ScoreDistributionChart = dynamic(
  () => import('@/components/dashboard/ScoreDistributionChart').then(m => m.ScoreDistributionChart),
  { ssr: false, loading: () => <ChartFallback h={200} /> },
);
const RecentGoldSignals = dynamic(
  () => import('@/components/dashboard/RecentGoldSignals').then(m => m.RecentGoldSignals),
  { ssr: false, loading: () => <ChartFallback h={240} /> },
);

interface SignalStats {
  total: number;
  activos: number;
  oroHoy: number;
  tierCounts: { ORO: number; Monitoreo: number; Contexto: number; 'Sin Señal': number };
  lineaCounts: Record<string, number>;
}

export default function DashboardPage() {
  const [activeExecution, setActiveExecution] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Señales ORO recientes — fetchJsonSafe para que un 500 no rompa el dashboard
  const { data: oroSignals = [], isLoading: loadingSignals } = useQuery<ResultadoRadar[]>({
    queryKey: ['signals', 'ORO', 10],
    queryFn: async () => {
      const data = await fetchJsonSafe<unknown>('/api/signals?tier=ORO&limit=10&activos=true', []);
      return Array.isArray(data) ? (data as ResultadoRadar[]) : [];
    },
    refetchInterval: activeExecution ? false : 5 * 60 * 1000,
  });

  // Estadísticas para charts
  const { data: stats, isLoading: loadingStats } = useQuery<SignalStats>({
    queryKey: ['signals', 'stats'],
    queryFn: () => fetchJson<SignalStats>('/api/signals/stats'),
    staleTime: 2 * 60 * 1000,
  });

  // Conteo de contactos — silencioso si falla
  const { data: contactosCount = 0 } = useQuery<number>({
    queryKey: ['contactos', 'count'],
    queryFn: async () => {
      const d = await fetchJsonSafe<{ total?: number }>('/api/contacts?count=true', { total: 0 });
      return d.total ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  async function lanzarEscaneoRapido() {
    try {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea: 'BHS', batchSize: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al lanzar escaneo');
      setActiveExecution(data.executionId);
      toast.success('Escaneo rápido iniciado — BHS · 5 empresas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al lanzar escaneo');
    }
  }

  function onExecutionComplete() {
    setActiveExecution(null);
    queryClient.invalidateQueries({ queryKey: ['signals'] });
    toast.success('Escaneo completado. Resultados actualizados.');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-heading text-2xl font-semibold text-primary">Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">Señales de inversión B2B — Matec LATAM</p>
            <SystemStatus activeExecutionId={activeExecution} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeExecution && (
            <ExecutionStatusBadge
              executionId={activeExecution}
              onComplete={onExecutionComplete}
            />
          )}
          <Button
            onClick={lanzarEscaneoRapido}
            disabled={!!activeExecution}
            variant="primary"
          >
            <Radar size={16} />
            Escaneo rápido
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KPIGrid
        senalesOro={stats?.tierCounts?.ORO ?? 0}
        escaneadasHoy={stats?.total ?? 0}
        contactosExtraidos={contactosCount}
        isLoading={loadingStats}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Señales activas por línea</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalsByLineChart data={stats?.lineaCounts ?? {}} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución por tier</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreDistributionChart
              tierCounts={stats?.tierCounts ?? { ORO: 0, Monitoreo: 0, Contexto: 0, 'Sin Señal': 0 }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Feed señales ORO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-warning">★</span>
            Señales ORO — Top por Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecentGoldSignals signals={oroSignals} isLoading={loadingSignals} />
        </CardContent>
      </Card>
    </div>
  );
}
