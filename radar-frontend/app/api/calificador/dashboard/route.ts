/**
 * GET /api/calificador/dashboard
 *
 * Devuelve datos para el tab "Empresas" del Calificador V2:
 *   - stats: count de calificaciones por tier (A / B / C / D)
 *   - calificaciones: array enriquecido con empresa_nombre + país + línea
 *     desde la view `comercial_calificaciones`.
 *
 * Query params (todos opcionales):
 *   - limit:  número de filas a devolver (default 200, max 500)
 *   - linea:  filtrar por línea de negocio
 *   - tier:   filtrar por tier (A | B | C | D)
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { pgQuery, SCHEMA, pgLit } from '@/lib/db/supabase/pg_client';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CalificacionRow {
  id:                       number;
  empresa_id:               number | null;
  empresa_nombre:           string | null;
  pais:                     string | null;
  linea_negocio:            string | null;
  tier_calculado:           string;
  score_total:              number;
  score_impacto:            number | null;
  score_multiplanta:        number | null;
  score_recurrencia:        number | null;
  score_referente:          number | null;
  score_acceso_al_decisor:  number | null;
  score_anio:               number | null;
  score_ticket:             number | null;
  score_prioridad:          number | null;
  score_cuenta_estrategica: number | null;
  provider:                 string | null;
  session_id:               string | null;
  created_at:               string;
}

interface StatsRow { tier: string; count: number }

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '200'), 500);
  const linea = searchParams.get('linea');
  const tier  = searchParams.get('tier');

  const where: string[] = ['c.is_v2 = TRUE'];
  if (linea) where.push(`COALESCE(c.linea_negocio, l.nombre) = ${pgLit(linea)}`);
  if (tier)  where.push(`c.tier_calculado::TEXT = ${pgLit(tier)}`);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  try {
    // Una sola query — stats se calculan client-side en el endpoint a partir
    // de las filas ya cargadas. Evita el round-trip extra a Supabase y
    // mantiene los counts consistentes con el listado mostrado.
    const rows = await pgQuery<CalificacionRow>(
      `SELECT
         c.id,
         c.empresa_id,
         e.company_name                AS empresa_nombre,
         e.pais_nombre                 AS pais,
         COALESCE(c.linea_negocio, l.nombre) AS linea_negocio,
         c.tier_calculado::TEXT        AS tier_calculado,
         c.score_total,
         c.score_impacto,
         c.score_multiplanta,
         c.score_recurrencia,
         c.score_referente,
         c.score_acceso_al_decisor,
         c.score_anio,
         c.score_ticket,
         c.score_prioridad,
         c.score_cuenta_estrategica,
         c.provider,
         c.session_id::TEXT            AS session_id,
         c.created_at::TEXT            AS created_at
       FROM ${SCHEMA}.calificaciones c
       LEFT JOIN ${SCHEMA}.empresas          e  ON e.id  = c.empresa_id
       LEFT JOIN ${SCHEMA}.sub_lineas_negocio sl ON sl.id = c.sub_linea_id
       LEFT JOIN ${SCHEMA}.lineas_negocio    l  ON l.id  = sl.linea_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT ${pgLit(limit)}`,
    );

    // Stats agregados desde las filas (in-memory, costo despreciable).
    const statsMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const seen = new Set<string | number>();
    for (const r of rows) {
      const t = r.tier_calculado === 'B-Alta' || r.tier_calculado === 'B-Baja'
        ? 'B'
        : r.tier_calculado;
      if (t in statsMap) statsMap[t] += 1;
      if (r.empresa_id != null) seen.add(r.empresa_id);
      else if (r.empresa_nombre) seen.add(r.empresa_nombre);
    }

    return NextResponse.json(
      {
        stats:           statsMap,
        empresasUnicas:  seen.size,
        calificaciones:  rows,
        total:           rows.length,
      },
      {
        status:  200,
        // Cache breve para que cambiar entre tabs Empresas ↔ Histórico
        // no dispare un fetch nuevo cada vez (mejora UX percibida).
        headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, stats: { A: 0, B: 0, C: 0, D: 0 }, empresasUnicas: 0, calificaciones: [], total: 0 },
      { status: 200 },
    );
  }
}
