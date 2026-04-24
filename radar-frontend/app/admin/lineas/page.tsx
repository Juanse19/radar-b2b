'use client';
// app/admin/lineas/page.tsx — Business line + sub-line management

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
import { Loader2, Plus, PencilLine, ToggleLeft, ToggleRight, Trash2, Tag } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

// ── Types ────────────────────────────────────────────────────────────────────

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
  activa: boolean;
  orden: number;
}

const LINEA_EMPTY = { nombre: '', descripcion: '', color_hex: '#71acd2', icono: 'Layers', orden: '99' };

// ── Shared Confirm Delete Dialog ─────────────────────────────────────────────

function ConfirmDeleteDialog({
  open, label, onConfirm, onCancel,
}: { open: boolean; label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar &quot;{label}&quot;?</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
          </p>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Línea Dialog ──────────────────────────────────────────────────────

function CreateLineaDialog({
  open, onClose, onSuccess,
}: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState(LINEA_EMPTY);

  const mut = useMutation({
    mutationFn: () =>
      fetchJson('/api/admin/lineas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orden: Number(form.orden) }),
      }),
    onSuccess: () => { toast.success('Línea creada'); setForm(LINEA_EMPTY); onSuccess(); },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva línea de negocio</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input placeholder="Nombre (ej. BHS)" value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
          <Input placeholder="Descripción" value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
          <div className="flex items-center gap-2">
            <Input type="color" value={form.color_hex}
              onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))}
              className="w-16 h-9 p-1 cursor-pointer" />
            <span className="text-xs text-muted-foreground">Color</span>
          </div>
          <Input placeholder="Icono (lucide, ej. Layers)" value={form.icono}
            onChange={(e) => setForm((p) => ({ ...p, icono: e.target.value }))} />
          <Input type="number" placeholder="Orden" value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nombre}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            {mut.isPending && <Loader2 size={13} className="animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Línea Dialog ────────────────────────────────────────────────────────

function EditLineaDialog({
  item, onClose, onSuccess,
}: { item: LineaNegocio | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<typeof LINEA_EMPTY & { activo: boolean }>({
    nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '',
    color_hex: item?.color_hex ?? '#71acd2', icono: item?.icono ?? 'Layers',
    orden: String(item?.orden ?? 99), activo: item?.activo ?? true,
  });

  const [lastId, setLastId] = useState<number | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '',
      color_hex: item.color_hex, icono: item.icono,
      orden: String(item.orden), activo: item.activo });
  }

  const mut = useMutation({
    mutationFn: () =>
      fetchJson(`/api/admin/lineas/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orden: Number(form.orden) }),
      }),
    onSuccess: () => { toast.success('Línea actualizada'); onSuccess(); },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar línea — {item?.nombre}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input placeholder="Nombre" value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
          <Input placeholder="Descripción" value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
          <div className="flex items-center gap-2">
            <Input type="color" value={form.color_hex}
              onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))}
              className="w-16 h-9 p-1 cursor-pointer" />
            <span className="text-xs text-muted-foreground">Color</span>
          </div>
          <Input placeholder="Icono (lucide name)" value={form.icono}
            onChange={(e) => setForm((p) => ({ ...p, icono: e.target.value }))} />
          <Input type="number" placeholder="Orden" value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm((p) => ({ ...p, activo: !p.activo }))}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                form.activo ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {form.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.activo ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nombre}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            {mut.isPending && <Loader2 size={13} className="animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create / Edit SubLínea Dialog ────────────────────────────────────────────

function SubLineaDialog({
  lineaId, item, onClose, onSuccess,
}: { lineaId: number; item: SubLineaNegocio | null; onClose: () => void; onSuccess: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nombre:      item?.nombre      ?? '',
    codigo:      item?.codigo      ?? '',
    descripcion: item?.descripcion ?? '',
    orden:       String(item?.orden ?? 99),
    activa:      item?.activa      ?? true,
  });

  const [lastId, setLastId] = useState<number | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setForm({ nombre: item.nombre, codigo: item.codigo,
      descripcion: item.descripcion ?? '', orden: String(item.orden), activa: item.activa });
  }

  const mut = useMutation({
    mutationFn: () => {
      const body = { ...form, orden: Number(form.orden), linea_id: lineaId };
      return isEdit
        ? fetchJson(`/api/sub-lineas/${item!.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : fetchJson('/api/sub-lineas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
    },
    onSuccess: () => { toast.success(isEdit ? 'Sublínea actualizada' : 'Sublínea creada'); onSuccess(); },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar sublínea — ${item?.nombre}` : 'Nueva sublínea'}</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <Input placeholder="Nombre (ej. Logística)" value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
          <Input placeholder="Código (ej. logistica)" value={form.codigo}
            onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} />
          <Input placeholder="Descripción" value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            className="sm:col-span-2" />
          <Input type="number" placeholder="Orden" value={form.orden}
            onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm((p) => ({ ...p, activa: !p.activa }))}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                form.activa ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {form.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.activa ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nombre || !form.codigo}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            {mut.isPending && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SubLíneas Section ────────────────────────────────────────────────────────

function SubLineasSection({ lineas }: { lineas: LineaNegocio[] }) {
  const qc = useQueryClient();
  const [selectedLineaId, setSelectedLineaId] = useState<number | null>(
    lineas.length > 0 ? lineas[0].id : null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem,   setEditItem]   = useState<SubLineaNegocio | null>(null);
  const [deleteItem, setDeleteItem] = useState<SubLineaNegocio | null>(null);

  const { data: sublineas = [], isLoading } = useQuery<SubLineaNegocio[]>({
    queryKey: ['admin-sublineas', selectedLineaId],
    queryFn: () =>
      selectedLineaId
        ? fetchJson<SubLineaNegocio[]>(`/api/sub-lineas?linea_id=${selectedLineaId}`)
        : Promise.resolve([]),
    enabled: !!selectedLineaId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetchJson(`/api/sub-lineas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Sublínea eliminada');
      setDeleteItem(null);
      qc.invalidateQueries({ queryKey: ['admin-sublineas', selectedLineaId] });
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  function refetch() { qc.invalidateQueries({ queryKey: ['admin-sublineas', selectedLineaId] }); }

  const activeLine = lineas.find((l) => l.id === selectedLineaId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag size={18} className="text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sublíneas de negocio</h2>
            <p className="text-xs text-muted-foreground">Categorías dentro de cada línea</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedLineaId ? String(selectedLineaId) : ''}
            onValueChange={(v) => setSelectedLineaId(Number(v))}
          >
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Seleccionar línea…" />
            </SelectTrigger>
            <SelectContent>
              {lineas.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color_hex }} />
                    {l.nombre}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!selectedLineaId}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus size={13} /> Nueva sublínea
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!selectedLineaId ? (
            <p className="p-6 text-sm text-center text-muted-foreground">
              Selecciona una línea para ver sus sublíneas.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando sublíneas…
            </div>
          ) : sublineas.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">
              No hay sublíneas en <strong>{activeLine?.nombre}</strong>. Crea la primera.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50">
                <tr className="text-left">
                  {['Nombre', 'Código', 'Descripción', 'Orden', 'Activa', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sublineas.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.codigo}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[180px]"
                      title={s.descripcion ?? undefined}>
                      {s.descripcion ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.orden}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.activa ? 'bg-green-500/10 text-green-600' : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditItem(s)}
                          className="text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                          <PencilLine size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteItem(s)}
                          className="text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {createOpen && selectedLineaId && (
        <SubLineaDialog lineaId={selectedLineaId} item={null}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); refetch(); }} />
      )}
      {editItem && (
        <SubLineaDialog lineaId={editItem.linea_id} item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); refetch(); }} />
      )}
      <ConfirmDeleteDialog
        open={!!deleteItem}
        label={deleteItem?.nombre ?? ''}
        onConfirm={() => deleteItem && deleteMut.mutate(deleteItem.id)}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LineasPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem,   setEditItem]   = useState<LineaNegocio | null>(null);
  const [deleteItem, setDeleteItem] = useState<LineaNegocio | null>(null);

  const { data: lineas = [], isLoading } = useQuery<LineaNegocio[]>({
    queryKey: ['admin-lineas'],
    queryFn: () => fetchJson<LineaNegocio[]>('/api/admin/lineas'),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      fetchJson(`/api/admin/lineas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-lineas'] }); toast.success('Línea actualizada'); },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetchJson(`/api/admin/lineas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Línea eliminada');
      setDeleteItem(null);
      qc.invalidateQueries({ queryKey: ['admin-lineas'] });
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  function refetch() { qc.invalidateQueries({ queryKey: ['admin-lineas'] }); }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <AdminBreadcrumb
        crumbs={[{ label: 'Administración', href: '/admin' }, { label: 'Líneas de Negocio' }]}
      />

      {/* ── Líneas ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Líneas de negocio</h1>
            <p className="text-sm text-muted-foreground">Configura las líneas activas y su metadata</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
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
                      <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lineas.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color_hex }} />
                          {l.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]"
                        title={l.descripcion ?? undefined}>
                        {l.descripcion ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-4 h-4 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: l.color_hex }} />
                          <span className="font-mono text-xs text-muted-foreground">{l.color_hex}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{l.orden}</td>
                      <td className="px-4 py-3">
                        <button type="button"
                          onClick={() => patchMut.mutate({ id: l.id, updates: { activo: !l.activo } })}
                          title={l.activo ? 'Desactivar' : 'Activar'}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors rounded-md px-2 py-1 ${
                            l.activo
                              ? 'text-green-600 bg-green-500/10 hover:bg-green-500/20'
                              : 'text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground'
                          }`}>
                          {l.activo
                            ? <ToggleRight size={18} className="text-green-500" />
                            : <ToggleLeft size={18} />}
                          {l.activo ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setEditItem(l)}
                            className="text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                            <PencilLine size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleteItem(l)}
                            className="text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SubLíneas ── */}
      {!isLoading && lineas.length > 0 && (
        <SubLineasSection lineas={lineas} />
      )}

      {/* ── Dialogs ── */}
      <CreateLineaDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); refetch(); }}
      />
      <EditLineaDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSuccess={() => { setEditItem(null); refetch(); }}
      />
      <ConfirmDeleteDialog
        open={!!deleteItem}
        label={deleteItem?.nombre ?? ''}
        onConfirm={() => deleteItem && deleteMut.mutate(deleteItem.id)}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}
