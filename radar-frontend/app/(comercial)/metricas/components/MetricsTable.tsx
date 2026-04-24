'use client';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface LineaData {
  linea:       string;
  scans:       number;
  activas:     number;
  descartadas: number;
  costo:       number;
}

interface Props {
  data: LineaData[];
}

export function MetricsTable({ data }: Props) {
  if (!data.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 text-xs text-muted-foreground">
            <TableHead className="font-medium">Línea de negocio</TableHead>
            <TableHead className="text-right font-medium">Scans</TableHead>
            <TableHead className="text-right font-medium">Activas</TableHead>
            <TableHead className="text-right font-medium">Descartadas</TableHead>
            <TableHead className="text-right font-medium">% Activas</TableHead>
            <TableHead className="text-right font-medium">Costo USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => {
            const total = row.activas + (row.descartadas ?? 0);
            const pct = total > 0
              ? ((row.activas / total) * 100).toFixed(1)
              : '0.0';

            return (
              <TableRow key={i} className="text-sm">
                <TableCell className="font-medium">{row.linea}</TableCell>
                <TableCell className="text-right">{row.scans}</TableCell>
                <TableCell className="text-right text-green-700 dark:text-green-400">
                  {row.activas}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {row.descartadas ?? 0}
                </TableCell>
                <TableCell className="text-right">{pct}%</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  ${row.costo.toFixed(4)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
