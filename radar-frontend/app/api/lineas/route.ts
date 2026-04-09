import { NextResponse } from 'next/server';
import { getLineas, crearLinea } from '@/lib/db';

export async function GET() {
  try {
    const lineas = await getLineas();
    return NextResponse.json(lineas);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const linea = await crearLinea(body);
    return NextResponse.json(linea, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
