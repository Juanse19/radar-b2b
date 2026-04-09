import { NextResponse } from 'next/server';
import { getConfiguracionScoring, upsertConfiguracionScoring } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subLineaId = searchParams.get('sub_linea_id');
    const data = await getConfiguracionScoring(
      subLineaId === 'null' ? null : subLineaId ? Number(subLineaId) : undefined,
    );
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    const result = await upsertConfiguracionScoring(rows);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
