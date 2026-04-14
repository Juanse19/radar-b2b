'use client';
// app/admin/usuarios/page.tsx
// Sprint 3.5 — Phase 4: full rewrite with Dialog modals, pagination, edit and delete.

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Loader2, KeyRound, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
  useChangePassword,
  type AdminUser,
} from '@/hooks/admin/useUsuarios';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

// ── Avatar helper ─────────────────────────────────────────────────────────────

function UserAvatar({ nombre, rol }: { nombre: string; rol: AdminUser['rol'] }) {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const bgClasses: Record<AdminUser['rol'], string> = {
    ADMIN:     'bg-secondary text-secondary-foreground',
    COMERCIAL: 'bg-primary text-primary-foreground',
    AUXILIAR:  'bg-muted text-muted-foreground',
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${bgClasses[rol]}`}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: AdminUser['rol'] }) {
  const classes: Record<AdminUser['rol'], string> = {
    ADMIN:     'bg-secondary/15 text-secondary border border-secondary/30',
    COMERCIAL: 'bg-primary/15 text-primary border border-primary/30',
    AUXILIAR:  'bg-muted text-muted-foreground border border-border',
  };
  const labels: Record<AdminUser['rol'], string> = {
    ADMIN:     'Administrador',
    COMERCIAL: 'Comercial',
    AUXILIAR:  'Auxiliar',
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${classes[rol]}`}>
      {labels[rol]}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: AdminUser['estado_acceso'] }) {
  const classes: Record<AdminUser['estado_acceso'], string> = {
    ACTIVO:   'bg-green-500/15 text-green-700 border border-green-300/50',
    PENDIENTE:'bg-amber-500/15 text-amber-700 border border-amber-300/50',
    INACTIVO: 'bg-red-500/15 text-red-700 border border-red-300/50',
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${classes[estado]}`}>
      {estado}
    </span>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { nombre: string; email: string; password: string; rol: string }) => void;
  isPending: boolean;
}

function CreateUsuarioDialog({ open, onClose, onSubmit, isPending }: CreateDialogProps) {
  const [nombre, setNombre]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol]           = useState<string>('AUXILIAR');

  function reset() {
    setNombre(''); setEmail(''); setPassword(''); setRol('AUXILIAR');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ nombre, email, password, rol });
  }

  // Reset form when dialog closes
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) { reset(); onClose(); }
  }

  const isValid = nombre.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            El usuario recibirá acceso inmediato con estado ACTIVO.
          </DialogDescription>
        </DialogHeader>

        <form id="create-user-form" onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre completo</label>
            <Input
              placeholder="Ej: Paola Vaquero"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
            <Input
              type="email"
              placeholder="usuario@matec.com.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Contraseña temporal</label>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rol</label>
            <Select value={rol} onValueChange={(v) => { if (v) setRol(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="COMERCIAL">Comercial</SelectItem>
                <SelectItem value="AUXILIAR">Auxiliar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-user-form"
            disabled={isPending || !isValid}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

interface EditDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (data: { nombre: string; rol: string; estado_acceso: string }) => void;
  isPending: boolean;
}

function EditUsuarioDialog({ user, onClose, onSubmit, isPending }: EditDialogProps) {
  const [nombre, setNombre]             = useState(user?.nombre ?? '');
  const [rol, setRol]                   = useState<string>(user?.rol ?? 'AUXILIAR');
  const [estadoAcceso, setEstadoAcceso] = useState<string>(user?.estado_acceso ?? 'ACTIVO');

  // Populate form whenever the targeted user changes (dialog re-opened for different user)
  useEffect(() => {
    if (user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setNombre(user.nombre);
      setRol(user.rol);
      setEstadoAcceso(user.estado_acceso);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ nombre, rol, estado_acceso: estadoAcceso });
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Modifica el nombre, rol o estado de acceso de {user?.nombre}.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre completo</label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rol</label>
            <Select value={rol} onValueChange={(v) => { if (v) setRol(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="COMERCIAL">Comercial</SelectItem>
                <SelectItem value="AUXILIAR">Auxiliar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Estado de acceso</label>
            <Select value={estadoAcceso} onValueChange={(v) => { if (v) setEstadoAcceso(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="INACTIVO">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-user-form"
            disabled={isPending || !nombre.trim()}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

interface DeleteDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function DeleteConfirmDialog({ user, onClose, onConfirm, isPending }: DeleteDialogProps) {
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar usuario</DialogTitle>
          <DialogDescription>
            Estas a punto de eliminar a <span className="font-semibold text-foreground">{user?.nombre}</span>.
            Esta accion no se puede deshacer y eliminara permanentemente el acceso
            del usuario al sistema.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="gap-2 bg-danger hover:bg-danger/90 text-white"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Change Password Dialog ────────────────────────────────────────────────────

interface ChangePasswordDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
  isPending: boolean;
}

function ChangePasswordDialog({ user, onClose, onSubmit, isPending }: ChangePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');

  function reset() { setPassword(''); setConfirm(''); }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) { reset(); onClose(); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(password);
  }

  const isValid = password.length >= 8 && password === confirm;

  return (
    <Dialog open={!!user} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            {user ? `Usuario: ${user.nombre}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form id="change-pwd-form" onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nueva contraseña</label>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Confirmar contraseña</label>
            <Input
              type="password"
              placeholder="Repetir contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="change-pwd-form"
            disabled={isPending || !isValid}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Cambiar contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const [page, setPage]               = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen]   = useState(false);
  const [editUser, setEditUser]       = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser]   = useState<AdminUser | null>(null);
  const [changePwdUser, setChangePwdUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useUsuarios(page);
  const createMutation = useCreateUsuario();
  const updateMutation = useUpdateUsuario();
  const deleteMutation = useDeleteUsuario();
  const changePwd      = useChangePassword();

  const filteredUsers = useMemo(() => {
    const users = data?.usuarios ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [data?.usuarios, searchQuery]);

  const skeletonColSpan = 7;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Usuarios' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de acceso al sistema
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="size-4" />
          Crear usuario
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table className="w-full min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 px-4" />
              <TableHead className="px-4">Nombre</TableHead>
              <TableHead className="px-4">Email</TableHead>
              <TableHead className="px-4">Rol</TableHead>
              <TableHead className="px-4">Estado</TableHead>
              <TableHead className="px-4">Creado</TableHead>
              <TableHead className="px-4 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4" colSpan={skeletonColSpan}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={skeletonColSpan} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No se encontraron usuarios con esa búsqueda.' : 'No hay usuarios registrados.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  {/* Avatar */}
                  <TableCell className="px-4">
                    <UserAvatar nombre={user.nombre} rol={user.rol} />
                  </TableCell>
                  <TableCell className="px-4 font-medium text-foreground">
                    {user.nombre}
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="px-4">
                    <RolBadge rol={user.rol} />
                  </TableCell>
                  <TableCell className="px-4">
                    <EstadoBadge estado={user.estado_acceso} />
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('es-CO')}
                  </TableCell>
                  {/* Actions — always-visible icon buttons */}
                  <TableCell className="px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditUser(user)}
                        title="Editar usuario"
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangePwdUser(user)}
                        title="Cambiar contraseña"
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <KeyRound className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteUser(user)}
                        title="Eliminar usuario"
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Pag {data.page} de {data.totalPages} &middot; {data.total} usuario
            {data.total !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              &larr; Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Crear */}
      <CreateUsuarioDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(formData) =>
          createMutation.mutate(formData, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        isPending={createMutation.isPending}
      />

      {/* Dialog: Editar */}
      <EditUsuarioDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSubmit={(formData) =>
          updateMutation.mutate(
            { id: editUser!.id, ...formData },
            { onSuccess: () => setEditUser(null) },
          )
        }
        isPending={updateMutation.isPending}
      />

      {/* Dialog: Confirmar eliminacion */}
      <DeleteConfirmDialog
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteUser!.id, {
            onSuccess: () => setDeleteUser(null),
          })
        }
        isPending={deleteMutation.isPending}
      />

      {/* Dialog: Cambiar contraseña */}
      <ChangePasswordDialog
        user={changePwdUser}
        onClose={() => setChangePwdUser(null)}
        onSubmit={(pwd) => {
          if (!changePwdUser) return;
          changePwd.mutate(
            { id: changePwdUser.id, password: pwd },
            { onSuccess: () => setChangePwdUser(null) },
          );
        }}
        isPending={changePwd.isPending}
      />
    </div>
  );
}
