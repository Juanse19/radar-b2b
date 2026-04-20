'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Building2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchJson } from '@/lib/fetcher';
import type { LineaNegocio } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmpresaListItem {
  id: number;
  nombre: string;
  pais: string | null;
  linea: string | null;
  tier: string | null;
  dominio: string | null;
  status: string;
}

type LineaCounts = Record<string, number>;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const LINEA_OPTIONS: { value: LineaNegocio | 'ALL'; label: string }[] = [
  { value: 'ALL',            label: 'Todas las líneas' },
  { value: 'BHS',            label: 'BHS (Aeropuertos)' },
  { value: 'Cartón',         label: 'Cartón / Corrugado' },
  { value: 'Intralogística', label: 'Intralogística' },
  { value: 'Final de Línea', label: 'Final de Línea' },
  { value: 'Motos',          label: 'Motos' },
  { value: 'SOLUMAT',        label: 'SOLUMAT' },
];

const TIER_COLORS: Record<string, string> = {
  ORO:       'bg-amber-100 text-amber-800 border-amber-300',
  MONITOREO: 'bg-blue-100 text-blue-800 border-blue-300',
  ARCHIVO:   'bg-gray-100 text-gray-600 border-gray-300',
};

function tierBadge(tier: string | null) {
  if (!tier) return <Badge variant="outline" className="text-gray-400">—</Badge>;
  const cls = TIER_COLORS[tier.toUpperCase()] ?? TIER_COLORS['ARCHIVO'];
  return <Badge variant="outline" className={cls}>{tier}</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmpresasPage() {
  const router = useRouter();
  const [linea, setLinea] = useState<string>('ALL');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);

  // Counts by linea for the badge
  const { data: counts } = useQuery<LineaCounts>({
    queryKey: ['empresas-counts'],
    queryFn: () => fetchJson('/api/companies?count=true'),
    staleTime: 60_000,
  });

  const offset = page * PAGE_SIZE;

  const { data: empresas = [], isFetching, error } = useQuery<EmpresaListItem[]>({
    queryKey: ['empresas', linea, offset],
    queryFn: async () => {
      const res = await fetchJson<EmpresaListItem[]>(
        `/api/companies?linea=${encodeURIComponent(linea)}&limit=${PAGE_SIZE}&offset=${offset}`,
      );
      if (res === null || res === undefined) return [];
      return res;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Redirect on 401 handled by fetchJson throwing — catch in error boundary or check
  if (error instanceof Error && error.message.includes('401')) {
    router.push('/login');
    return null;
  }

  // Client-side name filter (server returns all for the linea)
  const filtered = busqueda.trim()
    ? empresas.filter(e =>
        e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (e.dominio ?? '').toLowerCase().includes(busqueda.toLowerCase()),
      )
    : empresas;

  const totalCount = linea === 'ALL'
    ? Object.values(counts ?? {}).reduce((s, v) => s + v, 0)
    : (counts?.[linea] ?? 0);

  const activeCount = linea !== 'ALL' ? (counts?.[linea] ?? null) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Base de Datos de Empresas</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount > 0 ? `${totalCount.toLocaleString()} empresas en total` : 'Cargando…'}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o dominio…"
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>

            {/* Line filter */}
            <div className="flex items-center gap-2">
              <Select
                value={linea}
                onValueChange={v => { if (v) { setLinea(v); setPage(0); setBusqueda(''); } }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Línea de negocio" />
                </SelectTrigger>
                <SelectContent>
                  {LINEA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                      {o.value !== 'ALL' && counts?.[o.value] !== undefined
                        ? ` (${counts[o.value]})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeCount !== null && (
                <Badge variant="secondary" className="text-sm">
                  {activeCount} empresas
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            {isFetching ? 'Cargando…' : `${filtered.length} empresas`}
            {busqueda && ` — filtro: "${busqueda}"`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Empresa</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Dominio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {isFetching ? 'Cargando empresas…' : 'No se encontraron empresas'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(e => (
                    <TableRow key={e.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">{e.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{e.pais ?? '—'}</TableCell>
                      <TableCell>
                        {e.linea
                          ? <Badge variant="outline" className="text-xs">{e.linea}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{tierBadge(e.tier)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.dominio
                          ? <a href={`https://${e.dominio}`} target="_blank" rel="noopener noreferrer"
                              className="hover:underline">{e.dominio}</a>
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!busqueda && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} · mostrando {offset + 1}–{offset + Math.min(PAGE_SIZE, empresas.length)} de {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={empresas.length < PAGE_SIZE}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
