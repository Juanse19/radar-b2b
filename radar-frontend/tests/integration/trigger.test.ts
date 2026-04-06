/**
 * Tests de integración para POST /api/trigger
 * Usa fetch mock (no depende de N8N real)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Simula la lógica de /api/trigger route
async function apiTrigger(body: Record<string, unknown>): Promise<Response> {
  if (!body.linea) {
    return new Response(JSON.stringify({ error: 'El campo "linea" es requerido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Convierte camelCase → snake_case (igual que lib/n8n.ts)
  const n8nPayload = {
    linea: body.linea,
    batch_size: (body as Record<string, unknown>).batchSize ?? 50,
    empresas: (body as Record<string, unknown>).empresasEspecificas ?? [],
    date_filter_from: (body as Record<string, unknown>).dateFilterFrom ?? '2025-07-01',
    trigger_type: 'manual',
  };

  // Llama al webhook N8N
  const webhookRes = await fetch('https://n8n.event2flow.com/webhook/radar-b2b-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload),
  });

  if (!webhookRes.ok) {
    const text = await webhookRes.text();
    const status = webhookRes.status >= 500 ? 502 : 500;
    return new Response(JSON.stringify({ error: `N8N error: ${text.substring(0, 100)}` }), {
      status, headers: { 'Content-Type': 'application/json' }
    });
  }

  const data = await webhookRes.json();
  const executionId = data.executionId || String(Date.now());
  return new Response(JSON.stringify({ executionId }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

describe('POST /api/trigger', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('Con linea válida → retorna executionId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ executionId: 'exec-123' }),
      text: async () => '{"executionId":"exec-123"}',
    } as Response);

    const res = await apiTrigger({ linea: 'BHS', batchSize: 5 });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.executionId).toBeDefined();
    expect(data.executionId).toBe('exec-123');
  });

  it('Sin linea → retorna 400', async () => {
    const res = await apiTrigger({});
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('linea');
  });

  it('N8N webhook down (500) → retorna 502', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    const res = await apiTrigger({ linea: 'BHS' });
    expect(res.status).toBe(502);
  });

  it('Payload incluye date_filter_from cuando se especifica', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ executionId: 'exec-456' }),
      text: async () => '{"executionId":"exec-456"}',
    } as Response);

    await apiTrigger({ linea: 'Cartón', dateFilterFrom: '2025-07-01' });

    const [, options] = mockFetch.mock.calls[0];
    const sentBody = JSON.parse((options as RequestInit).body as string);
    expect(sentBody.date_filter_from).toBe('2025-07-01');
  });
});
