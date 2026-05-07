/**
 * GET /api/prospector/v2/sessions/[id] — Devuelve metadatos + contactos
 * persistidos para una sesión del wizard. Útil para revisar resultados
 * después del SSE y para la vista historial.
 */
import { type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgFirst, pgQuery, tbl } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SessionRow {
  id:                string;
  user_id:           string | null;
  modo:              string;
  sublineas:         string[];
  tiers:             string[] | null;
  empresas_count:    number;
  total_contacts:    number;
  total_with_email:  number;
  total_with_phone:  number;
  credits_used:      number;
  duration_ms:       number | null;
  cancelled:         boolean;
  created_at:        string;
  finished_at:       string | null;
}

interface ContactoRow {
  id:                number;
  apollo_id:         string | null;
  first_name:        string | null;
  last_name:         string | null;
  title:             string | null;
  nivel_jerarquico:  string | null;
  email:             string | null;
  email_status:      string | null;
  phone_mobile:      string | null;
  phone_work_direct: string | null;
  corporate_phone:   string | null;
  linkedin_url:      string | null;
  empresa_id:        number;
  empresa_nombre:    string | null;
  pais:              string | null;
  phone_unlocked:    boolean;
  hubspot_status:    string;
  created_at:        string;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const safeId = id.replace(/'/g, "''");

  try {
    const sessionRow = await pgFirst<SessionRow>(`
      SELECT id, user_id, modo, sublineas, tiers, empresas_count,
             total_contacts, total_with_email, total_with_phone, credits_used,
             duration_ms, cancelled, created_at, finished_at
      FROM ${tbl('prospector_v2_sessions')}
      WHERE id = '${safeId}'::uuid
      LIMIT 1
    `);

    if (!sessionRow) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const contactos = await pgQuery<ContactoRow>(`
      SELECT c.id, c.apollo_id, c.first_name, c.last_name, c.title,
             c.nivel_jerarquico, c.email, c.email_status,
             c.phone_mobile, c.phone_work_direct, c.corporate_phone,
             c.linkedin_url, c.empresa_id, e.nombre AS empresa_nombre,
             c.country::TEXT AS pais, c.phone_unlocked,
             c.hubspot_status::TEXT AS hubspot_status, c.created_at
      FROM ${tbl('contactos')} c
      LEFT JOIN ${tbl('empresas')} e ON e.id = c.empresa_id
      WHERE c.prospector_session_id = '${safeId}'::uuid
      ORDER BY c.created_at ASC
    `);

    return Response.json({
      success:    true,
      session:    sessionRow,
      contactos,
    });
  } catch (err) {
    console.error('[prospector v2 sessions get]', err);
    return Response.json({
      success: false,
      error:   err instanceof Error ? err.message : 'Failed to load session',
    }, { status: 500 });
  }
}
