import { NextRequest, NextResponse } from 'next/server';
import { triggerProspect } from '@/lib/n8n';
import { getEmpresasParaEscaneo } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      linea,
      empresas = [] as string[],
      batchSize = 5,
      contactosPorEmpresa = 3,
    } = body;

    if (!linea) {
      return NextResponse.json({ error: 'El campo "linea" es requerido' }, { status: 400 });
    }

    // Si no vienen empresas específicas, cargamos las top N de la DB por línea
    let empresasParaN8N: string[] = empresas;
    if (empresasParaN8N.length === 0) {
      const dbRows = await getEmpresasParaEscaneo(linea, batchSize);
      empresasParaN8N = dbRows.map((e) => e.company_name);
    }

    if (empresasParaN8N.length === 0) {
      return NextResponse.json(
        { error: `No hay empresas disponibles para prospectar en la línea ${linea}` },
        { status: 400 },
      );
    }

    const result = await triggerProspect({
      linea,
      empresas: empresasParaN8N,
      batchSize,
      contactosPorEmpresa,
    });

    return NextResponse.json({ ...result, empresasEnviadas: empresasParaN8N.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg.includes('webhook error 404') || msg.toLowerCase().includes('webhook not found')) {
      return NextResponse.json(
        { error: 'El workflow WF03 (Prospector) aún no está configurado en N8N. Configura N8N_PROSPECT_WEBHOOK_PATH.' },
        { status: 502 },
      );
    }

    if (msg.includes('webhook error 5')) {
      return NextResponse.json(
        { error: 'El motor de prospección no está disponible. Intenta de nuevo.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
