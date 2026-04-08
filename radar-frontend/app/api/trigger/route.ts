import { NextRequest, NextResponse } from 'next/server';
import { triggerScan } from '@/lib/n8n';
import { getEmpresasParaEscaneo, registrarEjecucion } from '@/lib/db';
import type { TriggerParams } from '@/lib/types';
import type { EmpresaPayload } from '@/lib/n8n';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as TriggerParams & {
      empresas?: { nombre: string; dominio?: string; pais?: string; linea?: string }[];
    };

    if (!body.linea) {
      return NextResponse.json({ error: 'El campo "linea" es requerido' }, { status: 400 });
    }

    const batchSize = body.batchSize ?? 10;

    // ── Obtener empresas desde Supabase ───────────────────────────────────────
    // Si el frontend ya envió una lista específica de empresas, usarlas directamente.
    // Si no, consultar Supabase y pasar la lista completa al webhook.
    let empresasParaN8N: EmpresaPayload[];

    if (body.empresas && body.empresas.length > 0) {
      empresasParaN8N = body.empresas;
    } else {
      const dbEmpresas = await getEmpresasParaEscaneo(body.linea, batchSize);
      empresasParaN8N = dbEmpresas.map(e => ({
        nombre:  e.company_name,
        dominio: e.company_domain,
        pais:    e.pais,
        linea:   e.linea_negocio,
      }));
    }

    // ── Disparar el workflow N8N ──────────────────────────────────────────────
    const n8nParams: TriggerParams = {
      linea:               body.linea,
      batchSize,
      empresasEspecificas: empresasParaN8N.map(e => e.nombre),
      dateFilterFrom:      body.dateFilterFrom ?? '2025-07-01',
    };

    // Pasar la lista completa de empresas como campo adicional en el webhook
    const result = await triggerScan({
      ...n8nParams,
      empresas: empresasParaN8N,
    });

    // ── Registrar ejecución en BD local con tracking de pipeline ──────────────
    let pipeline_id: string | null = null;
    try {
      const ejecucion = await registrarEjecucion({
        n8n_execution_id: result.executionId,
        linea_negocio:    body.linea,
        batch_size:       batchSize,
        trigger_type:     'manual',
        agent_type:       'calificador',
        parametros: {
          dateFilterFrom:    n8nParams.dateFilterFrom,
          empresasEnviadas:  empresasParaN8N.length,
          origenEmpresas:    body.empresas ? 'frontend' : 'db',
        },
      });
      pipeline_id = ejecucion.pipeline_id;
    } catch {
      // No bloquear la respuesta si el log falla
    }

    return NextResponse.json({ ...result, pipeline_id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg.includes('webhook error 404') || msg.toLowerCase().includes('webhook not found')) {
      return NextResponse.json(
        { error: 'El workflow de N8N necesita configuración. Contacta al administrador.' },
        { status: 502 }
      );
    }

    if (msg.includes('webhook error 5') || msg.includes('N8N webhook error 5')) {
      return NextResponse.json(
        { error: 'El motor de escaneo no está disponible en este momento. Intenta de nuevo en unos segundos.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al lanzar el escaneo. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
