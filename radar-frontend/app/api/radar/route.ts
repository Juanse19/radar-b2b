// app/api/radar/route.ts
//
// Legacy compatibility wrapper. The unified `/api/agent` endpoint is the
// preferred entry point — this route delegates to the same `triggerRadar()`
// helper plus `registrarEjecucion()` so the tracker tray sees radar fires
// regardless of which route the caller used.

import { NextRequest, NextResponse } from 'next/server';
import { triggerRadar } from '@/lib/n8n';
import { registrarEjecucion } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { empresa, pais, linea_negocio, tier, company_domain, score_calificacion } = body;

    if (!empresa) {
      return NextResponse.json({ error: 'El campo "empresa" es requerido' }, { status: 400 });
    }

    const result = await triggerRadar({
      empresa,
      pais,
      linea_negocio,
      tier,
      company_domain,
      score_calificacion,
    });

    let pipeline_id: string | null = null;
    try {
      const ejecucion = await registrarEjecucion({
        n8n_execution_id: result.executionId,
        linea_negocio:    linea_negocio || undefined,
        batch_size:       1,
        trigger_type:     'manual',
        agent_type:       'radar',
        parametros: { empresa, pais, tier, score_calificacion },
      });
      pipeline_id = ejecucion.pipeline_id;
    } catch { /* swallow */ }

    return NextResponse.json({ ...result, pipeline_id });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg.includes('webhook error 404') || msg.toLowerCase().includes('webhook not found')) {
      return NextResponse.json(
        { error: 'WF02 Radar no está disponible. Verifica que el workflow esté activo en N8N.' },
        { status: 502 },
      );
    }
    if (msg.includes('webhook error 5')) {
      return NextResponse.json(
        { error: 'El motor de radar no está disponible en este momento. Intenta de nuevo.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
