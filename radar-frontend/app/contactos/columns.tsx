import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink } from 'lucide-react';
import { HubSpotStatusBadge } from '@/components/contactos/HubSpotStatusBadge';
import { LineaBadge } from '@/components/LineaBadge';
import type { Contacto, LineaNegocio } from '@/lib/types';

export function createContactsColumns(): ColumnDef<Contacto>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Seleccionar todo"
          className="border-border"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={v => row.toggleSelected(!!v)}
          onClick={e => e.stopPropagation()}
          aria-label="Seleccionar fila"
          className="border-border"
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground text-sm">{row.original.nombre}</p>
          {row.original.cargo && (
            <p className="text-xs text-muted-foreground">{row.original.cargo}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'empresaNombre',
      header: 'Empresa',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground truncate block max-w-[160px]" title={getValue<string>()}>
          {getValue<string>() || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'lineaNegocio',
      header: 'Línea',
      cell: ({ getValue }) => {
        const linea = getValue<string>();
        return linea ? <LineaBadge linea={linea as LineaNegocio} /> : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => {
        const email = getValue<string>();
        if (!email) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <a
            href={`mailto:${email}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {email}
          </a>
        );
      },
    },
    {
      accessorKey: 'telefono',
      header: 'Teléfono',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue<string>() || '—'}</span>
      ),
    },
    {
      accessorKey: 'hubspotStatus',
      header: 'HubSpot',
      cell: ({ getValue }) => <HubSpotStatusBadge status={getValue<string>()} />,
    },
    {
      accessorKey: 'linkedinUrl',
      header: '',
      enableSorting: false,
      cell: ({ getValue }) => {
        const url = getValue<string>();
        if (!url) return null;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-muted-foreground hover:text-muted-foreground"
            title="LinkedIn"
          >
            <ExternalLink size={13} />
          </a>
        );
      },
      size: 36,
    },
  ];
}
