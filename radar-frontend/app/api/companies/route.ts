import { NextRequest, NextResponse } from 'next/server';
import { getEmpresasByLinea, getEmpresasCount, crearEmpresa } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';

/**
 * GET /api/companies?linea=BHS&limit=50
 *   → Array de empresas de la línea (máx limit)
 *
 * GET /api/companies?count=true
 *   → { BHS: 130, Cartón: 150, Intralogística: 220 }
 */
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    // Map DB row → Empresa interface (nombre, dominio, linea, pais as full name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = empresas.map((e: any) => ({
      id:      e.id,
      nombre:  e.company_name  ?? e.nombre ?? '',
      dominio: e.company_domain ?? e.dominio ?? null,
      pais:    e.pais_nombre   ?? e.pais    ?? null,
      linea:   e.linea_negocio ?? e.linea   ?? null,
      tier:    e.tier          ?? e.tier_actual ?? null,
      status:  e.status        ?? 'pending',
      // keep raw fields too for compatibility
      company_name:   e.company_name,
      company_domain: e.company_domain,
      linea_negocio:  e.linea_negocio,
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    // Log completo en servidor para debugging (visible en terminal del dev server)
    console.error('[GET /api/companies] Error:', msg, error);
    // Devolver array vacío para no romper el frontend con "filtered.map is not a function"
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'COMERCIAL'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
      { id: empresa.id, company_name: empresa.company_name, linea_negocio: empresa.linea_negocio },
      { status: 201 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
