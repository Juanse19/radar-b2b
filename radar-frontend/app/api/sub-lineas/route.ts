import { NextResponse } from 'next/server';
import { getSubLineas, crearSubLinea } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lineaId = searchParams.get('linea_id') ? Number(searchParams.get('linea_id')) : undefined;
    const sublineas = await getSubLineas(lineaId);
    return NextResponse.json(sublineas);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sublinea = await crearSubLinea(body);
    return NextResponse.json(sublinea, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
