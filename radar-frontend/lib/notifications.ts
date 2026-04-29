/**
 * lib/notifications.ts — Notificaciones in-app (v5).
 * Persiste en matec_radar.notificaciones (creada en migración 20260427_001).
 */
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

export type NotifTipo = 'scan_alta' | 'empresa_nueva' | 'scan_completado' | 'calificacion' | 'sistema';

export interface NotifRow {
  id:         string;
  user_id:    string | null;
  tipo:       NotifTipo;
  titulo:     string;
  mensaje:    string | null;
  link:       string | null;
  meta:       Record<string, unknown>;
  leida:      boolean;
  created_at: string;
  read_at:    string | null;
}

export interface CreateNotifInput {
  user_id?: string | null;
  tipo:     NotifTipo;
  titulo:   string;
  mensaje?: string;
  link?:    string;
  meta?:    Record<string, unknown>;
}

export async function createNotification(input: CreateNotifInput): Promise<NotifRow | null> {
  try {
    const row = await pgFirst<NotifRow>(`
      INSERT INTO ${S}.notificaciones (user_id, tipo, titulo, mensaje, link, meta)
      VALUES (
        ${pgLit(input.user_id ?? null)},
        ${pgLit(input.tipo)},
        ${pgLit(input.titulo)},
        ${pgLit(input.mensaje ?? null)},
        ${pgLit(input.link ?? null)},
        ${pgLit(JSON.stringify(input.meta ?? {}))}::jsonb
      )
      RETURNING *
    `);
    return row ?? null;
  } catch (err) {
    console.error('[createNotification] failed:', err);
    return null;
  }
}

export async function listNotifications(opts: {
  user_id?:    string | null;
  unreadOnly?: boolean;
  limit?:      number;
} = {}): Promise<NotifRow[]> {
  const where: string[] = [];
  if (opts.user_id !== undefined) where.push(`user_id = ${pgLit(opts.user_id)}`);
  if (opts.unreadOnly)            where.push('leida = false');
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(opts.limit ?? 20, 100);

  return pgQuery<NotifRow>(`
    SELECT * FROM ${S}.notificaciones
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
}

export async function countUnread(user_id: string | null): Promise<number> {
  try {
    const row = await pgFirst<{ cnt: number }>(`
      SELECT COUNT(*)::int AS cnt FROM ${S}.notificaciones
      WHERE leida = false AND ${user_id ? `user_id = ${pgLit(user_id)}` : 'user_id IS NULL'}
    `);
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}

export async function markRead(id: string): Promise<void> {
  await pgQuery(`
    UPDATE ${S}.notificaciones
    SET leida = true, read_at = NOW()
    WHERE id = ${pgLit(id)}
  `);
}

export async function markAllRead(user_id: string | null): Promise<void> {
  await pgQuery(`
    UPDATE ${S}.notificaciones
    SET leida = true, read_at = NOW()
    WHERE leida = false AND ${user_id ? `user_id = ${pgLit(user_id)}` : 'user_id IS NULL'}
  `);
}
