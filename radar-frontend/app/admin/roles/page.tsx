// app/admin/roles/page.tsx — Roles & permissions reference (read-only)
import {
  Shield,
  CheckCircle,
  XCircle,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROUTE_ACCESS,
  canDo,
} from '@/lib/auth/permissions';
import type { Action } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-purple-400" />
          <h1 className="text-2xl font-bold text-foreground">Roles y Permisos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Referencia de accesos por rol. Esta página es de solo lectura.
        </p>
      </header>

      {/* ── Sección 1 — Descripción de roles ─────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide text-muted-foreground">
          Descripción de roles
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {ROLES.map(role => (
            <Card key={role} className="border-border bg-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${ROLE_BADGE[role]}`}>
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
                    {ROLE_MEMBERS[role].map(member => (
                      <li key={member} className="text-xs text-foreground/80">{member}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Sección 2 — Acceso a módulos ─────────────────────────────────────── */}
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
                    {ROLES.map(role => <RoleHeaderCell key={role} role={role} />)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ROUTE_LABELS.map(({ path, label }) => {
                    const allowed = ROUTE_ACCESS[path] ?? ROLES;
                    return (
                      <tr key={path} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {label}
                          <span className="ml-2 text-[11px] text-muted-foreground font-mono">{path}</span>
                        </td>
                        {ROLES.map(role => (
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

      {/* ── Sección 3 — Permisos por acción ──────────────────────────────────── */}
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
                    {ROLES.map(role => <RoleHeaderCell key={role} role={role} />)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(Object.entries(ACTION_LABELS) as [Action, string][]).map(([action, label]) => (
                    <tr key={action} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{label}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{action}</td>
                      {ROLES.map(role => (
                        <td key={role} className="px-4 py-3 text-center">
                          <PermissionCell allowed={canDo(role, action)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
