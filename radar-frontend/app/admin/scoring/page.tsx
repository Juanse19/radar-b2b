'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Badge }  from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────

interface ScoringRow {
  id: number;
  sub_linea_id: number | null;
  dimension: string;
  peso: number;
  vigente_desde: string;
}

interface SubLineaRow {
  id: number;
  codigo: string;
  nombre: string;
  linea?: { nombre: string };
}

const DIMENSION_LABELS: Record<string, string> = {
  impacto:    'Impacto presupuestal (25%)',
  anio:       'Año objetivo (15%)',
  recurrencia:'Recurrencia (15%)',
  multiplanta:'Multiplanta (15%)',
  ticket:     'Ticket estimado (10%)',
  referente:  'Referente de mercado (10%)',
  prioridad:  'Prioridad comercial (10%)',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminScoringPage() {
  const qc = useQueryClient();
  const [selectedSubLinea, setSelectedSubLinea] = useState<number | null>(null); // null = global
  const [pesos, setPesos] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

  const { data: subLineas = [] } = useQuery<SubLineaRow[]>({
    queryKey: ['sub-lineas'],
    queryFn: () => fetch('/api/sub-lineas').then((r) => r.json()),
  });

  const subLineaParam = selectedSubLinea === null ? 'null' : String(selectedSubLinea);
  const { data: scoringRows = [], isLoading } = useQuery<ScoringRow[]>({
    queryKey: ['scoring', subLineaParam],
    queryFn: () =>
      fetch(`/api/catalogos/scoring?sub_linea_id=${subLineaParam}`).then((r) => r.json()),
    select: (rows) => {
      // Build initial pesos map
      const map: Record<string, number> = {};
      for (const r of rows) {
        // sub-línea específico tiene prioridad sobre global
        if (!(r.dimension in map) || r.sub_linea_id !== null) {
          map[r.dimension] = r.peso;
        }
      }
      setPesos(map);
      setDirty(false);
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(pesos).map(([dimension, peso]) => ({
        sub_linea_id: selectedSubLinea,
        dimension,
        peso,
      }));
      const r = await fetch('/api/catalogos/scoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error('Error al guardar');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scoring'] });
      toast.success('Pesos guardados');
      setDirty(false);
    },
    onError: () => toast.error('No se pudo guardar'),
  });

  const total = Object.values(pesos).reduce((s, v) => s + Number(v), 0);
  const totalOk = Math.abs(total - 1) < 0.001;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configuración de Scoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ajusta los pesos de las 7 dimensiones de calificación (deben sumar 1.00).
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!dirty || !totalOk || saveMutation.isPending}>
          {saveMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>

      {/* Sub-línea selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedSubLinea(null)}
          className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
            selectedSubLinea === null
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card hover:bg-accent border-border'
          }`}
        >
          Global (default)
        </button>
        {subLineas.map((sl) => (
          <button
            key={sl.id}
            onClick={() => setSelectedSubLinea(sl.id)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              selectedSubLinea === sl.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:bg-accent border-border'
            }`}
          >
            {sl.nombre}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {Object.entries(DIMENSION_LABELS).map(([dim, label]) => (
              <div key={dim}
                   className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                <div className="flex-1">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dim}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-24 text-right"
                    value={pesos[dim] ?? 0}
                    onChange={(e) => {
                      setPesos((p) => ({ ...p, [dim]: Number(e.target.value) }));
                      setDirty(true);
                    }}
                  />
                  <span className="text-sm text-muted-foreground w-10">
                    {((pesos[dim] ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            totalOk ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            <Info className="h-4 w-4 flex-shrink-0" />
            Total: <strong>{total.toFixed(2)}</strong>
            {totalOk ? ' ✓ Los pesos suman 1.00' : ' — Deben sumar exactamente 1.00'}
          </div>
        </>
      )}
    </div>
  );
}
