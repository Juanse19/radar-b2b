import { NextResponse } from 'next/server';
import { getCalificaciones, crearCalificacion, getTopEmpresasByTier } from '@/lib/db';
import type { GetCalificacionesFilter, TierEnum } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topTier = searchParams.get('top_tier') as TierEnum | null;

    if (topTier) {
      const limit = Number(searchParams.get('limit') ?? '50');
      const data = await getTopEmpresasByTier(topTier, limit);
      return NextResponse.json(data);
    }

    const filter: GetCalificacionesFilter = {
      empresaId:     searchParams.get('empresa_id')     ? Number(searchParams.get('empresa_id'))     : undefined,
      tierCalculado: (searchParams.get('tier_calculado') as TierEnum) ?? undefined,
      from:          searchParams.get('from')           ?? undefined,
      to:            searchParams.get('to')             ?? undefined,
      limit:         searchParams.get('limit')          ? Number(searchParams.get('limit'))          : 50,
      offset:        searchParams.get('offset')         ? Number(searchParams.get('offset'))         : 0,
    };
    const data = await getCalificaciones(filter);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cal = await crearCalificacion(body);
    return NextResponse.json(cal, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
