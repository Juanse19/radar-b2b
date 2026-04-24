'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, Search, Loader2, Eye,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LineaBadge } from '@/components/LineaBadge';
import { TierBadge }  from '@/components/TierBadge';
import { EmptyState } from '@/components/EmptyState';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface EmpresaRow {
  id: string;
  nombre: string;
  pais: string;
  linea: string;
  tier: string;
  dominio?: string;
}

interface SubLineaOption {
  id: number;
  codigo: string;
  nombre: string;
  linea: { id: number; codigo: string; nombre: string; color_hex: string | null };
}

interface FormValues {
  company_name: string;
  pais: string;
  company_domain: string;
  linea_negocio: string;
  tier: string;
  ciudad: string;
}

const PAGE_SIZE = 25;

const EMPTY_FORM: FormValues = {
  company_name:   '',
  pais:           '',
  company_domain: '',
  linea_negocio:  'aeropuertos',
  tier:           'Tier B',
  ciudad:         '',
};

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4 animate-pulse items-center">
          <div className="h-4 bg-surface-muted rounded w-48" />
          <div className="h-4 bg-surface-muted rounded w-20" />
          <div className="h-4 bg-surface-muted rounded w-32" />
          <div className="h-5 bg-surface-muted rounded-full w-24" />
          <div className="h-5 bg-surface-muted rounded-full w-16" />
          <div className="flex gap-1 ml-auto">
            <div className="h-7 w-7 bg-surface-muted rounded-lg" />
            <div className="h-7 w-7 bg-surface-muted rounded-lg" />
            <div className="h-7 w-7 bg-surface-muted rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal de formulario ───────────────────────────────────────────────────────

interface EmpresaModalProps {
  open: boolean;
  onClose: () => void;
  initial?: EmpresaRow | null;
  onSubmit: (values: FormValues) => void;
  loading: boolean;
  titulo: string;
  subLineas: SubLineaOption[];
}

function EmpresaModal({ open, onClose, initial, onSubmit, loading, titulo, subLineas }: EmpresaModalProps) {
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(
        initial
          ? {
              company_name:   initial.nombre,
              pais:           initial.pais,
              company_domain: initial.dominio ?? '',
              linea_negocio:  initial.linea,
              tier:           initial.tier,
              ciudad:         '',
            }
          : { ...EMPTY_FORM },
      );
    }
  }, [open, initial]);

  function field(name: keyof FormValues, value: string) {
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{titulo}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">
              Nombre de la empresa <span className="text-red-500">*</span>
            </Label>
            <Input
              required
              value={form.company_name}
              onChange={e => field('company_name', e.target.value)}
              placeholder="Ej: Aeropuertos de Colombia S.A."
              className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* País / Ciudad — 2-column grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">País</Label>
              <Input
                value={form.pais}
                onChange={e => field('pais', e.target.value)}
                placeholder="Colombia"
                className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">
                Ciudad{' '}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                value={form.ciudad}
                onChange={e => field('ciudad', e.target.value)}
                placeholder="Bogotá"
                className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Dominio */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Dominio</Label>
            <Input
              value={form.company_domain}
              onChange={e => field('company_domain', e.target.value)}
              placeholder="empresa.com"
              className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Línea / Tier — 2-column grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">
                Línea de negocio <span className="text-red-500">*</span>
              </Label>
              <Select value={form.linea_negocio} onValueChange={v => v && field('linea_negocio', v)}>
                <SelectTrigger className="w-full bg-surface-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-muted border-border">
                  {subLineas.map(sl => (
                    <SelectItem key={sl.codigo} value={sl.codigo} className="text-foreground">
                      {sl.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Tier</Label>
              <Select value={form.tier} onValueChange={v => v && field('tier', v)}>
                <SelectTrigger className="w-full bg-surface-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-muted border-border">
                  <SelectItem value="Tier A" className="text-foreground">Tier A</SelectItem>
                  <SelectItem value="Tier B" className="text-foreground">Tier B</SelectItem>
                  <SelectItem value="Tier C" className="text-foreground">Tier C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter
            showCloseButton={false}
            className="-mx-4 -mb-4 px-4 pb-4 pt-4 mt-2 rounded-b-xl flex flex-row justify-end gap-2"
          >
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EmpresasPage() {
  const queryClient = useQueryClient();

  const [subLineas, setSubLineas]   = useState<SubLineaOption[]>([]);
  const [lineaFiltro, setLineaFiltro] = useState<string>('ALL');
  const [page, setPage]               = useState(0);
  const [search, setSearch]           = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<EmpresaRow | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);

  // Fetch sub-líneas from DB on mount (used for filter bar and form)
  useEffect(() => {
    fetch('/api/sub-lineas')
      .then(r => r.json())
      .then((data: SubLineaOption[]) => setSubLineas(Array.isArray(data) ? data : []))
      .catch(() => { /* fallback: filter bar still shows ALL */ });
  }, []);

  // ── Conteos por línea ─────────────────────────────────────────────────────

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ['companyCounts'],
    queryFn:  () => fetch('/api/companies?count=true').then(r => r.json()),
    staleTime: 60_000,
  });

  const totalCount = lineaFiltro === 'ALL'
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : (counts[lineaFiltro] ?? 0);

  // ── Lista de empresas ─────────────────────────────────────────────────────

  const offset = page * PAGE_SIZE;

  const { data: rawEmpresas, isFetching } = useQuery<EmpresaRow[]>({
    queryKey: ['empresas', lineaFiltro, offset],
    queryFn:  () =>
      fetch(
        `/api/companies?linea=${encodeURIComponent(lineaFiltro)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ).then(r => r.json()),
    staleTime: 30_000,
    placeholderData: prev => prev,
  });

  const empresas: EmpresaRow[] = Array.isArray(rawEmpresas) ? rawEmpresas : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return empresas;
    const q = search.toLowerCase();
    return empresas.filter(e => e.nombre.toLowerCase().includes(q));
  }, [empresas, search]);

  // ── Mutaciones ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch('/api/companies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name:   values.company_name,
          company_domain: values.company_domain || undefined,
          pais:           values.pais           || undefined,
          ciudad:         values.ciudad         || undefined,
          linea_negocio:  values.linea_negocio,
          tier:           values.tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Error al crear');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['companyCounts'] });
      setModalOpen(false);
      setEditTarget(null);
      toast.success('Empresa creada correctamente');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Error al crear empresa');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      const res = await fetch(`/api/companies/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name:   values.company_name,
          company_domain: values.company_domain || undefined,
          pais:           values.pais           || undefined,
          ciudad:         values.ciudad         || undefined,
          linea_negocio:  values.linea_negocio,
          tier:           values.tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Error al actualizar');
      return data;
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: ['empresas', lineaFiltro, offset] });
      const prev = queryClient.getQueryData<EmpresaRow[]>(['empresas', lineaFiltro, offset]);
      queryClient.setQueryData<EmpresaRow[]>(['empresas', lineaFiltro, offset], old =>
        old?.map(e =>
          e.id === id
            ? {
                ...e,
                nombre:  values.company_name,
                pais:    values.pais,
                dominio: values.company_domain,
                linea:   values.linea_negocio,
                tier:    values.tier,
              }
            : e,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['empresas', lineaFiltro, offset], ctx.prev);
      }
      toast.error('Error al actualizar empresa');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['companyCounts'] });
      setModalOpen(false);
      setEditTarget(null);
      toast.success('Empresa actualizada');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Error al eliminar');
      return data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['empresas', lineaFiltro, offset] });
      const prev = queryClient.getQueryData<EmpresaRow[]>(['empresas', lineaFiltro, offset]);
      queryClient.setQueryData<EmpresaRow[]>(['empresas', lineaFiltro, offset], old =>
        old?.filter(e => e.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['empresas', lineaFiltro, offset], ctx.prev);
      }
      toast.error('Error al eliminar empresa');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['companyCounts'] });
      setDeleteId(null);
      toast.success('Empresa eliminada');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLineaChange = useCallback((linea: string) => {
    setLineaFiltro(linea);
    setPage(0);
    setSearch('');
  }, []);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(empresa: EmpresaRow) {
    setEditTarget(empresa);
    setModalOpen(true);
  }

  function handleFormSubmit(values: FormValues) {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditTarget(null);
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activeLabel = lineaFiltro === 'ALL'
    ? 'todas las líneas'
    : (subLineas.find(s => s.codigo === lineaFiltro)?.nombre ?? lineaFiltro);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-muted rounded-lg border border-border">
              <Building2 size={20} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Gestión de Empresas</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Base de datos comercial — filtra, agrega y edita empresas por línea de negocio
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 gap-1.5 shrink-0"
          >
            <Plus size={16} />
            Nueva Empresa
          </Button>
        </div>

        {/* ── Sub-línea filter chips ──────────────────────────────────────── */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-semibold">
            Filtrar por línea
          </p>
          <div className="flex flex-wrap gap-2">
            {/* "Todas" chip */}
            <button
              type="button"
              onClick={() => handleLineaChange('ALL')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                lineaFiltro === 'ALL'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-surface-muted border-border text-muted-foreground hover:border-blue-400 hover:text-foreground'
              }`}
            >
              <Globe size={12} />
              Todas
              <span className={`text-xs ${lineaFiltro === 'ALL' ? 'text-blue-200' : 'text-muted-foreground'}`}>
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </span>
            </button>

            {/* Per sub-línea chips */}
            {subLineas.map(sl => {
              const isActive = lineaFiltro === sl.codigo;
              const cnt = counts[sl.codigo] ?? 0;
              return (
                <button
                  key={sl.codigo}
                  type="button"
                  onClick={() => handleLineaChange(sl.codigo)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-surface-muted border-border text-muted-foreground hover:border-blue-400 hover:text-foreground'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: sl.linea.color_hex ?? '#6b7280' }}
                  />
                  {sl.nombre}
                  {cnt > 0 && (
                    <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-muted-foreground'}`}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Buscar en ${activeLabel}...`}
            className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground pl-9"
          />
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border overflow-hidden bg-surface">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_170px_150px_110px_96px] gap-4 px-5 py-3 bg-surface-muted/60 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
            <span>Empresa</span>
            <span>País</span>
            <span>Dominio</span>
            <span>Línea</span>
            <span>Tier</span>
            <span className="text-right">Acciones</span>
          </div>

          {/* Table body */}
          {isFetching ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search ? 'Sin resultados para esta búsqueda' : 'No hay empresas en esta línea'}
              description={search
                ? `Intenta con otro nombre o limpia el filtro.`
                : `Agrega empresas con el botón "Nueva Empresa".`}
              action={
                !search ? (
                  <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                    <Plus size={14} />
                    Nueva Empresa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(empresa => (
                <div
                  key={empresa.id}
                  className="grid grid-cols-[1fr_110px_170px_150px_110px_96px] gap-4 px-5 py-4 items-center hover:bg-surface-muted/40 transition-colors group"
                >
                  {/* Nombre con indicador de línea */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: subLineas.find(s => s.codigo === empresa.linea)?.linea.color_hex ?? '#6b7280' }}
                    />
                    <span
                      className="text-foreground text-sm font-medium truncate"
                      title={empresa.nombre}
                    >
                      {empresa.nombre}
                    </span>
                  </div>

                  <span className="text-muted-foreground text-sm truncate">
                    {empresa.pais || '—'}
                  </span>

                  <span
                    className="text-muted-foreground text-xs truncate"
                    title={empresa.dominio}
                  >
                    {empresa.dominio || '—'}
                  </span>

                  <span>
                    <LineaBadge linea={empresa.linea} />
                  </span>

                  <span>
                    <TierBadge tier={empresa.tier} />
                  </span>

                  <div className="flex gap-1 justify-end">
                    <Link
                      href={`/empresas/${empresa.id}`}
                      title="Ver detalle"
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={13} />
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(empresa)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(empresa.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isFetching && totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface/40">
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages} · {totalCount} empresas
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-40 gap-1"
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-40 gap-1"
                >
                  Siguiente <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal crear / editar ─────────────────────────────────────────── */}
        <EmpresaModal
          open={modalOpen}
          onClose={handleModalClose}
          initial={editTarget}
          onSubmit={handleFormSubmit}
          loading={isMutating}
          titulo={editTarget ? 'Editar empresa' : 'Nueva empresa'}
          subLineas={subLineas}
        />

        {/* ── Confirmación de eliminación ──────────────────────────────────── */}
        <Dialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
          <DialogContent className="text-foreground sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground">Confirmar eliminación</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm py-2">
              Esta acción no se puede deshacer. ¿Seguro que deseas eliminar esta empresa?
            </p>
            <DialogFooter
              showCloseButton={false}
              className="-mx-4 -mb-4 px-4 pb-4 pt-4 rounded-b-xl flex flex-row justify-end gap-2"
            >
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                className="border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
                disabled={deleteMutation.isPending}
                className="bg-red-700 hover:bg-red-600 text-foreground"
              >
                {deleteMutation.isPending && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
