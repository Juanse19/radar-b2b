import { NextRequest, NextResponse } from 'next/server';
import { importarEmpresas } from '@/lib/db';
import type { ImportarEmpresaData } from '@/lib/db';

/**
 * POST /api/companies/import
 * Body: { empresas: ImportarEmpresaData[] }
 * Returns: { inserted: N, skipped: M }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { empresas: ImportarEmpresaData[] };

    if (!Array.isArray(body.empresas) || body.empresas.length === 0) {
      return NextResponse.json(
        { error: 'empresas[] es requerido y debe tener al menos un elemento' },
        { status: 400 },
      );
    }

    const result = await importarEmpresas(body.empresas);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
