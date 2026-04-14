'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, Search, Loader2, Eye,
  Plane, Package, Warehouse, Globe,
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
import { fetchJson } from '@/lib/fetcher';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface EmpresaRow {
  id: string;
  nombre: string;
  pais: string;
  linea: string;
  tier: string;
  dominio?: string;
}

type LineaFiltro = 'ALL' | 'BHS' | 'Cartón' | 'Intralogística';

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
  linea_negocio:  'BHS',
  tier:           'Tier B',
  ciudad:         '',
};

// ── Line options — Icon as React.ElementType (NOT JSX) to avoid hydration crash ──

const LINEA_OPTIONS: {
  value: LineaFiltro;
  label: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
  badge: string;
  dot: string;
}[] = [
  {
    value: 'ALL',
    label: 'Todas',
    desc: 'Todas las líneas',
    Icon: Globe,
    color: 'text-indigo-400',
    activeBg: 'bg-indigo-950/60',
    activeBorder: 'border-indigo-500',
    badge: 'bg-indigo-900 text-indigo-300',
    dot: 'bg-indigo-400',
  },
  {
    value: 'BHS',
    label: 'BHS',
    desc: 'Aeropuertos y cargo',
    Icon: Plane,
    color: 'text-blue-400',
    activeBg: 'bg-blue-950/60',
    activeBorder: 'border-blue-500',
    badge: 'bg-blue-900 text-blue-300',
    dot: 'bg-blue-400',
  },
  {
    value: 'Cartón',
    label: 'Cartón',
    desc: 'Corrugadoras, empaque',
    Icon: Package,
    color: 'text-amber-400',
    activeBg: 'bg-amber-950/60',
    activeBorder: 'border-amber-500',
    badge: 'bg-amber-900 text-amber-300',
    dot: 'bg-amber-400',
  },
  {
    value: 'Intralogística',
    label: 'Intralogística',
    desc: 'CEDI, WMS, ASRS',
    Icon: Warehouse,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-950/60',
    activeBorder: 'border-emerald-500',
    badge: 'bg-emerald-900 text-emerald-300',
    dot: 'bg-emerald-400',
  },
];

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-800">
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
}

function EmpresaModal({ open, onClose, initial, onSubmit, loading, titulo }: EmpresaModalProps) {
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
              Nombre de la empresa <span className="text-red-400">*</span>
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
                Línea de negocio <span className="text-red-400">*</span>
              </Label>
              <Select value={form.linea_negocio} onValueChange={v => v && field('linea_negocio', v)}>
                <SelectTrigger className="w-full bg-surface-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-muted border-border">
                  <SelectItem value="BHS"            className="text-gray-100">BHS</SelectItem>
                  <SelectItem value="Cartón"         className="text-gray-100">Cartón</SelectItem>
                  <SelectItem value="Intralogística" className="text-gray-100">Intralogística</SelectItem>
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
                  <SelectItem value="Tier A" className="text-gray-100">Tier A</SelectItem>
                  <SelectItem value="Tier B" className="text-gray-100">Tier B</SelectItem>
                  <SelectItem value="Tier C" className="text-gray-100">Tier C</SelectItem>
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
              className="border-border text-muted-foreground hover:bg-surface-muted hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
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

  const [lineaFiltro, setLineaFiltro] = useState<LineaFiltro>('ALL');
  const [page, setPage]               = useState(0);
  const [search, setSearch]           = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<EmpresaRow | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);

  // ── Conteos por línea ─────────────────────────────────────────────────────

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ['companyCounts'],
    queryFn:  () => fetchJson<Record<string, number>>('/api/companies?count=true'),
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
      fetchJson<EmpresaRow[]>(
        `/api/companies?linea=${encodeURIComponent(lineaFiltro)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ),
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

  function handleLineaChange(linea: LineaFiltro) {
    setLineaFiltro(linea);
    setPage(0);
    setSearch('');
  }

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

  const isMutating  = createMutation.isPending || updateMutation.isPending;
  const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activeOption = LINEA_OPTIONS.find(o => o.value === lineaFiltro) ?? LINEA_OPTIONS[0]!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <AdminBreadcrumb
          crumbs={[
            { label: 'Administración', href: '/admin' },
            { label: 'Empresas' },
          ]}
        />

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
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shrink-0"
          >
            <Plus size={16} />
            Nueva Empresa
          </Button>
        </div>

        {/* ── Line selector cards ─────────────────────────────────────────── */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-semibold">
            Filtrar por línea
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LINEA_OPTIONS.map(opt => {
              const isActive = lineaFiltro === opt.value;
              const cnt = opt.value === 'ALL'
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : (counts[opt.value] ?? 0);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLineaChange(opt.value)}
                  className={`
                    relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all duration-150
                    ${isActive
                      ? `${opt.activeBg} ${opt.activeBorder} shadow-lg`
                      : 'bg-surface/60 border-border/60 hover:border-border hover:bg-surface-muted/60'}
                  `}
                >
                  {isActive && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                  )}
                  <div className={`mb-2 transition-colors ${isActive ? opt.color : 'text-muted-foreground'}`}>
                    <opt.Icon size={24} />
                  </div>
                  <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-tight">{opt.desc}</p>
                  {cnt > 0 && (
                    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isActive ? opt.badge : 'bg-surface-muted text-muted-foreground'}`}>
                      {cnt} empresa{cnt !== 1 ? 's' : ''}
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
            placeholder={`Buscar en ${activeOption.label}...`}
            className="bg-surface-muted border-border text-foreground placeholder:text-muted-foreground pl-9"
          />
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border overflow-x-auto bg-surface">
          {/* Table header */}
          <div className="min-w-[760px] grid grid-cols-[1fr_110px_170px_150px_110px_96px] gap-4 px-5 py-3 bg-surface-muted/60 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
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
                  <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
                    <Plus size={14} />
                    Nueva Empresa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map(empresa => (
                <div
                  key={empresa.id}
                  className="min-w-[760px] grid grid-cols-[1fr_110px_170px_150px_110px_96px] gap-4 px-5 py-4 items-center hover:bg-surface-muted/40 transition-colors group"
                >
                  {/* Nombre con indicador de línea */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-5 rounded-full shrink-0 ${
                        empresa.linea === 'BHS'
                          ? 'bg-blue-500'
                          : empresa.linea === 'Cartón'
                          ? 'bg-amber-500'
                          : empresa.linea === 'Intralogística'
                          ? 'bg-emerald-500'
                          : 'bg-gray-600'
                      }`}
                    />
                    <span
                      className="text-white text-sm font-medium truncate"
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
                      href={`/admin/empresas/${empresa.id}`}
                      title="Ver detalle"
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-950 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={13} />
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(empresa)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-white hover:bg-surface-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(empresa.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-950 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  className="h-7 border-border text-muted-foreground hover:bg-surface-muted hover:text-white disabled:opacity-40 gap-1"
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 border-border text-muted-foreground hover:bg-surface-muted hover:text-white disabled:opacity-40 gap-1"
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
                className="border-border text-muted-foreground hover:bg-surface-muted hover:text-white"
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
  );
}
