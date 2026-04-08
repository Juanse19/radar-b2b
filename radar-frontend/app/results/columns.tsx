import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, Radar, Loader2 } from 'lucide-react';
import { ScoreBadge } from '@/components/ScoreBadge';
import { LineaBadge } from '@/components/LineaBadge';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import type { ResultadoRadar, LineaNegocio } from '@/lib/types';

// ── Inline Re-scan button ─────────────────────────────────────────────────────
// Each row gets its own local state so multiple rows can be in-flight
// independently without affecting each other.

interface RescanButtonProps {
  signal: ResultadoRadar;
  onFired: (executionId: string) => void;
}

function RescanButton({ signal, onFired }: RescanButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleRescan(e: React.MouseEvent) {
    e.stopPropagation(); // don't open the detail sheet
    setLoading(true);
    try {
      const result = await fetchJson<{ execution_id: string; pipeline_id: string }>(
        '/api/agent',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: 'radar',
            linea: signal.linea,
            options: {
              empresa:            signal.empresa,
              pais:               signal.pais,
              company_domain:     signal.dominio ?? '',
              tier:               signal.tier ?? 'MONITOREO',
              score_calificacion: signal.scoreRadar ?? 5,
            },
          }),
        },
      );
      toast.success(`Radar iniciado para ${signal.empresa}`);
      onFired(result.execution_id);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error';
      toast.error(`No se pudo iniciar: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRescan}
      disabled={loading}
      title="Re-escanear con el Radar de Inversión (WF02)"
      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
    >
      {loading
        ? <Loader2 size={11} className="animate-spin" />
        : <Radar size={11} />}
      Re-escanear
    </button>
  );
}

// ── Column factory ────────────────────────────────────────────────────────────

export function createResultsColumns(
  onVerDetalle: (signal: ResultadoRadar) => void,
  onRescanFired?: (executionId: string, empresa: string) => void,
): ColumnDef<ResultadoRadar>[] {
  return [
    {
      accessorKey: 'empresa',
      header: 'Empresa',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[180px]" title={row.original.empresa}>
            {row.original.empresa}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.pais}</p>
        </div>
      ),
    },
    {
      accessorKey: 'linea',
      header: 'Línea',
      cell: ({ getValue }) => <LineaBadge linea={getValue<LineaNegocio>()} />,
    },
    {
      accessorKey: 'radarActivo',
      header: 'Estado',
      cell: ({ getValue }) => {
        const activo = getValue<string>() === 'Sí';
        return (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            activo ? 'bg-green-900/60 text-green-300 border border-green-800' : 'bg-surface-muted text-muted-foreground border border-border'
          }`}>
            {activo ? '🟢 Activo' : '⚫ Sin señal'}
          </span>
        );
      },
    },
    {
      accessorKey: 'tipoSenal',
      header: 'Tipo señal',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground max-w-[140px] truncate block" title={getValue<string>()}>
          {getValue<string>() || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'scoreRadar',
      header: 'Score / Tier',
      sortingFn: 'basic',
      cell: ({ getValue }) => <ScoreBadge score={getValue<number>()} />,
    },
    {
      accessorKey: 'ventanaCompra',
      header: 'Ventana',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'fuenteUrl',
      header: 'Fuente',
      enableSorting: false,
      cell: ({ row }) => {
        const url = row.original.fuenteUrl;
        if (!url) return <span className="text-xs text-gray-600">—</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <ExternalLink size={11} />
            {row.original.fuente || 'Ver'}
          </a>
        );
      },
    },
    {
      id: 'acciones',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onVerDetalle(row.original); }}
            className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
          >
            Ver detalle →
          </button>
          {onRescanFired && (
            <RescanButton
              signal={row.original}
              onFired={(execId) => onRescanFired(execId, row.original.empresa)}
            />
          )}
        </div>
      ),
    },
  ];
}
