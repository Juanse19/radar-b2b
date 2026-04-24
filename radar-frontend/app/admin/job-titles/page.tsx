'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';

import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────

interface SubLineaRow {
  id: number;
  codigo: string;
  nombre: string;
}

interface JobTitleRow {
  id: number;
  sub_linea_id: number;
  titulo: string;
  nivel: number;
  idioma: string;
  prioridad: number;
  activo: boolean;
}

const NIVEL_LABELS: Record<number, string> = {
  1: 'C-Level',
  2: 'VP / Director',
  3: 'Gerente',
  4: 'Jefe / Coordinador',
  5: 'Analista',
};

const PRIO_LABELS: Record<number, string> = {
  1: 'Alta',
  2: 'Media',
  3: 'Baja',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminJobTitlesPage() {
  const qc = useQueryClient();
  const [selectedSubLinea, setSelectedSubLinea] = useState<string>('all');
  const [busqueda, setBusqueda] = useState('');
  const [newTitulo, setNewTitulo] = useState('');
  const [newNivel, setNewNivel] = useState('3');

  const { data: subLineas = [] } = useQuery<SubLineaRow[]>({
    queryKey: ['sub-lineas'],
    queryFn: () => fetch('/api/sub-lineas').then((r) => r.json()),
  });

  const qs = selectedSubLinea !== 'all' ? `?sub_linea_id=${selectedSubLinea}` : '';
  const { data: jobTitles = [], isLoading } = useQuery<JobTitleRow[]>({
    queryKey: ['job-titles', selectedSubLinea],
    queryFn: () => fetch(`/api/catalogos/job-titles${qs}`).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newTitulo.trim() || selectedSubLinea === 'all') return;
      const r = await fetch('/api/catalogos/job-titles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_linea_id: Number(selectedSubLinea),
          titulos: [{ titulo: newTitulo.trim(), nivel: Number(newNivel), prioridad: 2, idioma: 'es' }],
        }),
      });
      if (!r.ok) throw new Error('Error al agregar');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-titles'] });
      toast.success('Job title agregado');
      setNewTitulo('');
    },
    onError: () => toast.error('No se pudo agregar'),
  });

  const filtered = jobTitles.filter((jt) =>
    jt.titulo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Job Titles por Línea</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los títulos de trabajo que WF03 usa para buscar contactos en Apollo.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={selectedSubLinea} onValueChange={(v) => setSelectedSubLinea(v ?? '')}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por sub-línea" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sub-líneas</SelectItem>
            {subLineas.map((sl) => (
              <SelectItem key={sl.id} value={String(sl.id)}>{sl.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar título..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Add form */}
      {selectedSubLinea !== 'all' && (
        <div className="flex gap-2 mb-4 p-3 border rounded-lg bg-card">
          <Input
            placeholder="Nuevo job title..."
            value={newTitulo}
            onChange={(e) => setNewTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMutation.mutate()}
            className="flex-1"
          />
          <Select value={newNivel} onValueChange={(v) => setNewNivel(v ?? '2')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NIVEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => addMutation.mutate()} disabled={!newTitulo.trim() || addMutation.isPending}>
            {addMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando job titles...
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Título</th>
                <th className="text-left px-4 py-2.5 font-medium">Nivel</th>
                <th className="text-left px-4 py-2.5 font-medium">Prioridad</th>
                <th className="text-left px-4 py-2.5 font-medium">Idioma</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((jt) => (
                <tr key={jt.id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2.5 font-medium">{jt.titulo}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-xs">
                      {NIVEL_LABELS[jt.nivel] ?? `Nivel ${jt.nivel}`}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {PRIO_LABELS[jt.prioridad] ?? jt.prioridad}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{jt.idioma}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge variant={jt.activo ? 'default' : 'secondary'} className="text-xs">
                      {jt.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay job titles para esta sub-línea'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted text-xs text-muted-foreground">
              {filtered.length} título{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
