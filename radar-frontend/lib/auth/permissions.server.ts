// lib/auth/permissions.server.ts
// Server-only helpers that extend lib/auth/permissions.ts with DB access.
// Do NOT import this file from client components or middleware.
import 'server-only';

import { ACTION_ROLES } from './permissions';
import type { UserRole } from './types';

/**
 * Fetches role permissions dynamically from the DB.
 * Falls back to the hardcoded ACTION_ROLES if the DB is unavailable.
 * Used in server contexts (API routes, server components).
 */
export async function getUserPermissions(roleSlug: string): Promise<string[]> {
  try {
    const { getAdminDb } = await import('@/lib/db/supabase/admin');
    const db = getAdminDb();
    const { data, error } = await db
      .from('roles_permisos')
      .select('system_permisos(clave)')
      .eq('system_roles.slug', roleSlug);

    if (error || !data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.flatMap((row: any) => row.system_permisos?.clave ? [row.system_permisos.clave] : []);
  } catch {
    // Fallback: return hardcoded permissions if DB unavailable
    const roleUpper = roleSlug.toUpperCase() as UserRole;
    return Object.entries(ACTION_ROLES)
      .filter(([, roles]) => roles.includes(roleUpper))
      .map(([action]) => action);
  }
}
