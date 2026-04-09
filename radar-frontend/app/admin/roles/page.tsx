'use client';
// app/admin/roles/page.tsx — Roles & permissions reference + role assignment

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, CheckCircle, XCircle, Users, Loader2 } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROUTE_ACCESS,
  canDo,
} from '@/lib/auth/permissions';
import type { Action } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';
import { fetchJson, ApiError } from '@/lib/fetcher';

// ── Static data ────────────────────────────────────────────────────────────────

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

// Route display names — ordered for the table
const ROUTE_LABELS: { path: string; label: string }[] = [
  { path: '/',          label: 'Dashboard' },
  { path: '/scan',      label: 'Escanear' },
  { path: '/results',   label: 'Resultados' },
  { path: '/contactos', label: 'Contactos' },
  { path: '/empresas',  label: 'Empresas' },
  { path: '/schedule',  label: 'Cronograma' },
  { path: '/admin',     label: 'Administración' },
];

// Action display labels in Spanish
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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
      <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${ROLE_BADGE[role]}`}>
        {ROLE_LABELS[role]}
      </span>
    </th>
  );
}

function RolBadge({ rol }: { rol: string }) {
  const roleKey = (rol as UserRole) in ROLE_BADGE ? (rol as UserRole) : 'AUXILIAR';
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${ROLE_BADGE[roleKey]}`}>
      {ROLE_LABELS[roleKey] ?? rol}
    </span>
  );
}

// ── Types for usuarios API ─────────────────────────────────────────────────────

interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado_acceso: string;
}

interface UsuariosResponse {
  usuarios: UsuarioRow[];
  total: number;
}

// ── Tab: Asignar Roles ─────────────────────────────────────────────────────────

function AsignarRolesTab() {
  const qc = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<UsuariosResponse>({
    queryKey: ['admin-usuarios-roles'],
    queryFn: () => fetchJson<UsuariosResponse>('/api/admin/usuarios?limit=100'),
  });

  const usuarios = data?.usuarios ?? [];

  async function handleRolChange(userId: string, newRol: string) {
    setUpdating(userId);
    try {
      await fetchJson(`/api/admin/usuarios/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: newRol }),
      });
      toast.success('Rol actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['admin-usuarios-roles'] });
    } catch (err) {
      toast.error(
        `Error al actualizar rol: ${err instanceof ApiError ? err.message : 'Desconocido'}`
      );
    } finally {
      setUpdating(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Cargando usuarios…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">
        Error al cargar usuarios:{' '}
        {error instanceof ApiError ? error.message : 'Desconocido'}
      </p>
    );
  }

  if (usuarios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No hay usuarios registrados.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Selecciona un usuario para cambiar su rol en el sistema.
      </p>

      {usuarios.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-surface"
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#142e47] flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {(u.nombre || u.email).slice(0, 1).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{u.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          </div>

          {/* Rol actual badge */}
          <RolBadge rol={u.rol} />

          {/* Select para cambiar rol */}
          <div className="relative">
            {updating === u.id && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            )}
            <Select
              value={u.rol}
              onValueChange={(newRol) => { if (newRol) handleRolChange(u.id, newRol); }}
              disabled={updating === u.id}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="COMERCIAL">Comercial</SelectItem>
                <SelectItem value="AUXILIAR">Auxiliar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type TabId = 'descripcion' | 'matriz' | 'asignar';

const TABS: { id: TabId; label: string }[] = [
  { id: 'descripcion', label: 'Descripción' },
  { id: 'matriz',      label: 'Matriz de permisos' },
  { id: 'asignar',     label: 'Asignar roles' },
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

      {/* ── Tab navigation ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#142e47] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Descripción ─────────────────────────────────────────────────── */}
      {activeTab === 'descripcion' && (
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
      )}

      {/* ── Tab: Matriz de permisos ───────────────────────────────────────────── */}
      {activeTab === 'matriz' && (
        <div className="space-y-8">
          {/* Acceso a módulos */}
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

          {/* Permisos por acción */}
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
                          <tr
                            key={action}
                            className="hover:bg-surface-muted/30 transition-colors"
                          >
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
      )}

      {/* ── Tab: Asignar roles ────────────────────────────────────────────────── */}
      {activeTab === 'asignar' && <AsignarRolesTab />}
    </div>
  );
}
