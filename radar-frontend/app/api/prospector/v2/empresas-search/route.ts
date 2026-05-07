/**
 * POST /api/prospector/v2/empresas-search
 *
 * Catálogo de empresas para el modo Manual del wizard. Soporta
 * búsqueda server-side por nombre/dominio/país y filtro por sub-líneas.
 *
 * Body:
 *   {
 *     sublineaIds?: number[],   // si vacío, todas
 *     search?:      string,     // matchea LOWER(company_name|company_domain|pais)
 *     tiers?:       string[],   // ['A','B','C','D','sin_calificar']
 *     limit?:       number,     // 1..500 (default 200)
 *   }
 */
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, tbl } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  sublineaIds: z.array(z.number().int().positive()).optional(),
  search:      z.string().max(200).optional(),
  tiers:       z.array(z.string()).optional(),
  limit:       z.number().int().min(1).max(500).optional(),
});

interface EmpresaRow {
  id:               number;
  nombre:           string;
  dominio:          string | null;
  pais:             string | null;
  tier:             string;
  sub_linea_id:     number | null;
  sub_linea_codigo: string | null;
}

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

  const limit = body.limit ?? 200;
  const search = body.search?.trim() ?? '';
  const safeSearch = search.replace(/'/g, "''").replace(/[%_]/g, ch => `\\${ch}`);

  const sublineaFilter = body.sublineaIds?.length
    ? `AND esl.sub_linea_id IN (${body.sublineaIds.map(Number).join(',')})`
    : '';

  const tiersFilter = body.tiers?.length
    ? `AND e.tier_actual::TEXT IN (${body.tiers.map(t => `'${String(t).replace(/'/g, "''")}'`).join(',')})`
    : '';

  const searchFilter = search
    ? `AND (
         LOWER(e.company_name)   LIKE LOWER('%${safeSearch}%') OR
         LOWER(COALESCE(e.company_domain, '')) LIKE LOWER('%${safeSearch}%') OR
         LOWER(COALESCE(e.pais_nombre, '')) LIKE LOWER('%${safeSearch}%')
       )`
    : '';

  const query = `
    SELECT *
    FROM (
      SELECT DISTINCT ON (e.id)
        e.id,
        e.company_name        AS nombre,
        e.company_domain      AS dominio,
        e.pais::TEXT          AS pais,
        e.tier_actual::TEXT   AS tier,
        esl.sub_linea_id,
        sln.codigo            AS sub_linea_codigo
      FROM ${tbl('empresas')} e
      LEFT JOIN ${tbl('empresa_sub_lineas')} esl ON esl.empresa_id = e.id
      LEFT JOIN ${tbl('sub_lineas_negocio')} sln ON sln.id        = esl.sub_linea_id
      WHERE 1 = 1
        ${sublineaFilter}
        ${tiersFilter}
        ${searchFilter}
      ORDER BY e.id
    ) AS sub
    ORDER BY LOWER(nombre)
    LIMIT ${limit}
  `;

  try {
    const rows = await pgQuery<EmpresaRow>(query);
    return Response.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error('[prospector v2 empresas-search]', err);
    return Response.json({
      success: false,
      error:   err instanceof Error ? err.message : 'Failed to load empresas',
    }, { status: 500 });
  }
}
