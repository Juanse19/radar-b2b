import { NextRequest, NextResponse } from 'next/server';
import { getResults } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const linea = searchParams.get('linea') || undefined;
  const soloActivos = searchParams.get('activos') === 'true';
  const limit = Number(searchParams.get('limit')) || 200;

  try {
    const results = await getResults({ linea, soloActivos, limit });
    return NextResponse.json(results);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
