'use client';
// app/admin/roles/page.tsx — Roles & permissions reference + dynamic CRUD

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield, CheckCircle, XCircle, Users, Loader2,
  Plus, Pencil, Trash2,
} from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROUTE_ACCESS,
  canDo,
} from '@/lib/auth/permissions';
import type { Action } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';
import { fetchJson, ApiError } from '@/lib/fetcher';

// ── Static reference data ───────────────────────────────────────────────────

const ROLES: UserRole[] = ['ADMIN', 'COMERCIAL', 'AUXILIAR'];

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN:     'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  COMERCIAL: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  AUXILIAR:  'bg-gray-500/20 text-gray-300 border border-gray-500/30',
};

const ROLE_MEMBERS: Record<UserRole, string[]> = {
  ADMIN:     ['Juan Camilo'],
  COMERCIAL: ['Felipe Gaviria', 'Paola Vaquero'],
  AUXILIAR:  ['Mariana', 'Natalia'],
};

const ROUTE_LABELS: { path: string; label: string }[] = [
  { path: '/',          label: 'Dashboard' },
  { path: '/scan',      label: 'Escanear' },
  { path: '/results',   label: 'Resultados' },
  { path: '/contactos', label: 'Contactos' },
  { path: '/admin/empresas', label: 'Empresas' },
  { path: '/schedule',  label: 'Cronograma' },
  { path: '/admin',     label: 'Administración' },
];

const ACTION_LABELS: Record<Action, string> = {
  'scan.trigger':        'Disparar escaneo',
  'scan.rescan':         'Re-escanear empresa',
  'schedule.create':     'Crear escaneo programado',
  'schedule.toggle':     'Activar / pausar cronograma',
  'empresas.create':     'Crear empresa',
  'empresas.edit':       'Editar empresa',
  'contactos.export':    'Exportar contactos',
  'admin.manage_users':  'Gestionar usuarios',
  'admin.manage_config': 'Configuración del sistema',
  'admin.view_logs':     'Ver logs de auditoría',
};

// ── Dynamic DB types ────────────────────────────────────────────────────────

interface SystemRole {
  id: number;
  slug: string;
  label: string;
  descripcion: string | null;
  color: string;
  es_sistema: boolean;
  // nested count from Supabase join
  roles_permisos: { count: number }[];
}

interface SystemPermiso {
  id: number;
  clave: string;
  label: string;
  descripcion: string | null;
  modulo: string;
  asignado?: boolean;
}

// ── Shared sub-components ───────────────────────────────────────────────────

function PermissionCell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <CheckCircle size={16} className="text-green-400 mx-auto" aria-label="Permitido" />
  ) : (
    <XCircle size={16} className="text-gray-600 mx-auto" aria-label="Sin acceso" />
  );
}

function RoleHeaderCell({ role }: { role: UserRole }) {
  return (
    <th className="px-4 py-3 text-center w-28">
      <span
        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${ROLE_BADGE[role]}`}
      >
        {ROLE_LABELS[role]}
      </span>
    </th>
  );
}


function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-white/20 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ModuloBadge({ modulo }: { modulo: string }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-muted/60 text-muted-foreground border border-border/50">
      {modulo}
    </span>
  );
}

// ── Tab: Descripción (unchanged) ────────────────────────────────────────────

function DescripcionTab() {
  return (
    <section>
      <div className="grid sm:grid-cols-3 gap-4">
        {ROLES.map((role) => (
          <Card key={role} className="border-border bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${ROLE_BADGE[role]}`}
                >
                  {ROLE_LABELS[role]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {ROLE_DESCRIPTIONS[role]}
              </p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users size={12} className="shrink-0" />
                  <span className="font-medium text-foreground/70">Equipo:</span>
                </div>
                <ul className="space-y-0.5 pl-4">
                  {ROLE_MEMBERS[role].map((member) => (
                    <li key={member} className="text-xs text-foreground/80">
                      {member}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── Tab: Matriz de permisos (unchanged) ─────────────────────────────────────

function MatrizTab() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Acceso a módulos
        </h2>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Módulo
                    </th>
                    {ROLES.map((role) => (
                      <RoleHeaderCell key={role} role={role} />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ROUTE_LABELS.map(({ path, label }) => {
                    const allowed = ROUTE_ACCESS[path] ?? ROLES;
                    return (
                      <tr key={path} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {label}
                          <span className="ml-2 text-[11px] text-muted-foreground font-mono">
                            {path}
                          </span>
                        </td>
                        {ROLES.map((role) => (
                          <td key={role} className="px-4 py-3 text-center">
                            <PermissionCell allowed={allowed.includes(role)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Permisos por acción
        </h2>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Acción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-52">
                      Clave interna
                    </th>
                    {ROLES.map((role) => (
                      <RoleHeaderCell key={role} role={role} />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(Object.entries(ACTION_LABELS) as [Action, string][]).map(
                    ([action, label]) => (
                      <tr key={action} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{label}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {action}
                        </td>
                        {ROLES.map((role) => (
                          <td key={role} className="px-4 py-3 text-center">
                            <PermissionCell allowed={canDo(role, action)} />
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ── Tab: Roles CRUD ─────────────────────────────────────────────────────────

type RoleFormData = { slug: string; label: string; descripcion: string; color: string };

function RolesTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemRole | null>(null);
  const [form, setForm] = useState<RoleFormData>({ slug: '', label: '', descripcion: '', color: '#6366f1' });

  const { data: roles = [], isLoading, error } = useQuery<SystemRole[]>({
    queryKey: ['admin-roles'],
    queryFn: () => fetchJson<SystemRole[]>('/api/admin/roles'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: RoleFormData) =>
      fetchJson('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Rol creado correctamente');
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      setCreateOpen(false);
      setForm({ slug: '', label: '', descripcion: '', color: '#6366f1' });
    },
    onError: (err) => {
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<RoleFormData> }) =>
      fetchJson(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Rol actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      setEditTarget(null);
    },
    onError: (err) => {
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/api/admin/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Rol eliminado');
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`);
    },
  });

  function openEdit(role: SystemRole) {
    setForm({
      slug: role.slug,
      label: role.label,
      descripcion: role.descripcion ?? '',
      color: role.color,
    });
    setEditTarget(role);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Cargando roles…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">
        Error al cargar roles: {error instanceof ApiError ? error.message : 'Desconocido'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Crear rol
        </Button>
      </div>

      <div className="space-y-2">
        {roles.map((role) => {
          const count = role.roles_permisos?.[0]?.count ?? 0;
          return (
            <div
              key={role.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-surface"
            >
              <ColorDot color={role.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{role.label}</span>
                  {role.es_sistema && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted/60 text-muted-foreground border border-border/50 font-mono">
                      sistema
                    </span>
                  )}
                </div>
                {role.descripcion && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{role.descripcion}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {count} {count === 1 ? 'permiso' : 'permisos'}
              </span>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(role)}
                  aria-label={`Editar ${role.label}`}
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={role.es_sistema}
                  onClick={() => setDeleteTarget(role)}
                  aria-label={`Eliminar ${role.label}`}
                  className="text-destructive hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear rol</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Slug *</label>
              <Input
                placeholder="ej: supervisor"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre (label) *</label>
              <Input
                placeholder="ej: Supervisor"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Descripción</label>
              <Input
                placeholder="Descripción breve del rol"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Color</label>
              <div className="flex items-center gap-2">
                <ColorDot color={form.color} />
                <Input
                  placeholder="#6366f1"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.slug.trim() || !form.label.trim()}
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar rol</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre (label) *</label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Descripción</label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Color</label>
              <div className="flex items-center gap-2">
                <ColorDot color={form.color} />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              onClick={() => {
                if (!editTarget) return;
                editMutation.mutate({
                  id: editTarget.id,
                  payload: { label: form.label, descripcion: form.descripcion, color: form.color },
                });
              }}
              disabled={editMutation.isPending || !form.label.trim()}
            >
              {editMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta acción eliminará el rol{' '}
            <span className="font-semibold text-foreground">{deleteTarget?.label}</span> de forma
            permanente. Los permisos asociados también se eliminarán.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab: Permisos CRUD ──────────────────────────────────────────────────────

type PermisoFormData = { clave: string; label: string; modulo: string };

function PermisosTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<PermisoFormData>({ clave: '', label: '', modulo: '' });

  const { data: permisos = [], isLoading, error } = useQuery<SystemPermiso[]>({
    queryKey: ['admin-permisos'],
    queryFn: () => fetchJson<SystemPermiso[]>('/api/admin/permisos'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PermisoFormData) =>
      fetchJson('/api/admin/permisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Permiso creado correctamente');
      qc.invalidateQueries({ queryKey: ['admin-permisos'] });
      setCreateOpen(false);
      setForm({ clave: '', label: '', modulo: '' });
    },
    onError: (err) => {
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Cargando permisos…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">
        Error al cargar permisos: {error instanceof ApiError ? error.message : 'Desconocido'}
      </p>
    );
  }

  // Group by modulo
  const byModulo = permisos.reduce<Record<string, SystemPermiso[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Nuevo permiso
        </Button>
      </div>

      <div className="space-y-6">
        {Object.entries(byModulo).map(([modulo, list]) => (
          <section key={modulo}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {modulo}
            </h3>
            <div className="space-y-1.5">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-surface"
                >
                  <code className="text-[11px] font-mono text-muted-foreground w-40 shrink-0">
                    {p.clave}
                  </code>
                  <span className="text-sm text-foreground flex-1">{p.label}</span>
                  <ModuloBadge modulo={p.modulo} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo permiso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Clave *</label>
              <Input
                placeholder="ej: reportes.export"
                value={form.clave}
                onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Etiqueta *</label>
              <Input
                placeholder="ej: Exportar reportes"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Módulo *</label>
              <Input
                placeholder="ej: reportes"
                value={form.modulo}
                onChange={(e) => setForm((f) => ({ ...f, modulo: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={
                createMutation.isPending ||
                !form.clave.trim() ||
                !form.label.trim() ||
                !form.modulo.trim()
              }
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab: Asignación dinámica (checkbox matrix) ──────────────────────────────

function AsignacionTab() {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [toggling, setToggling] = useState<number | null>(null);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<SystemRole[]>({
    queryKey: ['admin-roles'],
    queryFn: () => fetchJson<SystemRole[]>('/api/admin/roles'),
  });

  const { data: permisos = [], isLoading: permisosLoading } = useQuery<SystemPermiso[]>({
    queryKey: ['admin-role-permisos', selectedRoleId],
    queryFn: () => fetchJson<SystemPermiso[]>(`/api/admin/roles/${selectedRoleId}/permisos`),
    enabled: !!selectedRoleId,
  });

  async function handleToggle(permiso: SystemPermiso) {
    if (!selectedRoleId || toggling !== null) return;
    setToggling(permiso.id);
    try {
      if (permiso.asignado) {
        await fetchJson(`/api/admin/roles/${selectedRoleId}/permisos?permiso_id=${permiso.id}`, {
          method: 'DELETE',
        });
        toast.success(`Permiso "${permiso.label}" removido`);
      } else {
        await fetchJson(`/api/admin/roles/${selectedRoleId}/permisos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permiso_id: permiso.id }),
        });
        toast.success(`Permiso "${permiso.label}" asignado`);
      }
      qc.invalidateQueries({ queryKey: ['admin-role-permisos', selectedRoleId] });
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
    } catch (err) {
      toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`);
    } finally {
      setToggling(null);
    }
  }

  // Group permisos by modulo
  const byModulo = permisos.reduce<Record<string, SystemPermiso[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground shrink-0">Rol:</label>
        <Select
          value={selectedRoleId}
          onValueChange={(v) => setSelectedRoleId(v ?? '')}
          disabled={rolesLoading}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Seleccionar rol…" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rolesLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>

      {!selectedRoleId && (
        <p className="text-sm text-muted-foreground">
          Selecciona un rol para ver y editar sus permisos.
        </p>
      )}

      {selectedRoleId && permisosLoading && (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Cargando permisos…
        </div>
      )}

      {selectedRoleId && !permisosLoading && permisos.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay permisos registrados.</p>
      )}

      {selectedRoleId && !permisosLoading && permisos.length > 0 && (
        <div className="space-y-5">
          {Object.entries(byModulo).map(([modulo, list]) => (
            <section key={modulo}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {modulo}
              </h3>
              <div className="space-y-1.5">
                {list.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-surface cursor-pointer hover:bg-surface-muted/30 transition-colors select-none"
                  >
                    <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                      {toggling === p.id ? (
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={p.asignado ?? false}
                          onChange={() => handleToggle(p)}
                          className="w-4 h-4 accent-[#142e47] cursor-pointer"
                        />
                      )}
                    </div>
                    <code className="text-[11px] font-mono text-muted-foreground w-40 shrink-0">
                      {p.clave}
                    </code>
                    <span className="text-sm text-foreground flex-1">{p.label}</span>
                    <ModuloBadge modulo={p.modulo} />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type TabId = 'descripcion' | 'roles' | 'permisos' | 'asignacion' | 'matriz';

const TABS: { id: TabId; label: string }[] = [
  { id: 'descripcion', label: 'Descripción' },
  { id: 'roles',       label: 'Roles' },
  { id: 'permisos',    label: 'Permisos' },
  { id: 'asignacion',  label: 'Asignación' },
  { id: 'matriz',      label: 'Matriz de permisos' },
];

export default function RolesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('descripcion');

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Roles y Permisos' },
        ]}
      />

      <header>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-purple-400" />
          <h1 className="text-2xl font-bold text-foreground">Roles y Permisos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Referencia de accesos por rol y asignación de usuarios.
        </p>
      </header>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#142e47] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'descripcion' && <DescripcionTab />}
      {activeTab === 'roles'       && <RolesTab />}
      {activeTab === 'permisos'    && <PermisosTab />}
      {activeTab === 'asignacion'  && <AsignacionTab />}
      {activeTab === 'matriz'      && <MatrizTab />}
    </div>
  );
}
