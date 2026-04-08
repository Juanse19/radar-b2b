'use client';
// app/admin/fuentes/page.tsx — Search sources management

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';

interface Fuente {
  id: number;
  nombre: string;
  url_base: string | null;
  tipo: string | null;
  lineas: string[] | null;
  priority_score: number;
  activa: boolean;
  notas: string | null;
}

const TIPOS = ['tavily', 'rss', 'scraping', 'api', 'manual'] as const;

export default function FuentesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: '', url_base: '', tipo: 'tavily', priority_score: '5', notas: '' });

  const { data: fuentes = [], isLoading } = useQuery<Fuente[]>({
    queryKey: ['admin-fuentes'],
    queryFn: () => fetchJson<Fuente[]>('/api/admin/fuentes'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      fetchJson(`/api/admin/fuentes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fuentes'] }); toast.success('Fuente actualizada'); },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/admin/fuentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, priority_score: Number(form.priority_score) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fuentes'] });
      toast.success('Fuente creada');
      setShowCreate(false);
      setForm({ nombre: '', url_base: '', tipo: 'tavily', priority_score: '5', notas: '' });
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fuentes de búsqueda</h1>
          <p className="text-sm text-muted-foreground">Fuentes de información usadas por los agentes IA</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus size={15} /> Nueva fuente
        </Button>
      </div>

      {showCreate && (
        <Card className="border-blue-700/50 bg-blue-950/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Nueva fuente</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nombre" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <Input placeholder="URL base" value={form.url_base}
                onChange={e => setForm(p => ({ ...p, url_base: e.target.value }))} />
              <select value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground">
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input type="number" min="1" max="10" placeholder="Prioridad (1-10)" value={form.priority_score}
                onChange={e => setForm(p => ({ ...p, priority_score: e.target.value }))} />
              <Input placeholder="Notas" value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                className="sm:col-span-2" />
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
              <Loader2 size={16} className="animate-spin" /> Cargando fuentes…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50">
                <tr className="text-left">
                  {['Nombre', 'Tipo', 'Prioridad', 'URL', 'Activa'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {fuentes.map(f => (
                  <tr key={f.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{f.nombre}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-surface-muted border border-border text-muted-foreground">
                        {f.tipo ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.priority_score}/10</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                      {f.url_base ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => patchMutation.mutate({ id: f.id, updates: { activa: !f.activa } })}
                        className={`flex items-center gap-1 text-xs font-medium ${
                          f.activa ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {f.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {f.activa ? 'Activa' : 'Inactiva'}
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
