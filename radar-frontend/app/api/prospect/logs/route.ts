import { NextRequest, NextResponse } from 'next/server';
import { getProspeccionLogs } from '@/lib/db';

// GET /api/prospect/logs?linea=BHS&limit=50&estado=running
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const linea  = searchParams.get('linea')  ?? undefined;
    const estado = searchParams.get('estado') ?? undefined;
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);

    const logs = await getProspeccionLogs({ linea, estado, limit });

    const mapped = logs.map(l => ({
      id:                   l.id,
      empresaNombre:        l.empresa_nombre,
      linea:                l.linea,
      n8nExecutionId:       l.n8n_execution_id ?? undefined,
      estado:               l.estado as 'running' | 'success' | 'error',
      contactosEncontrados: l.contactos_encontrados,
      createdAt:            l.created_at,
      finishedAt:           l.finished_at ?? undefined,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
