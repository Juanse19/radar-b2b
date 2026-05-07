/**
 * POST /api/prospector/v2/contacts/[id]/unlock-phone
 *
 * Desbloquea el teléfono móvil de un contacto previamente prospectado.
 * Llama a Apollo Bulk Match con `reveal_phone_number=true` (9 créditos)
 * y persiste el teléfono + flag phone_unlocked=true.
 *
 * Idempotencia: si phone_unlocked=true ya, devuelve 200 con el teléfono actual
 * sin gastar créditos.
 */
import { type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgFirst, tbl } from '@/lib/db/supabase/pg_client';
import { apolloEnrich } from '@/lib/apollo/enrich';
import { ApolloHttpError, ApolloRateLimitError } from '@/lib/apollo/client';
import { markPhoneUnlocked } from '@/lib/prospector/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ContactoLookupRow {
  id:             number;
  apollo_id:      string | null;
  phone_mobile:   string | null;
  phone_unlocked: boolean;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const contactoId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(contactoId) || contactoId <= 0) {
    return Response.json({ error: 'Invalid contact id' }, { status: 400 });
  }

  // 1. Buscar el contacto en BD
  let row: ContactoLookupRow | null;
  try {
    row = await pgFirst<ContactoLookupRow>(`
      SELECT id, apollo_id, phone_mobile, phone_unlocked
      FROM ${tbl('contactos')}
      WHERE id = ${contactoId}
      LIMIT 1
    `);
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : 'DB lookup failed',
    }, { status: 500 });
  }

  if (!row) {
    return Response.json({ error: 'Contact not found' }, { status: 404 });
  }

  if (!row.apollo_id) {
    return Response.json({
      error: 'Contact has no apollo_id — cannot unlock phone via Apollo',
    }, { status: 400 });
  }

  // 2. Idempotencia: si ya está desbloqueado, retornar el teléfono actual
  if (row.phone_unlocked && row.phone_mobile) {
    return Response.json({
      success:        true,
      already_unlocked: true,
      tel_movil:      row.phone_mobile,
      contacto_id:    row.id,
    });
  }

  // 3. Apollo Enrich con reveal_phone_number=true
  let enriched;
  try {
    enriched = await apolloEnrich([row.apollo_id], { revealPhone: true });
  } catch (err) {
    if (err instanceof ApolloRateLimitError) {
      return Response.json({
        error:    'Apollo rate limit',
        retry_in_ms: err.retryAfterMs,
      }, { status: 429 });
    }
    if (err instanceof ApolloHttpError) {
      return Response.json({
        error:  `Apollo HTTP ${err.status}`,
        body:   err.body.slice(0, 300),
      }, { status: 502 });
    }
    return Response.json({
      error: err instanceof Error ? err.message : 'Apollo call failed',
    }, { status: 502 });
  }

  const data = enriched[0];
  const mobile = data?.phone_numbers?.find(p => p.type === 'mobile')?.raw_number
    ?? data?.sanitized_phone
    ?? null;

  if (!mobile) {
    return Response.json({
      error:           'No mobile phone available in Apollo',
      contacto_id:     row.id,
      apollo_id:       row.apollo_id,
    }, { status: 404 });
  }

  // 4. Persistir + flag
  try {
    await markPhoneUnlocked({ contacto_id: row.id, tel_movil: mobile });
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : 'DB update failed',
    }, { status: 500 });
  }

  return Response.json({
    success:     true,
    tel_movil:   mobile,
    contacto_id: row.id,
    credits_used: 9,
  });
}
