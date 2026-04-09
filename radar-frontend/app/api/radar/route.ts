import { NextRequest, NextResponse } from 'next/server';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_RADAR_WEBHOOK_PATH = process.env.N8N_RADAR_WEBHOOK_PATH || 'radar-scan';
const N8N_RADAR_WORKFLOW_ID = process.env.N8N_RADAR_WORKFLOW_ID || 'fko0zXYYl5X4PtHz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { empresa, pais, linea_negocio, tier, company_domain, score_calificacion } = body;

    if (!empresa) {
      return NextResponse.json({ error: 'El campo "empresa" es requerido' }, { status: 400 });
    }

    const webhookUrl = `${N8N_HOST}/webhook/${N8N_RADAR_WEBHOOK_PATH}`;
    const payload = {
      empresa:            empresa,
      pais:               pais || 'Colombia',
      linea_negocio:      linea_negocio || '',
      tier:               tier || 'MONITOREO',
      company_domain:     company_domain || '',
      score_calificacion: score_calificacion ?? 5,
      trigger_type:       'manual_radar',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('WF02 timeout. Verifica que el workflow Radar esté activo.');
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`N8N webhook error ${res.status}: ${text.substring(0, 200)}`);
    }

    // Try to get executionId from response or from N8N executions API
    const data = await res.json().catch(() => ({}));
    if (data.executionId || data.id) {
      return NextResponse.json({ executionId: String(data.executionId || data.id) });
    }

    try {
      const execRes = await fetch(
        `${N8N_HOST}/api/v1/executions?workflowId=${N8N_RADAR_WORKFLOW_ID}&limit=1`,
        { headers: { 'X-N8N-API-KEY': N8N_API_KEY } },
      );
      if (execRes.ok) {
        const execData = await execRes.json();
        const first = execData?.data?.[0];
        if (first?.id) return NextResponse.json({ executionId: String(first.id) });
      }
    } catch { /* fallthrough */ }

    return NextResponse.json({ executionId: String(Date.now()) });

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
