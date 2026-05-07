// app/api/agent/route.ts
//
// Unified trigger endpoint for the 2 remaining n8n agents (WF02 Radar, WF03
// Prospector). WF01 (Calificador) was retired in V2 — qualification now runs
// in-process via /api/comercial/calificar (SSE).
//
// Request shape:
//   POST /api/agent
//   {
//     agent: 'radar' | 'prospector',
//     linea?: string,
//     empresas?: Array<{ nombre, dominio?, pais?, linea? }>,
//     batchSize?: number,
//     options?: { ...agent-specific }
//   }
// Response shape:
//   { execution_id: string, pipeline_id: string }

import { NextRequest, NextResponse } from 'next/server';
import { triggerRadar, triggerProspect } from '@/lib/n8n';
import {
  getEmpresasParaEscaneo,
  registrarEjecucion,
  crearProspeccionLogs,
} from '@/lib/db';
import type { AgentType } from '@/lib/db/types';
import { getCurrentSession } from '@/lib/auth/session';
import { logActividad } from '@/lib/auth/audit';

interface BaseAgentBody {
  agent:      AgentType;
  linea?:     string;
  empresas?:  Array<{ nombre: string; dominio?: string; pais?: string; linea?: string }>;
  batchSize?: number;
  options?:   {
    // Calificador
    dateFilterFrom?:     string;
    // Radar
    empresa?:            string;
    pais?:               string;
    company_domain?:     string;
    tier?:               string;
    score_calificacion?: number;
    // Prospector
    contactosPorEmpresa?: number;
    paises?:              string[];
  };
}

export async function POST(req: NextRequest) {
  let body: BaseAgentBody;
  try {
    body = await req.json() as BaseAgentBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.agent || !['radar', 'prospector'].includes(body.agent)) {
    return NextResponse.json(
      { error: 'agent debe ser uno de: radar, prospector. (calificador fue retirado de n8n en V2 — usa /api/comercial/calificar)' },
      { status: 400 },
    );
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    switch (body.agent) {
      case 'radar':       return await fireRadar(body, session);
      case 'prospector':  return await fireProspector(body, session);
    }
  } catch (error) {
    return mapError(error);
  }
}

// ── Radar (WF02) ─────────────────────────────────────────────────────────────

async function fireRadar(body: BaseAgentBody, session: Awaited<ReturnType<typeof getCurrentSession>>) {
  const empresa = body.options?.empresa ?? body.empresas?.[0]?.nombre;
  const linea   = body.linea ?? body.empresas?.[0]?.linea ?? '';
  const tier    = body.options?.tier ?? 'MONITOREO';
  const score   = body.options?.score_calificacion ?? 5;

  // ── Batch / aleatorio mode: no empresa explicitly provided ──────────────────
  if (!empresa) {
    const batchSize = body.batchSize ?? 5;
    if (!linea) {
      return NextResponse.json(
        { error: 'Para radar en modo lote se requiere linea' },
        { status: 400 },
      );
    }
    const dbRows = await getEmpresasParaEscaneo(linea, batchSize);
    if (dbRows.length === 0) {
      return NextResponse.json(
        { error: `No hay empresas disponibles para radar en la línea ${linea}` },
        { status: 400 },
      );
    }

    // Fire first empresa synchronously (for tracking), rest fire-and-forget.
    const firstRow = dbRows[0]!;
    const firstResult = await triggerRadar({
      empresa:              firstRow.company_name,
      pais:                 firstRow.pais ?? 'Colombia',
      linea_negocio:        firstRow.linea_negocio ?? linea,
      tier,
      company_domain:       firstRow.company_domain ?? '',
      score_calificacion:   score,
      ejecutado_por_id:     session?.id,
      ejecutado_por_nombre: session?.name,
    });

    // Remaining empresas: fire without awaiting (n8n queues them independently).
    for (const row of dbRows.slice(1)) {
      triggerRadar({
        empresa:              row.company_name,
        pais:                 row.pais ?? 'Colombia',
        linea_negocio:        row.linea_negocio ?? linea,
        tier,
        company_domain:       row.company_domain ?? '',
        score_calificacion:   score,
        ejecutado_por_id:     session?.id,
        ejecutado_por_nombre: session?.name,
      }).catch(() => { /* swallow — tracked via n8n UI */ });
    }

    // Register ONE batch execution so the tray shows a single card.
    let firstId  = firstResult.executionId;
    let firstPid = crypto.randomUUID();
    try {
      const e = await registrarEjecucion({
        n8n_execution_id: firstResult.executionId,
        linea_negocio:    linea || undefined,
        batch_size:       dbRows.length,
        trigger_type:     'manual',
        agent_type:       'radar',
        parametros:       { empresa: `Lote ${dbRows.length} empresas`, pais: firstRow.pais, tier, score_calificacion: score },
      });
      firstId  = firstResult.executionId;
      firstPid = e.pipeline_id;
    } catch { /* swallow */ }

    void logActividad(session, 'disparo_agente',
      `Radar lote — ${linea} (${dbRows.length} empresas)`, 'ok',
      { pipeline_id: firstPid, execution_id: firstId, agent: 'radar', linea, batch: dbRows.length });

    return NextResponse.json({ execution_id: firstId, pipeline_id: firstPid });
  }

  // ── Single empresa mode ────────────────────────────────────────────────────
  const pais           = body.options?.pais           ?? body.empresas?.[0]?.pais   ?? 'Colombia';
  const company_domain = body.options?.company_domain ?? body.empresas?.[0]?.dominio ?? '';

  const result = await triggerRadar({
    empresa,
    pais,
    linea_negocio:        linea,
    tier,
    company_domain,
    score_calificacion:   score,
    ejecutado_por_id:     session?.id,
    ejecutado_por_nombre: session?.name,
  });

  let ejecucion: { id: number; pipeline_id: string } = { id: 0, pipeline_id: crypto.randomUUID() };
  try {
    ejecucion = await registrarEjecucion({
      n8n_execution_id: result.executionId,
      linea_negocio:    linea || undefined,
      batch_size:       1,
      trigger_type:     'manual',
      agent_type:       'radar',
      parametros: { empresa, pais, tier, score_calificacion: score },
    });
  } catch (dbErr) {
    console.error('[fireRadar] registrarEjecucion failed (non-blocking):', dbErr);
  }

  void logActividad(session, 'disparo_agente',
    `Radar — ${empresa} (${linea})`, 'ok',
    { pipeline_id: ejecucion.pipeline_id, execution_id: result.executionId, agent: 'radar', empresa, linea });

  return NextResponse.json({
    execution_id: result.executionId,
    pipeline_id:  ejecucion.pipeline_id,
  });
}

// ── Prospector (WF03) ────────────────────────────────────────────────────────

async function fireProspector(body: BaseAgentBody, session: Awaited<ReturnType<typeof getCurrentSession>>) {
  if (!body.linea) {
    return NextResponse.json({ error: 'linea es requerido para prospector' }, { status: 400 });
  }
  const batchSize = body.batchSize ?? 5;
  const contactosPorEmpresa = body.options?.contactosPorEmpresa ?? 3;

  let empresasParaN8N: string[] = (body.empresas ?? []).map(e => e.nombre);
  if (empresasParaN8N.length === 0) {
    const dbRows = await getEmpresasParaEscaneo(body.linea, batchSize);
    empresasParaN8N = dbRows.map(e => e.company_name);
  }
  if (empresasParaN8N.length === 0) {
    return NextResponse.json(
      { error: `No hay empresas disponibles para prospectar en la línea ${body.linea}` },
      { status: 400 },
    );
  }

  const result = await triggerProspect({
    linea:               body.linea,
    empresas:            empresasParaN8N,
    batchSize,
    contactosPorEmpresa,
    tier:                body.options?.tier   ?? 'ORO',
    paises:              body.options?.paises ?? [],
  });

  let ejecucion: { id: number; pipeline_id: string } = { id: 0, pipeline_id: crypto.randomUUID() };
  try {
    ejecucion = await registrarEjecucion({
      n8n_execution_id: result.executionId,
      linea_negocio:    body.linea,
      batch_size:       empresasParaN8N.length,
      trigger_type:     'manual',
      agent_type:       'prospector',
      parametros: {
        contactosPorEmpresa,
        tier:    body.options?.tier   ?? 'ORO',
        paises:  body.options?.paises ?? [],
        empresasEnviadas: empresasParaN8N.length,
      },
    });
  } catch (dbErr) {
    console.error('[fireProspector] registrarEjecucion failed (non-blocking):', dbErr);
  }

  void logActividad(session, 'disparo_agente',
    `Prospector — ${body.linea} (${empresasParaN8N.length} empresas)`, 'ok',
    { pipeline_id: ejecucion.pipeline_id, execution_id: result.executionId, agent: 'prospector', linea: body.linea });

  // Per-empresa logs (used by /contactos polling) — non-blocking.
  try {
    await crearProspeccionLogs(
      empresasParaN8N.map(nombre => ({
        empresa_nombre:   nombre,
        linea:            body.linea!,
        n8n_execution_id: result.executionId,
      })),
    );
  } catch { /* swallow — UI still works without per-company logs */ }

  return NextResponse.json({
    execution_id: result.executionId,
    pipeline_id:  ejecucion.pipeline_id,
  });
}

// ── Error mapping ────────────────────────────────────────────────────────────

function mapError(error: unknown): NextResponse {
  const msg = error instanceof Error ? error.message : 'Error desconocido';

  if (msg.includes('webhook error 404') || msg.toLowerCase().includes('webhook not found')) {
    return NextResponse.json(
      { error: 'El workflow N8N no está disponible. Verifica que esté activo.' },
      { status: 502 },
    );
  }
  if (msg.includes('webhook error 5')) {
    return NextResponse.json(
      { error: 'El motor de agentes no está disponible. Intenta de nuevo.' },
      { status: 502 },
    );
  }
  if (msg.toLowerCase().includes('timeout')) {
    return NextResponse.json({ error: msg }, { status: 504 });
  }
  return NextResponse.json({ error: msg }, { status: 500 });
}
