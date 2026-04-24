import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getRadarV2Results } from '@/lib/comercial/db';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { ComercialResultsFilter } from '@/lib/comercial/types';

const S = SCHEMA;

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const filter: ComercialResultsFilter = {
    linea:        searchParams.get('linea')        ?? undefined,
    radar_activo: (searchParams.get('radar_activo') as 'Sí' | 'No') ?? undefined,
    ventana:      searchParams.get('ventana')      ?? undefined,
    from:         searchParams.get('from')         ?? undefined,
    to:           searchParams.get('to')           ?? undefined,
    limit:        searchParams.get('limit')  ? Number(searchParams.get('limit'))  : 100,
    offset:       searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  };

  try {
    // Build same WHERE conditions as getRadarV2Results for the count query
    const countWhere: string[] = [];
    if (filter.linea)        countWhere.push(`linea_negocio = ${pgLit(filter.linea)}`);
    if (filter.radar_activo) countWhere.push(`radar_activo = ${pgLit(filter.radar_activo)}`);
    if (filter.ventana)      countWhere.push(`ventana_compra = ${pgLit(filter.ventana)}`);
    if (filter.from)         countWhere.push(`created_at >= ${pgLit(filter.from)}`);
    if (filter.to)           countWhere.push(`created_at <= ${pgLit(filter.to)}`);

    const [resultsRows, countRows] = await Promise.all([
      getRadarV2Results(filter),
      pgQuery<{ total: string; activas: string; descartadas: string }>(
        `SELECT
           COUNT(*)::text                                               AS total,
           COUNT(*) FILTER (WHERE radar_activo = 'Sí')::text          AS activas,
           COUNT(*) FILTER (WHERE radar_activo = 'No')::text          AS descartadas
         FROM ${S}.radar_v2_results
         ${countWhere.length ? 'WHERE ' + countWhere.join(' AND ') : ''}`,
      ),
    ]);

    const totals = countRows[0];
    return NextResponse.json({
      results:     resultsRows,
      total_count: parseInt(totals?.total       ?? '0', 10),
      activas:     parseInt(totals?.activas     ?? '0', 10),
      descartadas: parseInt(totals?.descartadas ?? '0', 10),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/comercial/results] Error:', msg);
    return NextResponse.json({ error: 'Error fetching results' }, { status: 500 });
  }
}
