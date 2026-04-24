import { NextResponse } from 'next/server';
import { getJobTitlesByLinea, getJobTitlesAll, upsertJobTitlesBulk } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subLineaId = searchParams.get('sub_linea_id');
    const data = subLineaId
      ? await getJobTitlesByLinea(Number(subLineaId))
      : await getJobTitlesAll();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { sub_linea_id, titulos } = await req.json();
    if (!sub_linea_id || !Array.isArray(titulos)) {
      return NextResponse.json({ error: 'sub_linea_id y titulos[] requeridos' }, { status: 400 });
    }
    const result = await upsertJobTitlesBulk(sub_linea_id, titulos);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
