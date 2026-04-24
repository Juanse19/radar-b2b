// lib/auth/audit.ts
//
// Best-effort audit logging. Call this from server actions and API routes.
// NEVER throws — a logging failure must never break the caller.
'server-only';

import { getAdminDb } from '@/lib/db/supabase/admin';
import type { SessionUser } from './types';

export async function logActividad(
  session: SessionUser | null,
  tipo: string,
  descripcion?: string,
  resultado: 'ok' | 'error' | 'warn' = 'ok',
  metadata?: unknown,
): Promise<void> {
  // Skip silently if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  try {
    const admin = getAdminDb();
    await admin.from('actividad').insert({
      usuario_id:    session?.id    ?? null,
      usuario_email: session?.email ?? null,
      tipo,
      descripcion:   descripcion ?? null,
      resultado,
      metadata:      metadata ?? null,
    });
  } catch {
    // Swallow — logging must never interrupt business logic
  }
}
