import { NextRequest, NextResponse } from 'next/server';
import { getLineaById, actualizarLinea, eliminarLinea } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const linea = await getLineaById(Number(id));
    if (!linea) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(linea);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const linea = await actualizarLinea(Number(id), body);
    return NextResponse.json(linea);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await eliminarLinea(Number(id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
