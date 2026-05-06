/**
 * POST /api/prospector/v2/auto-select — preselección de empresas para el modo Auto.
 *
 * Body:
 *   {
 *     sublineaIds: number[],      // IDs de matec_radar.sub_lineas_negocio
 *     tiers:       string[],      // ej. ['A-ORO','A','B','C']
 *     count:       number,        // 1..50
 *     excludeWithContacts?: boolean
 *   }
 *
 * Devuelve hasta `count` empresas elegibles, escogidas aleatoriamente
 * dentro de los tiers seleccionados. El usuario puede ajustar la lista
 * manualmente después en Step 2 del wizard.
 */
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { getEmpresasPorTier } from '@/lib/prospector/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  sublineaIds:         z.array(z.number().int().positive()).min(1),
  tiers:               z.array(z.string()).min(1),
  count:               z.number().int().min(1).max(50),
  excludeWithContacts: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid body';
    return Response.json({ error: `Invalid body: ${msg}` }, { status: 400 });
  }

  try {
    const empresas = await getEmpresasPorTier({
      sublineaIds:         body.sublineaIds,
      tiers:               body.tiers,
      count:               body.count,
      excludeWithContacts: body.excludeWithContacts,
    });
    return Response.json({ success: true, data: empresas });
  } catch (err) {
    console.error('[prospector v2 auto-select]', err);
    return Response.json({
      success: false,
      error:   err instanceof Error ? err.message : 'Failed to select empresas',
    }, { status: 500 });
  }
}
