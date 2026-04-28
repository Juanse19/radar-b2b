'use client';
// app/admin/lineas/page.tsx — Business line management

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
import { Loader2, Plus, PencilLine, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

interface LineaNegocio {
  id: number;
  nombre: string;
  descripcion: string | null;
  color_hex: string;
  icono: string;
  activo: boolean;
  orden: number;
}

interface SubLineaNegocio {
  id: number;
  linea_id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
  linea?: { id: number; nombre: string; color_hex: string };
}

const EMPTY_FORM = {
  nombre: '',
  descripcion: '',
  color_hex: '#71acd2',
  icono: 'Layers',
  orden: '99',
};

// ── Create Dialog ───────────────────────────────────────────────────────────

function CreateLineaDialog({
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
      fetchJson('/api/admin/lineas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orden: Number(form.orden) }),
      }),
    onSuccess: () => {
      toast.success('Línea creada');
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
          <DialogTitle>Nueva línea de negocio</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input
            placeholder="Nombre (ej. BHS)"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={form.color_hex}
              onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))}
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Color</span>
          </div>
          <Input
            placeholder="Icono (lucide name, ej. Layers)"
            value={form.icono}
            onChange={(e) => setForm((p) => ({ ...p, icono: e.target.value }))}
          />
          <Input
            type="number"
            placeholder="Orden"
            value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))}
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
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────────

function EditLineaDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: LineaNegocio | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM & { activo: boolean }>({
    nombre: item?.nombre ?? '',
    descripcion: item?.descripcion ?? '',
    color_hex: item?.color_hex ?? '#71acd2',
    icono: item?.icono ?? 'Layers',
    orden: String(item?.orden ?? 99),
    activo: item?.activo ?? true,
  });

  // Sync form when item changes
  const [lastItemId, setLastItemId] = useState<number | null>(null);
  if (item && item.id !== lastItemId) {
    setLastItemId(item.id);
    setForm({
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      color_hex: item.color_hex,
      icono: item.icono,
      orden: String(item.orden),
      activo: item.activo,
    });
  }

  const editMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/admin/lineas/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orden: Number(form.orden) }),
      }),
    onSuccess: () => {
      toast.success('Línea actualizada');
      onSuccess();
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar línea — {item?.nombre}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={form.color_hex}
              onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))}
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Color</span>
          </div>
          <Input
            placeholder="Icono (lucide name)"
            value={form.icono}
            onChange={(e) => setForm((p) => ({ ...p, icono: e.target.value }))}
          />
          <Input
            type="number"
            placeholder="Orden"
            value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, activo: !p.activo }))}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                form.activo
                  ? 'text-green-400 hover:text-green-300'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {form.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.activo ? 'Activa' : 'Inactiva'}
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

// ── Create SubLinea Dialog ───────────────────────────────────────────────────

const EMPTY_SUB_FORM = {
  nombre: '',
  codigo: '',
  descripcion: '',
  orden: '99',
};

function CreateSubLineaDialog({
  open,
  lineaId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  lineaId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(EMPTY_SUB_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/sub-lineas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          linea_id: lineaId,
          orden: Number(form.orden),
          activo: true,
        }),
      }),
    onSuccess: () => {
      toast.success('Sub-línea creada');
      setForm(EMPTY_SUB_FORM);
      onSuccess();
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sub-línea</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input
            placeholder="Nombre (ej. Aeropuertos)"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            placeholder="Código (ej. BHS_AEROP)"
            value={form.codigo}
            onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
            required
          />
          <Input
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            className="sm:col-span-2"
          />
          <Input
            type="number"
            placeholder="Orden"
            value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.nombre || !form.codigo}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SubLineas Section ────────────────────────────────────────────────────────

function SubLineasSection({ lineas }: { lineas: LineaNegocio[] }) {
  const qc = useQueryClient();
  const [selectedLineaId, setSelectedLineaId] = useState<number | null>(null);
  const [createSubOpen, setCreateSubOpen] = useState(false);

  const { data: allSublineas = [], isLoading } = useQuery<SubLineaNegocio[]>({
    queryKey: ['admin-sublineas'],
    queryFn: () => fetchJson<SubLineaNegocio[]>('/api/sub-lineas'),
  });

  // Client-side filter
  const sublineas = selectedLineaId === null
    ? allSublineas
    : allSublineas.filter((s) => s.linea_id === selectedLineaId);

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/api/sub-lineas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sublineas'] });
      toast.success('Sub-línea eliminada');
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      fetchJson(`/api/sub-lineas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sublineas'] });
      toast.success('Sub-línea actualizada');
    },
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sub-líneas</h2>
          <p className="text-xs text-muted-foreground">
            {allSublineas.length} sub-línea{allSublineas.length !== 1 ? 's' : ''} en total
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Line filter dropdown */}
          <Select
            value={selectedLineaId === null ? 'all' : String(selectedLineaId)}
            onValueChange={(v) => setSelectedLineaId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Todas las líneas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las líneas</SelectItem>
              {lineas.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setCreateSubOpen(true)}
            disabled={selectedLineaId === null}
            title={selectedLineaId === null ? 'Selecciona una línea primero' : 'Nueva sub-línea'}
            className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            <Plus size={13} /> Nueva sub-línea
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando sub-líneas…
            </div>
          ) : sublineas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {selectedLineaId === null
                ? 'No hay sub-líneas registradas.'
                : 'Esta línea no tiene sub-líneas.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50">
                <tr className="text-left">
                  {['Línea', 'Nombre', 'Código', 'Descripción', 'Orden', 'Activa', ''].map((h, i) => (
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
                {sublineas.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/30 transition-colors">
                    {/* Línea column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.linea?.color_hex ?? '#888' }}
                        />
                        <span className="text-xs font-medium text-foreground">
                          {s.linea?.nombre ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{s.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.codigo}</td>
                    <td
                      className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[160px]"
                      title={s.descripcion ?? undefined}
                    >
                      {s.descripcion ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.orden}</td>
                    {/* Toggle activa/inactiva */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate({ id: s.id, activo: !s.activo })}
                        title={s.activo ? 'Desactivar sub-línea' : 'Activar sub-línea'}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors rounded-md px-2 py-1 ${
                          s.activo
                            ? 'text-green-600 bg-green-500/10 hover:bg-green-500/20'
                            : 'text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {s.activo
                          ? <ToggleRight size={18} className="text-green-500" />
                          : <ToggleLeft size={18} />
                        }
                        {s.activo ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar sub-línea "${s.nombre}"?`)) {
                            deleteMutation.mutate(s.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selectedLineaId !== null && (
        <CreateSubLineaDialog
          open={createSubOpen}
          lineaId={selectedLineaId}
          onClose={() => setCreateSubOpen(false)}
          onSuccess={() => {
            setCreateSubOpen(false);
            qc.invalidateQueries({ queryKey: ['admin-sublineas'] });
          }}
        />
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LineasPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<LineaNegocio | null>(null);

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
    onError: (err) =>
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ['admin-lineas'] });
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Líneas de Negocio' },
        ]}
      />

      {/* ── Líneas de negocio ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Líneas de negocio</h1>
            <p className="text-sm text-muted-foreground">Configura las líneas activas y su metadata</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus size={15} /> Nueva línea
          </Button>
        </div>

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
                    {['Nombre', 'Descripción', 'Color', 'Orden', 'Activa', ''].map((h, i) => (
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
                  {lineas.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: l.color_hex }}
                          />
                          {l.nombre}
                        </div>
                      </td>
                      {/* Descripción truncada con tooltip */}
                      <td
                        className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]"
                        title={l.descripcion ?? undefined}
                      >
                        {l.descripcion ?? '—'}
                      </td>
                      {/* Color: swatch + hex en gris pequeño */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: l.color_hex }}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{l.color_hex}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{l.orden}</td>
                      {/* Toggle activo/inactivo */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            patchMutation.mutate({ id: l.id, updates: { activo: !l.activo } })
                          }
                          title={l.activo ? 'Desactivar línea' : 'Activar línea'}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors rounded-md px-2 py-1 ${
                            l.activo
                              ? 'text-green-600 bg-green-500/10 hover:bg-green-500/20'
                              : 'text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {l.activo
                            ? <ToggleRight size={18} className="text-green-500" />
                            : <ToggleLeft size={18} />
                          }
                          {l.activo ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditItem(l)}
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
      </div>

      {/* ── Sub-líneas ── */}
      <SubLineasSection lineas={lineas} />

      <CreateLineaDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      <EditLineaDialog
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
