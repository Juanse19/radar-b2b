import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink } from 'lucide-react';
import { ScoreBadge } from '@/components/ScoreBadge';
import { LineaBadge } from '@/components/LineaBadge';
import type { ResultadoRadar, LineaNegocio } from '@/lib/types';

export function createResultsColumns(
  onVerDetalle: (signal: ResultadoRadar) => void,
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
      id: 'detalle',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onVerDetalle(row.original); }}
          className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
        >
          Ver detalle →
        </button>
      ),
    },
  ];
}
