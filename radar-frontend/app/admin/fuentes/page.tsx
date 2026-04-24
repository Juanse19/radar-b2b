'use client';
// app/admin/fuentes/page.tsx — Search sources management

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, PencilLine, ToggleLeft, ToggleRight } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

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
type Tipo = (typeof TIPOS)[number];

const TIPO_BADGE: Record<string, string> = {
  tavily:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rss:      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  scraping: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  api:      'bg-violet-500/15 text-violet-300 border-violet-500/30',
  manual:   'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  const cls = TIPO_BADGE[tipo] ?? 'bg-surface-muted text-muted-foreground border-border';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {tipo}
    </span>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const cls = score >= 8
    ? 'text-green-400'
    : score >= 5
    ? 'text-amber-400'
    : 'text-muted-foreground';
  return (
    <span className={`tabular-nums text-sm font-semibold ${cls}`}>
      {score}<span className="text-xs font-normal text-muted-foreground">/10</span>
    </span>
  );
}

const EMPTY_FORM = {
  nombre: '',
  url_base: '',
  tipo: 'tavily' as Tipo,
  priority_score: '5',
  notas: '',
};

// ── Create Dialog ───────────────────────────────────────────────────────────

function CreateFuenteDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/admin/fuentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, priority_score: Number(form.priority_score) }),
      }),
    onSuccess: () => {
      toast.success('Fuente creada');
      setForm(EMPTY_FORM);
      onSuccess();
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva fuente de búsqueda</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            type="url"
            placeholder="URL base"
            value={form.url_base}
            onChange={(e) => setForm((p) => ({ ...p, url_base: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as Tipo }))}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min="1"
            max="10"
            placeholder="Prioridad (1-10)"
            value={form.priority_score}
            onChange={(e) => setForm((p) => ({ ...p, priority_score: e.target.value }))}
          />
          <textarea
            placeholder="Notas (opcional)"
            value={form.notas}
            onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
            rows={2}
            className="sm:col-span-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.nombre}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────────

function EditFuenteDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: Fuente | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    url_base: item?.url_base ?? '',
    tipo: (item?.tipo ?? 'tavily') as Tipo,
    priority_score: String(item?.priority_score ?? 5),
    notas: item?.notas ?? '',
    activa: item?.activa ?? true,
  });

  // Sync form when item changes
  const [lastItemId, setLastItemId] = useState<number | null>(null);
  if (item && item.id !== lastItemId) {
    setLastItemId(item.id);
    setForm({
      nombre: item.nombre,
      url_base: item.url_base ?? '',
      tipo: (item.tipo ?? 'tavily') as Tipo,
      priority_score: String(item.priority_score),
      notas: item.notas ?? '',
      activa: item.activa,
    });
  }

  const editMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/admin/fuentes/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, priority_score: Number(form.priority_score) }),
      }),
    onSuccess: () => {
      toast.success('Fuente actualizada');
      onSuccess();
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar fuente — {item?.nombre}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            type="url"
            placeholder="URL base"
            value={form.url_base}
            onChange={(e) => setForm((p) => ({ ...p, url_base: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as Tipo }))}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min="1"
            max="10"
            placeholder="Prioridad (1-10)"
            value={form.priority_score}
            onChange={(e) => setForm((p) => ({ ...p, priority_score: e.target.value }))}
          />
          <textarea
            placeholder="Notas (opcional)"
            value={form.notas}
            onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
            rows={2}
            className="sm:col-span-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, activa: !p.activa }))}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                form.activa
                  ? 'text-green-400 hover:text-green-300'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {form.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.activa ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={editMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => editMutation.mutate()}
            disabled={editMutation.isPending || !form.nombre}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {editMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function FuentesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Fuente | null>(null);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fuentes'] });
      toast.success('Fuente actualizada');
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ['admin-fuentes'] });
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Fuentes' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fuentes de búsqueda</h1>
          <p className="text-sm text-muted-foreground">Fuentes de información usadas por los agentes IA</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus size={15} /> Nueva fuente
        </Button>
      </div>

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
                  {['Nombre', 'Tipo', 'Prioridad', 'URL', 'Activa', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {fuentes.map((f) => (
                  <tr key={f.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{f.nombre}</td>
                    <td className="px-4 py-3">
                      <TipoBadge tipo={f.tipo} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge score={f.priority_score} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                      {f.url_base ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          patchMutation.mutate({ id: f.id, updates: { activa: !f.activa } })
                        }
                        className={`flex items-center gap-1 text-xs font-medium ${
                          f.activa
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {f.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {f.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditItem(f)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <PencilLine size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CreateFuenteDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      <EditFuenteDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSuccess={() => {
          setEditItem(null);
          refetch();
        }}
      />
    </div>
  );
}
