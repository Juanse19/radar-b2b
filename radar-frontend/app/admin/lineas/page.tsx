'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────

interface LineaRow {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  color_hex: string | null;
  activo: boolean;
  orden: number;
}

interface SubLineaRow {
  id: number;
  linea_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  meta_schema_version: string;
  activo: boolean;
  orden: number;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function fetchLineas(): Promise<LineaRow[]> {
  const r = await fetch('/api/lineas');
  if (!r.ok) throw new Error('Error al cargar líneas');
  return r.json();
}

async function fetchSubLineas(lineaId: number): Promise<SubLineaRow[]> {
  const r = await fetch(`/api/sub-lineas?linea_id=${lineaId}`);
  if (!r.ok) throw new Error('Error al cargar sub-líneas');
  return r.json();
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminLineasPage() {
  const qc = useQueryClient();
  const [expandedLinea, setExpandedLinea] = useState<number | null>(null);
  const [editingLinea, setEditingLinea] = useState<LineaRow | null>(null);
  const [editingSubLinea, setEditingSubLinea] = useState<SubLineaRow | null>(null);
  const [newLineaOpen, setNewLineaOpen] = useState(false);
  const [newSubLineaOpen, setNewSubLineaOpen] = useState<number | null>(null); // lineaId

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['lineas'],
    queryFn: fetchLineas,
  });

  const { data: subLineas = [] } = useQuery({
    queryKey: ['sub-lineas', expandedLinea],
    queryFn: () => expandedLinea ? fetchSubLineas(expandedLinea) : Promise.resolve([]),
    enabled: expandedLinea !== null,
  });

  const deleteLinea = useMutation({
    mutationFn: (id: number) => fetch(`/api/lineas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lineas'] });
      toast.success('Línea eliminada');
    },
    onError: () => toast.error('No se pudo eliminar la línea'),
  });

  const deleteSubLinea = useMutation({
    mutationFn: (id: number) => fetch(`/api/sub-lineas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sub-lineas', expandedLinea] });
      toast.success('Sub-línea eliminada');
    },
    onError: () => toast.error('No se pudo eliminar la sub-línea'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando líneas de negocio...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Líneas de Negocio</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra las líneas primarias y sub-líneas del sistema Matec Radar.
          </p>
        </div>
        <Button onClick={() => setNewLineaOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Línea
        </Button>
      </div>

      <div className="space-y-2">
        {lineas.map((linea) => (
          <div key={linea.id} className="border rounded-lg overflow-hidden">
            {/* Línea header */}
            <div className="flex items-center gap-3 p-4 bg-card hover:bg-accent/50 cursor-pointer"
                 onClick={() => setExpandedLinea(expandedLinea === linea.id ? null : linea.id)}>
              <div className="w-3 h-3 rounded-full flex-shrink-0"
                   style={{ backgroundColor: linea.color_hex ?? '#6b7280' }} />
              <span className="font-medium flex-1">{linea.nombre}</span>
              <Badge variant={linea.activo ? 'default' : 'secondary'}>
                {linea.activo ? 'Activo' : 'Inactivo'}
              </Badge>
              <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => setEditingLinea(linea)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm"
                        onClick={() => deleteLinea.mutate(linea.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              {expandedLinea === linea.id
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Sub-líneas */}
            {expandedLinea === linea.id && (
              <div className="border-t bg-muted/30 p-3 space-y-1.5">
                {subLineas.map((sl) => (
                  <div key={sl.id}
                       className="flex items-center gap-3 px-4 py-2.5 bg-card rounded-md border">
                    <span className="text-sm flex-1">{sl.nombre}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sl.codigo}</span>
                    <Badge variant="outline" className="text-xs">
                      {sl.meta_schema_version === 'v2_amplio' ? 'V2' : 'V1'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingSubLinea(sl)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm"
                              onClick={() => deleteSubLinea.mutate(sl.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2"
                        onClick={() => setNewSubLineaOpen(linea.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar sub-línea
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <LineaDialog
        open={newLineaOpen || editingLinea !== null}
        linea={editingLinea}
        onClose={() => { setNewLineaOpen(false); setEditingLinea(null); }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['lineas'] });
          setNewLineaOpen(false);
          setEditingLinea(null);
        }}
      />
      <SubLineaDialog
        open={newSubLineaOpen !== null || editingSubLinea !== null}
        subLinea={editingSubLinea}
        lineaId={newSubLineaOpen ?? editingSubLinea?.linea_id ?? 0}
        onClose={() => { setNewSubLineaOpen(null); setEditingSubLinea(null); }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['sub-lineas', expandedLinea] });
          setNewSubLineaOpen(null);
          setEditingSubLinea(null);
        }}
      />
    </div>
  );
}

// ── Linea Dialog ───────────────────────────────────────────────────────────

function LineaDialog({ open, linea, onClose, onSaved }: {
  open: boolean;
  linea: LineaRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    codigo: linea?.codigo ?? '',
    nombre: linea?.nombre ?? '',
    descripcion: linea?.descripcion ?? '',
    color_hex: linea?.color_hex ?? '#3B82F6',
    activo: linea?.activo ?? true,
    orden: linea?.orden ?? 0,
  });

  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    setLoading(true);
    try {
      const url  = linea ? `/api/lineas/${linea.id}` : '/api/lineas';
      const method = linea ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error('Error al guardar');
      toast.success(linea ? 'Línea actualizada' : 'Línea creada');
      onSaved();
    } catch {
      toast.error('No se pudo guardar la línea');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{linea ? 'Editar línea' : 'Nueva línea de negocio'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input placeholder="bhs" value={form.codigo} onChange={set('codigo')} />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input type="color" value={form.color_hex} onChange={set('color_hex')} className="h-10" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input placeholder="BHS (Baggage Handling Systems)" value={form.nombre} onChange={set('nombre')} />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={set('descripcion')} />
          </div>
          <div className="space-y-1">
            <Label>Orden (menor = primero)</Label>
            <Input type="number" value={form.orden}
                   onChange={(e) => setForm((f) => ({ ...f, orden: Number(e.target.value) }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SubLinea Dialog ────────────────────────────────────────────────────────

function SubLineaDialog({ open, subLinea, lineaId, onClose, onSaved }: {
  open: boolean;
  subLinea: SubLineaRow | null;
  lineaId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    linea_id: lineaId,
    codigo:   subLinea?.codigo   ?? '',
    nombre:   subLinea?.nombre   ?? '',
    descripcion: subLinea?.descripcion ?? '',
    meta_schema_version: subLinea?.meta_schema_version ?? 'v2_amplio',
    activo: subLinea?.activo ?? true,
    orden:  subLinea?.orden  ?? 0,
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    setLoading(true);
    try {
      const url  = subLinea ? `/api/sub-lineas/${subLinea.id}` : '/api/sub-lineas';
      const method = subLinea ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, linea_id: lineaId }),
      });
      if (!r.ok) throw new Error('Error al guardar');
      toast.success(subLinea ? 'Sub-línea actualizada' : 'Sub-línea creada');
      onSaved();
    } catch {
      toast.error('No se pudo guardar la sub-línea');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subLinea ? 'Editar sub-línea' : 'Nueva sub-línea'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label>Código</Label>
            <Input placeholder="aeropuertos" value={form.codigo} onChange={set('codigo')} />
          </div>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input placeholder="Aeropuertos" value={form.nombre} onChange={set('nombre')} />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={set('descripcion')} />
          </div>
          <div className="space-y-1">
            <Label>Orden</Label>
            <Input type="number" value={form.orden}
                   onChange={(e) => setForm((f) => ({ ...f, orden: Number(e.target.value) }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
