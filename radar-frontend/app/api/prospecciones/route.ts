import { NextResponse } from 'next/server';
import { getPropecciones, crearProspeccion } from '@/lib/db';
import type { GetProspeccionesFilter, EstadoProspeccionEnum } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter: GetProspeccionesFilter = {
      empresaId:  searchParams.get('empresa_id') ? Number(searchParams.get('empresa_id'))  : undefined,
      estado:     (searchParams.get('estado') as EstadoProspeccionEnum) ?? undefined,
      subLineaId: searchParams.get('sub_linea_id') ? Number(searchParams.get('sub_linea_id')) : undefined,
      from:       searchParams.get('from')    ?? undefined,
      to:         searchParams.get('to')      ?? undefined,
      limit:      searchParams.get('limit')   ? Number(searchParams.get('limit'))           : 50,
      offset:     searchParams.get('offset')  ? Number(searchParams.get('offset'))          : 0,
    };
    const data = await getPropecciones(filter);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prosp = await crearProspeccion(body);
    return NextResponse.json(prosp, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
