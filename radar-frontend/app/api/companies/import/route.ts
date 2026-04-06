import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface ImportPayload {
  company_name: string;
  company_domain?: string;
  pais?: string;
  ciudad?: string;
  linea_negocio: string;
  prioridad?: number;
  tier?: string;
}

/**
 * POST /api/companies/import
 * Body: { empresas: ImportPayload[] }
 * Inserta empresas en bulk, saltando duplicados.
 * Returns: { inserted: N, skipped: M }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { empresas: ImportPayload[] };

    if (!Array.isArray(body.empresas) || body.empresas.length === 0) {
      return NextResponse.json({ error: 'empresas[] es requerido y debe tener al menos un elemento' }, { status: 400 });
    }

    let inserted = 0;
    let skipped  = 0;

    for (const e of body.empresas) {
      const company_name = String(e.company_name ?? '').trim();
      const linea_negocio = String(e.linea_negocio ?? '').trim();

      if (!company_name || !linea_negocio) { skipped++; continue; }

      try {
        // Verificar si ya existe (deduplicación por nombre + línea)
        const existing = await prisma.empresa.findFirst({
          where: { company_name, linea_negocio },
          select: { id: true },
        });
        if (existing) { skipped++; continue; }

        await prisma.empresa.create({
          data: {
            company_name,
            company_domain: e.company_domain ?? null,
            pais:           e.pais           ?? null,
            ciudad:         e.ciudad         ?? null,
            linea_negocio,
            tier:           e.tier           ?? 'Tier B',
            status:         'pending',
          },
        });
        inserted++;
      } catch {
        skipped++; // error inesperado
      }
    }

    return NextResponse.json({ inserted, skipped });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
