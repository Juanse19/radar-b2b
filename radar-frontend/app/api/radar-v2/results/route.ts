import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getRadarV2Results } from '@/lib/radar-v2/db';
import type { RadarV2ResultsFilter } from '@/lib/radar-v2/types';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const filter: RadarV2ResultsFilter = {
    linea:        searchParams.get('linea')        ?? undefined,
    radar_activo: (searchParams.get('radar_activo') as 'Sí' | 'No') ?? undefined,
    ventana:      searchParams.get('ventana')      ?? undefined,
    from:         searchParams.get('from')         ?? undefined,
    to:           searchParams.get('to')           ?? undefined,
    limit:        searchParams.get('limit')  ? Number(searchParams.get('limit'))  : 100,
    offset:       searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  };

  try {
    const results = await getRadarV2Results(filter);
    return NextResponse.json(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/results] Error:', msg);
    return NextResponse.json({ error: 'Error fetching results' }, { status: 500 });
  }
}
