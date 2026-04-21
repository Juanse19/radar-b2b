// lib/auth/permissions.ts
// Centralized role-based permissions for Matec Radar B2B.
//
// Two permission layers:
//   1. ROUTE_ACCESS  — which roles can visit a given path prefix
//   2. ACTIONS       — fine-grained per-feature checks (use canDo() in components/routes)
//
// Rules:
//   ADMIN     → everything
//   COMERCIAL → all operational pages, full CRUD, cannot access /admin (except /admin/empresas)
//   AUXILIAR  → read-only: /results and /contactos only

import type { UserRole } from './types';

// ── Route-level access ────────────────────────────────────────────────────────
// Middleware reads this to gate page navigation.
// More specific prefixes should come first if needed.

export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/admin/empresas':    ['ADMIN', 'COMERCIAL'],
  '/admin':             ['ADMIN'],
  '/scan':              ['ADMIN', 'COMERCIAL'],
  '/schedule':          ['ADMIN', 'COMERCIAL'],
  '/results':           ['ADMIN', 'COMERCIAL', 'AUXILIAR'],
  '/contactos':         ['ADMIN', 'COMERCIAL', 'AUXILIAR'],
  '/radar-v2/prompt':   ['ADMIN'],                       // solo ADMIN
  '/radar-v2':          ['ADMIN', 'COMERCIAL'],          // todos los demás submódulos radar-v2
  '/':                  ['ADMIN', 'COMERCIAL', 'AUXILIAR'], // dashboard
};

// ── Fine-grained actions ──────────────────────────────────────────────────────
// Use canDo(role, action) in server components and API route guards.

export type Action =
  // Scan / agents
  | 'scan.trigger'
  | 'scan.rescan'
  | 'schedule.create'
  | 'schedule.toggle'
  // Data management
  | 'empresas.create'
  | 'empresas.edit'
  | 'contactos.export'
  // Radar v2
  | 'radar.scan'
  | 'radar.prompt.view'
  // Admin
  | 'admin.manage_users'
  | 'admin.manage_config'
  | 'admin.view_logs';

export const ACTION_ROLES: Record<Action, UserRole[]> = {
  'scan.trigger':         ['ADMIN', 'COMERCIAL'],
  'scan.rescan':          ['ADMIN', 'COMERCIAL'],
  'schedule.create':      ['ADMIN', 'COMERCIAL'],
  'schedule.toggle':      ['ADMIN', 'COMERCIAL'],
  'empresas.create':      ['ADMIN', 'COMERCIAL'],
  'empresas.edit':        ['ADMIN', 'COMERCIAL'],
  'contactos.export':     ['ADMIN', 'COMERCIAL'],
  'radar.scan':           ['ADMIN', 'COMERCIAL'],
  'radar.prompt.view':    ['ADMIN'],
  'admin.manage_users':   ['ADMIN'],
  'admin.manage_config':  ['ADMIN'],
  'admin.view_logs':      ['ADMIN'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the given role is allowed to perform the action. */
export function canDo(role: UserRole, action: Action): boolean {
  return ACTION_ROLES[action]?.includes(role) ?? false;
}

/** Returns true if the given role can access the path. */
export function canAccess(role: UserRole, path: string): boolean {
  // Find the most specific matching prefix
  const match = Object.entries(ROUTE_ACCESS)
    .filter(([prefix]) => path === prefix || path.startsWith(prefix + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]; // longest match wins

  if (!match) return true; // unmatched paths are open (login, sin-acceso, api/*)
  return match[1].includes(role);
}

/** Human-readable label for each role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:      'Administrador',
  COMERCIAL:  'Comercial',
  AUXILIAR:   'Auxiliar',
};

/** Description of each role for UI display. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN:     'Acceso total: sistema, configuración y administración',
  COMERCIAL: 'Acceso operacional completo: escaneo, señales, contactos y empresas',
  AUXILIAR:  'Solo lectura: puede consultar resultados y contactos',
};

