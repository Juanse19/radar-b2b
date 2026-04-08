// app/api/agent/route.ts
//
// Unified trigger endpoint for the 3 n8n agents (WF01, WF02, WF03).
// This is the API that powers the new <ManualAgentForm /> in /scan and the
// "Re-escanear con Radar" actions across the app.
//
// Why a single endpoint instead of /api/trigger + /api/radar + /api/prospect:
//   - Pipeline tracker needs every fire to land in the `ejecuciones` table
//     with `agent_type` + `pipeline_id` populated. Doing it in three places
//     duplicates the bookkeeping; doing it here once keeps the contract clean.
//   - The legacy three routes are kept for backward compatibility (existing
//     callers in /api/trigger, etc.) but they will be migrated to call this
//     route or the same helper in Sprint 2.
//
// Request shape:
//   POST /api/agent
//   {
//     agent: 'calificador' | 'radar' | 'prospector',
//     linea?: string,
//     empresas?: Array<{ nombre, dominio?, pais?, linea? }>,
//     batchSize?: number,
//     options?: { ...agent-specific }
//   }
// Response shape:
//   { execution_id: string, pipeline_id: string }

import { NextRequest, NextResponse } from 'next/server';
import { triggerScan, triggerRadar, triggerProspect } from '@/lib/n8n';
import {
  getEmpresasParaEscaneo,
  registrarEjecucion,
  crearProspeccionLogs,
} from '@/lib/db';
import type { AgentType } from '@/lib/db/types';
import type { LineaNegocio } from '@/lib/types';
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

  if (!body.agent || !['calificador', 'radar', 'prospector'].includes(body.agent)) {
    return NextResponse.json(
      { error: 'agent debe ser uno de: calificador, radar, prospector' },
      { status: 400 },
    );
  }

  // Resolve session for audit logging (best-effort — never blocks the request)
  const session = await getCurrentSession().catch(() => null);

  try {
    switch (body.agent) {
      case 'calificador': return await fireCalificador(body, session);
      case 'radar':       return await fireRadar(body, session);
      case 'prospector':  return await fireProspector(body, session);
    }
  } catch (error) {
    return mapError(error);
  }
}

// ── Calificador (WF01) ───────────────────────────────────────────────────────

async function fireCalificador(body: BaseAgentBody, session: Awaited<ReturnType<typeof getCurrentSession>>) {
  if (!body.linea) {
    return NextResponse.json({ error: 'linea es requerido para calificador' }, { status: 400 });
  }

  const batchSize = body.batchSize ?? 10;

  let empresasParaN8N = body.empresas ?? [];
  if (empresasParaN8N.length === 0) {
    const dbRows = await getEmpresasParaEscaneo(body.linea, batchSize);
    empresasParaN8N = dbRows.map(e => ({
      nombre:  e.company_name,
      dominio: e.company_domain ?? undefined,
      pais:    e.pais ?? undefined,
      linea:   e.linea_negocio,
    }));
  }

  const result = await triggerScan({
    // El TriggerParams type usa LineaNegocio (union literal) por seguridad de
    // tipos en el frontend, pero esta route recibe strings arbitrarios. WF01
    // valida la línea internamente, así que aquí casteamos sin pena.
    linea:               body.linea as LineaNegocio,
    batchSize,
    empresasEspecificas: empresasParaN8N.map(e => e.nombre),
    dateFilterFrom:      body.options?.dateFilterFrom ?? '2025-07-01',
    empresas:            empresasParaN8N,
  });

  const ejecucion = await registrarEjecucion({
    n8n_execution_id: result.executionId,
    linea_negocio:    body.linea,
    batch_size:       batchSize,
    trigger_type:     'manual',
    agent_type:       'calificador',
    parametros: {
      dateFilterFrom:   body.options?.dateFilterFrom ?? '2025-07-01',
      empresasEnviadas: empresasParaN8N.length,
      origenEmpresas:   body.empresas ? 'frontend' : 'db',
    },
  });

  void logActividad(session, 'disparo_agente',
    `Calificador — ${body.linea} (${empresasParaN8N.length} empresas)`, 'ok',
    { pipeline_id: ejecucion.pipeline_id, execution_id: result.executionId, agent: 'calificador', linea: body.linea });

  return NextResponse.json({
    execution_id: result.executionId,
    pipeline_id:  ejecucion.pipeline_id,
  });
}

// ── Radar (WF02) ─────────────────────────────────────────────────────────────

async function fireRadar(body: BaseAgentBody, session: Awaited<ReturnType<typeof getCurrentSession>>) {
  const empresa = body.options?.empresa ?? body.empresas?.[0]?.nombre;
  if (!empresa) {
    return NextResponse.json(
      { error: 'Para radar se requiere options.empresa o empresas[0].nombre' },
      { status: 400 },
    );
  }

  const pais          = body.options?.pais          ?? body.empresas?.[0]?.pais          ?? 'Colombia';
  const linea         = body.linea                  ?? body.empresas?.[0]?.linea          ?? '';
  const company_domain = body.options?.company_domain ?? body.empresas?.[0]?.dominio     ?? '';
  const tier          = body.options?.tier          ?? 'MONITOREO';
  const score         = body.options?.score_calificacion ?? 5;

  const result = await triggerRadar({
    empresa,
    pais,
    linea_negocio:      linea,
    tier,
    company_domain,
    score_calificacion: score,
  });

  const ejecucion = await registrarEjecucion({
    n8n_execution_id: result.executionId,
    linea_negocio:    linea || undefined,
    batch_size:       1,
    trigger_type:     'manual',
    agent_type:       'radar',
    parametros: {
      empresa,
      pais,
      tier,
      score_calificacion: score,
    },
  });

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

  const ejecucion = await registrarEjecucion({
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
