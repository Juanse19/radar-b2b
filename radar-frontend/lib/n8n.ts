// lib/n8n.ts
import type { TriggerParams, ExecutionStatus } from './types';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
// WF01: Calificador — entry point for the 3-agent pipeline
const N8N_WEBHOOK_PATH = process.env.N8N_WEBHOOK_PATH || 'calificador';
const N8N_WORKFLOW_ID = process.env.N8N_WORKFLOW_ID || 'jDtdafuyYt8TXISl';
// WF02: Radar — can also be triggered directly (bypassing qualification)
const N8N_RADAR_WEBHOOK_PATH = process.env.N8N_RADAR_WEBHOOK_PATH || 'radar-scan';
const N8N_RADAR_WORKFLOW_ID = process.env.N8N_RADAR_WORKFLOW_ID || 'fko0zXYYl5X4PtHz';
// WF03: Prospector
const N8N_PROSPECT_WEBHOOK_PATH = process.env.N8N_PROSPECT_WEBHOOK_PATH || 'prospector';
const N8N_PROSPECT_WORKFLOW_ID = process.env.N8N_PROSPECT_WORKFLOW_ID || 'RLUDpi3O5Rb6WEYJ';

export interface EmpresaPayload {
  nombre: string;
  dominio?: string | null;
  pais?: string | null;
  linea?: string;
}

export interface TriggerScanParams extends TriggerParams {
  /** Lista completa de empresas con nombre, dominio, país y línea para que N8N las use */
  empresas?: EmpresaPayload[];
}

export async function triggerScan(params: TriggerScanParams): Promise<{ executionId: string }> {
  const webhookUrl = `${N8N_HOST}/webhook/${N8N_WEBHOOK_PATH}`;

  // Preferimos los objetos completos (nombre+dominio+pais+linea) sobre solo nombres.
  // El Code node de N8N lee triggerData.empresas[] y usa e.nombre / e.company_name.
  // WF01 expects: { empresas: [{ empresa, pais, linea_negocio, company_domain }] }
  const empresasPayload = params.empresas && params.empresas.length > 0
    ? params.empresas.map(e => ({
        empresa:        e.nombre,
        pais:           e.pais ?? 'Colombia',
        linea_negocio:  e.linea ?? params.linea ?? '',
        company_domain: e.dominio ?? '',
      }))
    : (params.empresasEspecificas ?? []).map(n => ({
        empresa: n,
        pais: 'Colombia',
        linea_negocio: params.linea ?? '',
        company_domain: '',
      }));

  const body = {
    empresas: empresasPayload,
    trigger_type: 'manual',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      throw new Error('N8N webhook timeout después de 12s. Verifica que el workflow esté activo.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`N8N webhook error ${res.status}: ${text.substring(0, 200)}`);
  }

  // N8N responseMode 'onReceived' returns {"message":"Workflow was started"} — no executionId.
  // Try body first, then fall back to the executions API, then to a timestamp.
  const data = await res.json().catch(() => ({}));
  if (data.executionId || data.id) {
    return { executionId: String(data.executionId || data.id) };
  }

  // Fetch the most recent execution for this workflow from the N8N API
  try {
    const execRes = await fetch(
      `${N8N_HOST}/api/v1/executions?workflowId=${N8N_WORKFLOW_ID}&limit=1`,
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
    );
    if (execRes.ok) {
      const execData = await execRes.json();
      const first = execData?.data?.[0];
      if (first?.id) {
        return { executionId: String(first.id) };
      }
    }
  } catch {
    // Silently fall through to timestamp fallback
  }

  return { executionId: String(Date.now()) };
}

export async function triggerProspect(params: {
  linea: string;
  empresas: string[];
  batchSize: number;
  contactosPorEmpresa: number;
}): Promise<{ executionId: string }> {
  const webhookUrl = `${N8N_HOST}/webhook/${N8N_PROSPECT_WEBHOOK_PATH}`;

  const body = {
    linea: params.linea,
    empresas: params.empresas,
    batch_size: params.batchSize,
    contactos_por_empresa: params.contactosPorEmpresa,
    trigger_type: 'manual',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      throw new Error('N8N webhook timeout. Verifica que WF03 esté activo.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`N8N webhook error ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));
  if (data.executionId || data.id) {
    return { executionId: String(data.executionId || data.id) };
  }
  return { executionId: String(Date.now()) };
}

export async function getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
  const url = `${N8N_HOST}/api/v1/executions/${executionId}`;

  const res = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
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

  return {
    id: executionId,
    status,
    startedAt: exec.startedAt,
    finishedAt: exec.stoppedAt,
    empresasProcesadas: exec.data?.resultData?.runData?.['Loop Over Items1']?.[0]?.data?.main?.[0]?.length,
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
