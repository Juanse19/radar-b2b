import { NextResponse } from 'next/server';
import { getRadarScans, crearRadarScan, getRadarFuentes } from '@/lib/db';
import type { GetRadarScansFilter } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get('scan_id');

    // Fetch fuentes of a specific scan
    if (scanId) {
      const fuentes = await getRadarFuentes(Number(scanId));
      return NextResponse.json(fuentes);
    }

    const filter: GetRadarScansFilter = {
      empresaId:    searchParams.get('empresa_id') ? Number(searchParams.get('empresa_id')) : undefined,
      radarActivo:  searchParams.get('activo')     ? searchParams.get('activo') === 'true'  : undefined,
      scoreGte:     searchParams.get('score_gte')  ? Number(searchParams.get('score_gte'))  : undefined,
      from:         searchParams.get('from')        ?? undefined,
      to:           searchParams.get('to')          ?? undefined,
      limit:        searchParams.get('limit')       ? Number(searchParams.get('limit'))      : 50,
      offset:       searchParams.get('offset')      ? Number(searchParams.get('offset'))     : 0,
    };
    const data = await getRadarScans(filter);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scan = await crearRadarScan(body);
    return NextResponse.json(scan, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
