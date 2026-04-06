'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar } from 'lucide-react';
import { ExecutionStatusBadge } from '@/components/ExecutionStatus';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { SignalsByLineChart } from '@/components/dashboard/SignalsByLineChart';
import { ScoreDistributionChart } from '@/components/dashboard/ScoreDistributionChart';
import { RecentGoldSignals } from '@/components/dashboard/RecentGoldSignals';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import type { ResultadoRadar } from '@/lib/types';

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

  // Señales ORO recientes
  const { data: oroSignals = [], isLoading: loadingSignals } = useQuery<ResultadoRadar[]>({
    queryKey: ['signals', 'ORO', 10],
    queryFn: () => fetch('/api/signals?tier=ORO&limit=10&activos=true').then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    refetchInterval: activeExecution ? false : 5 * 60 * 1000,
  });

  // Estadísticas para charts
  const { data: stats, isLoading: loadingStats } = useQuery<SignalStats>({
    queryKey: ['signals', 'stats'],
    queryFn: () => fetch('/api/signals/stats').then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  // Conteo de contactos
  const { data: contactosCount = 0 } = useQuery<number>({
    queryKey: ['contactos', 'count'],
    queryFn: () => fetch('/api/contacts?count=true').then(r => r.json()).then(d => d.total ?? 0).catch(() => 0),
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
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400 text-sm">Señales de inversión B2B — Matec</p>
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
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
          >
            <Radar size={16} className="mr-2" />
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
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">Señales activas por línea</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalsByLineChart data={stats?.lineaCounts ?? {}} />
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">Distribución por tier</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreDistributionChart
              tierCounts={stats?.tierCounts ?? { ORO: 0, Monitoreo: 0, Contexto: 0, 'Sin Señal': 0 }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Feed señales ORO */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <span className="text-yellow-400">★</span>
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
