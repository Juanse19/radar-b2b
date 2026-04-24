import { NextRequest, NextResponse } from 'next/server';
import { getEmpresasByLinea, getEmpresasCount, crearEmpresa } from '@/lib/db';

/**
 * GET /api/companies?linea=BHS&limit=50
 *   → Array de empresas de la línea (máx limit)
 *
 * GET /api/companies?count=true
 *   → { BHS: 130, Cartón: 150, Intralogística: 220 }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const count  = searchParams.get('count');
  const linea  = searchParams.get('linea') ?? 'ALL';
  const limit  = Math.min(Number(searchParams.get('limit') ?? '50'), 500);
  const offset = Number(searchParams.get('offset') ?? '0');

  try {
    if (count === 'true') {
      const raw = await getEmpresasCount();
      // Merge legacy "Intralogistica" (without accent) into canonical "Intralogística"
      const counts: Record<string, number> = {};
      for (const [key, val] of Object.entries(raw)) {
        const canonical = key === 'Intralogistica' ? 'Intralogística' : key;
        counts[canonical] = (counts[canonical] ?? 0) + val;
      }
      return NextResponse.json(counts);
    }

    const empresas = await getEmpresasByLinea(linea, limit, offset);
    return NextResponse.json(empresas);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    // Log completo en servidor para debugging (visible en terminal del dev server)
    console.error('[GET /api/companies] Error:', msg, error);
    // Devolver array vacío para no romper el frontend con "filtered.map is not a function"
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_name, company_domain, company_url, pais, ciudad, linea_negocio, tier } = body;

    if (!company_name || typeof company_name !== 'string' || company_name.trim() === '') {
      return NextResponse.json({ error: 'company_name es requerido' }, { status: 400 });
    }
    if (!linea_negocio || typeof linea_negocio !== 'string') {
      return NextResponse.json({ error: 'linea_negocio es requerido' }, { status: 400 });
    }

    const empresa = await crearEmpresa({
      company_name:   company_name.trim(),
      company_domain: company_domain ?? undefined,
      company_url:    company_url    ?? undefined,
      pais:           pais           ?? undefined,
      ciudad:         ciudad         ?? undefined,
      linea_negocio,
      tier:           tier           ?? undefined,
    });

    return NextResponse.json(
      { id: empresa.id, company_name: empresa.company_name, linea_negocio },
      { status: 201 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
