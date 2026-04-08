'use client';
// app/admin/lineas/page.tsx — Business line management

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';

interface LineaNegocio {
  id: number;
  nombre: string;
  descripcion: string | null;
  color_hex: string;
  icono: string;
  activo: boolean;
  orden: number;
}

export default function LineasPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', color_hex: '#6366f1', icono: 'Layers', orden: '0' });

  const { data: lineas = [], isLoading } = useQuery<LineaNegocio[]>({
    queryKey: ['admin-lineas'],
    queryFn: () => fetchJson<LineaNegocio[]>('/api/admin/lineas'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      fetchJson(`/api/admin/lineas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lineas'] });
      toast.success('Línea actualizada');
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/admin/lineas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orden: Number(form.orden) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lineas'] });
      toast.success('Línea creada');
      setShowCreate(false);
      setForm({ nombre: '', descripcion: '', color_hex: '#6366f1', icono: 'Layers', orden: '0' });
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Líneas de negocio</h1>
          <p className="text-sm text-muted-foreground">Configura las líneas activas y su metadata</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus size={15} /> Nueva línea
        </Button>
      </div>

      {showCreate && (
        <Card className="border-blue-700/50 bg-blue-950/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Nueva línea de negocio</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nombre (ej. BHS)" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <Input placeholder="Descripción" value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
              <div className="flex items-center gap-2">
                <Input type="color" value={form.color_hex}
                  onChange={e => setForm(p => ({ ...p, color_hex: e.target.value }))}
                  className="w-16 h-9 p-1 cursor-pointer" />
                <span className="text-xs text-muted-foreground">Color</span>
              </div>
              <Input placeholder="Icono (lucide name)" value={form.icono}
                onChange={e => setForm(p => ({ ...p, icono: e.target.value }))} />
              <Input type="number" placeholder="Orden" value={form.orden}
                onChange={e => setForm(p => ({ ...p, orden: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.nombre}
                className="bg-blue-600 hover:bg-blue-700 gap-2">
                {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Crear
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-2">
                <X size={13} /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando líneas…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50">
                <tr className="text-left">
                  {['Nombre', 'Descripción', 'Color', 'Orden', 'Activa'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {lineas.map(l => (
                  <tr key={l.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color_hex }} />
                        {l.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{l.descripcion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{l.color_hex}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{l.orden}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => patchMutation.mutate({ id: l.id, updates: { activo: !l.activo } })}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                          l.activo ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {l.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {l.activo ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
