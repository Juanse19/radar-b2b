// lib/n8n.ts
//
// V2: WF01 (Calificador) was removed. Qualification now runs entirely in the
// frontend via /api/comercial/calificar (SSE) → engine → Supabase. WF02 (Radar)
// and WF03 (Prospector) remain on n8n.event2flow.com and are triggered by the
// helpers below.
import type { ExecutionStatus } from './types';
import { stepLabelForNode } from './constants/agentSteps';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
// WF02: Radar — can also be triggered directly (bypassing qualification)
const N8N_RADAR_WEBHOOK_PATH = process.env.N8N_RADAR_WEBHOOK_PATH || 'radar-scan';
const N8N_RADAR_WORKFLOW_ID = process.env.N8N_RADAR_WORKFLOW_ID || 'fko0zXYYl5X4PtHz';
// WF03: Prospector
const N8N_PROSPECT_WEBHOOK_PATH = process.env.N8N_PROSPECT_WEBHOOK_PATH || 'prospector';
const N8N_PROSPECT_WORKFLOW_ID = process.env.N8N_PROSPECT_WORKFLOW_ID || 'RLUDpi3O5Rb6WEYJ';

export interface TriggerRadarParams {
  empresa: string;
  pais?: string;
  linea_negocio?: string;
  tier?: string;
  company_domain?: string;
  /** Score from WF01. Defaults to 5 (mid Monitoreo). */
  score_calificacion?: number;
  /** ID of the session user who triggered the scan — forwarded to n8n for audit. */
  ejecutado_por_id?:     string;
  /** Display name of the session user who triggered the scan. */
  ejecutado_por_nombre?: string;
}

/**
 * Disparador del Agente 02 — Radar de Inversión.
 *
 * A diferencia de WF01, WF02 normalmente recibe UNA empresa por ejecución
 * (porque su trabajo es buscar señales de inversión específicas para esa
 * empresa). Lo usamos en modo manual desde `/scan` cuando el equipo comercial
 * quiere correr radar sobre una empresa específica.
 */
export async function triggerRadar(params: TriggerRadarParams): Promise<{ executionId: string }> {
  const webhookUrl = `${N8N_HOST}/webhook/${N8N_RADAR_WEBHOOK_PATH}`;

  const body = {
    empresa:              params.empresa,
    pais:                 params.pais ?? 'Colombia',
    linea_negocio:        params.linea_negocio ?? '',
    tier:                 params.tier ?? 'MONITOREO',
    company_domain:       params.company_domain ?? '',
    score_calificacion:   params.score_calificacion ?? 5,
    ejecutado_por_id:     params.ejecutado_por_id,
    ejecutado_por_nombre: params.ejecutado_por_nombre,
    trigger_type:         'manual_radar',
  };

  let data: Record<string, unknown> = {};
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`N8N webhook error ${res.status}: ${text.substring(0, 200)}`);
    }
    data = await res.json().catch(() => ({}));
  } catch (err: unknown) {
    const name = (err as Error)?.name;
    if (name !== 'AbortError' && name !== 'TimeoutError') throw err;
  }

  if (data.executionId || data.id) {
    return { executionId: String(data.executionId || data.id) };
  }

  // Fallback: query the n8n REST API for the latest execution of WF02.
  try {
    const execRes = await fetch(
      `${N8N_HOST}/api/v1/executions?workflowId=${N8N_RADAR_WORKFLOW_ID}&limit=1`,
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } },
    );
    if (execRes.ok) {
      const execData = await execRes.json();
      const first = execData?.data?.[0];
      if (first?.id) return { executionId: String(first.id) };
    }
  } catch { /* fall through */ }

  return { executionId: String(Date.now()) };
}

export async function triggerProspect(params: {
  linea: string;
  empresas: string[];
  batchSize: number;
  contactosPorEmpresa: number;
  /** Tier del prospecto — determina cuántos contactos busca WF03 (ORO=5, PLATA=4, MONITOREO=3) */
  tier?: string;
  /** Países para búsqueda multi-país (empresas multinacionales) */
  paises?: string[];
}): Promise<{ executionId: string }> {
  const webhookUrl = `${N8N_HOST}/webhook/${N8N_PROSPECT_WEBHOOK_PATH}`;

  const body = {
    linea: params.linea,
    empresas: params.empresas,
    batch_size: params.batchSize,
    contactos_por_empresa: params.contactosPorEmpresa,
    tier: params.tier ?? 'ORO',
    paises: params.paises ?? [],
    trigger_type: 'manual',
  };

  let data: Record<string, unknown> = {};
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`N8N webhook error ${res.status}: ${text.substring(0, 200)}`);
    }
    data = await res.json().catch(() => ({}));
  } catch (err: unknown) {
    const name = (err as Error)?.name;
    if (name !== 'AbortError' && name !== 'TimeoutError') throw err;
  }

  if (data.executionId || data.id) {
    return { executionId: String(data.executionId || data.id) };
  }

  // Fallback: query the n8n REST API for the latest execution of WF03.
  try {
    const execRes = await fetch(
      `${N8N_HOST}/api/v1/executions?workflowId=${N8N_PROSPECT_WORKFLOW_ID}&limit=1`,
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } },
    );
    if (execRes.ok) {
      const execData = await execRes.json();
      const first = execData?.data?.[0];
      if (first?.id) return { executionId: String(first.id) };
    }
  } catch { /* fall through */ }

  return { executionId: String(Date.now()) };
}

/** Returns true for fallback timestamp IDs — they are NOT real n8n execution IDs. */
function isTimestampId(id: string) {
  return /^\d{11,}$/.test(id);
}

export async function getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
  // Skip the n8n API call when we know it won't work:
  // 1. API key is not configured
  // 2. The executionId is a local timestamp fallback (not a real n8n id)
  if (!N8N_API_KEY || isTimestampId(executionId)) {
    return { id: executionId, status: 'running' };
  }

  const url = `${N8N_HOST}/api/v1/executions/${executionId}?includeData=true`;

  const res = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    // 404 → execution not yet indexed (still starting) — keep polling.
    // 401/403 → API key missing or expired — treat as "running" so the
    //            UI doesn't error out; the 30-min auto-timeout will resolve it.
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      return { id: executionId, status: 'running' };
    }
    throw new Error(`N8N API error ${res.status}`);
  }

  const exec = await res.json();

  const finished = exec.finished || !!exec.stoppedAt;
  const hasError = exec.status === 'error' || exec.data?.resultData?.error;

  let status: ExecutionStatus['status'] = 'running';
  if (finished && !hasError) status = 'success';
  else if (finished && hasError) status = 'error';
  else if (exec.status === 'waiting') status = 'waiting';

  // Derive `currentStep` from the most recently executed n8n node.
  // runData is { nodeName: [{ startTime, executionTime, ... }] }; we pick the
  // node with the latest startTime that has data, then translate it to a
  // human-readable label via stepLabelForNode().
  const runData = exec.data?.resultData?.runData as
    | Record<string, Array<{ startTime?: number }>>
    | undefined;
  let currentStep: string | undefined;
  if (runData) {
    let latestNode: string | undefined;
    let latestTime = -Infinity;
    for (const [nodeName, runs] of Object.entries(runData)) {
      const t = runs?.[runs.length - 1]?.startTime ?? 0;
      if (t > latestTime) {
        latestTime = t;
        latestNode = nodeName;
      }
    }
    if (latestNode) currentStep = stepLabelForNode(latestNode);
  }

  return {
    id: executionId,
    status,
    startedAt:          exec.startedAt,
    finishedAt:         exec.stoppedAt,
    empresasProcesadas: exec.data?.resultData?.runData?.['Loop Over Items1']?.[0]?.data?.main?.[0]?.length,
    currentStep,
  };
}

export async function getRecentExecutions(workflowId: string, limit = 10) {
  const url = `${N8N_HOST}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
