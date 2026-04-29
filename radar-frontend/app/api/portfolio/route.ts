/**
 * GET /api/portfolio — Vista consolidada de empresas (v5).
 *
 * JOIN empresas + último radar_scan + última calificación + count contactos.
 * Filtros (querystring):
 *   ?linea=...&tier=...&pais=...&radar=true|false
 *   &sublinea=...&page=1&limit=50
 *   &source=radar_signal  // empresas nuevas descubiertas en Modo Señales
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

interface PortfolioRow {
  id:                     number;
  company_name:           string;
  pais:                   string | null;
  pais_nombre:            string | null;
  sub_linea_id:           number | null;
  tier_actual:            string;
  score_total_ultimo:     number | null;
  score_radar_ultimo:     number | null;
  composite_score_ultimo: number | null;
  radar_activo:           string;
  pipeline:               string;
  ultimo_scan_at:         string | null;
  ultima_calificacion_at: string | null;
  meta:                   Record<string, unknown> | null;
  contactos_count:        number;
  ultima_senal_descripcion: string | null;
  ultima_senal_tipo:        string | null;
  ultima_senal_fecha:       string | null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const linea     = sp.get('linea')    ?? undefined;
  const sublinea  = sp.get('sublinea') ?? undefined;
  const tier      = sp.get('tier')     ?? undefined;
  const pais      = sp.get('pais')     ?? undefined;
  const radar     = sp.get('radar');
  const source    = sp.get('source')   ?? undefined;
  const search    = sp.get('q')        ?? undefined;
  const page      = Math.max(Number(sp.get('page') ?? '1'), 1);
  const limit     = Math.min(Math.max(Number(sp.get('limit') ?? '50'), 1), 200);
  const offset    = (page - 1) * limit;

  const where: string[] = [];
  if (linea)    where.push(`(meta->>'linea' = ${pgLit(linea)} OR EXISTS (SELECT 1 FROM ${S}.sub_lineas_negocio sl WHERE sl.id = e.sub_linea_principal_id AND sl.linea_negocio = ${pgLit(linea)}))`);
  if (sublinea) where.push(`meta->>'sub_linea' = ${pgLit(sublinea)}`);
  if (tier)     where.push(`tier_actual = ${pgLit(tier)}::${S}.tier_enum`);
  if (pais)     where.push(`(pais_nombre ILIKE ${pgLit('%' + pais + '%')} OR pais::text = ${pgLit(pais)})`);
  if (radar === 'true')  where.push(`radar_activo = 'activo'::${S}.radar_activo_enum`);
  if (radar === 'false') where.push(`radar_activo <> 'activo'::${S}.radar_activo_enum`);
  if (source)   where.push(`meta->>'source' = ${pgLit(source)}`);
  if (search)   where.push(`company_name_norm LIKE lower(${S}.f_unaccent(${pgLit('%' + search + '%')}))`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const rows = await pgQuery<PortfolioRow>(`
      SELECT
        e.id,
        e.company_name,
        e.pais::text                                     AS pais,
        e.pais_nombre,
        e.sub_linea_principal_id                          AS sub_linea_id,
        e.tier_actual::text                               AS tier_actual,
        e.score_total_ultimo,
        e.score_radar_ultimo,
        e.composite_score_ultimo,
        e.radar_activo::text                              AS radar_activo,
        e.pipeline::text                                  AS pipeline,
        e.ultimo_scan_at,
        e.ultima_calificacion_at,
        e.meta,
        COALESCE(c.cnt, 0)                                AS contactos_count,
        rs.descripcion                                    AS ultima_senal_descripcion,
        rs.tipo_senal                                     AS ultima_senal_tipo,
        rs.created_at::text                               AS ultima_senal_fecha
      FROM ${S}.empresas e
      LEFT JOIN (
        SELECT empresa_id, COUNT(*) AS cnt
        FROM ${S}.contactos
        GROUP BY empresa_id
      ) c ON c.empresa_id = e.id
      LEFT JOIN LATERAL (
        SELECT descripcion, tipo_senal, created_at
        FROM ${S}.radar_signals
        WHERE empresa_id = e.id
        ORDER BY created_at DESC
        LIMIT 1
      ) rs ON TRUE
      ${whereClause}
      ORDER BY
        CASE e.tier_actual::text WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 ELSE 3 END,
        e.composite_score_ultimo DESC NULLS LAST,
        e.ultimo_scan_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRow = await pgQuery<{ total: number }>(`
      SELECT COUNT(*)::int AS total FROM ${S}.empresas e ${whereClause}
    `);

    return NextResponse.json({
      data: rows,
      meta: {
        total: totalRow[0]?.total ?? 0,
        page,
        limit,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/portfolio] Error:', msg);
    // Si la tabla radar_signals aún no existe (migración pendiente), devolver
    // un payload vacío en lugar de 500 — el caller decide cómo mostrarlo.
    if (msg.includes('does not exist') || msg.includes('relation')) {
      return NextResponse.json({ data: [], meta: { total: 0, page, limit }, warning: msg });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
