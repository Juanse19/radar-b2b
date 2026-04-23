/**
 * Unit tests for lib/comercial/providers/openai.ts
 *
 * Validates the Responses API integration:
 *  - Calls POST /v1/responses (not /v1/chat/completions)
 *  - Emits `search_query` for each web_search_call output item
 *  - Parses the `message` output item for the final JSON
 *  - Emits correct SSE events: thinking, search_query, token_tick,
 *    signal_detected | signal_discarded, criteria_eval, company_done
 *  - supports('web_search') returns true
 *  - Throws on non-OK HTTP response
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock RAG — non-fatal, just needs to not crash
vi.mock('@/lib/comercial/rag', () => ({
  retrieveContext: vi.fn().mockResolvedValue([]),
  buildRagBlock:   vi.fn(() => ''),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_RESULT = JSON.stringify({
  empresa_evaluada:    'Aena',
  radar_activo:        'Sí',
  linea_negocio:       'BHS',
  tipo_senal:          'CAPEX Confirmado',
  pais:                'Brasil',
  empresa_o_proyecto:  'Terminal 3 GRU',
  descripcion_resumen: 'Aena Brasil anunció inversión de R$ 2.400 millones en el aeropuerto de Guarulhos para modernizar los sistemas BHS de la Terminal 3.',
  criterios_cumplidos: ['Inversión confirmada', 'CAPEX declarado', 'Horizonte ≤ 18 meses'],
  total_criterios:     3,
  ventana_compra:      '12-18 Meses',
  monto_inversion:     'R$ 2.400 millones',
  fuente_link:         'https://www.aena.br/noticias/gru-expansao-2026',
  fuente_nombre:       'Web Corporativa / Operador (Peso 4)',
  fecha_senal:         '10/04/2026',
  evaluacion_temporal: '🟢 Válido',
  observaciones:       null,
  motivo_descarte:     '',
});

/** Minimal valid Responses API response with 2 web_search_call items + 1 message */
function makeResponsesApiResponse(rawText: string) {
  return {
    output: [
      {
        type:    'web_search_call',
        id:      'ws_001',
        status:  'completed',
        queries: ['Aena Brasil CAPEX 2026 BHS Guarulhos'],
      },
      {
        type:    'web_search_call',
        id:      'ws_002',
        status:  'completed',
        queries: ['Aena GRU Terminal 3 licitación BHS'],
      },
      {
        type:    'message',
        role:    'assistant',
        content: [{ type: 'output_text', text: rawText }],
      },
    ],
    usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('openaiProvider — Responses API with web_search_preview', () => {
  let openaiProvider: typeof import('@/lib/comercial/providers/openai').openaiProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key';
    const mod = await import('@/lib/comercial/providers/openai');
    openaiProvider = mod.openaiProvider;
  });

  it('supports web_search and streaming', () => {
    expect(openaiProvider.supports('web_search')).toBe(true);
    expect(openaiProvider.supports('streaming')).toBe(true);
    expect(openaiProvider.supports('prompt_caching')).toBe(false);
  });

  it('calls POST /v1/responses (not /v1/chat/completions)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(VALID_RESULT),
    });
    vi.stubGlobal('fetch', fetchMock);

    await openaiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(url).not.toContain('chat/completions');
  });

  it('sends web_search_preview tool in request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(VALID_RESULT),
    });
    vi.stubGlobal('fetch', fetchMock);

    await openaiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty('tools');
    expect(body.tools).toContainEqual({ type: 'web_search_preview' });
    expect(body).toHaveProperty('input');
    expect(body).not.toHaveProperty('messages'); // old field
    expect(body).toHaveProperty('max_output_tokens');
  });

  it('emits search_query event for each web_search_call in output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(VALID_RESULT),
    }));

    const emitted: Array<{ event: string; data: unknown }> = [];
    const emit = (event: string, data: unknown) => emitted.push({ event, data });

    await openaiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit },
    );

    const searchEvents = emitted.filter(e => e.event === 'search_query');
    expect(searchEvents).toHaveLength(2);
    expect((searchEvents[0].data as Record<string, string>).query).toBe(
      'Aena Brasil CAPEX 2026 BHS Guarulhos',
    );
    expect((searchEvents[1].data as Record<string, string>).empresa).toBe('Aena');
  });

  it('emits thinking, token_tick, signal_detected, company_done events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(VALID_RESULT),
    }));

    const emitted: string[] = [];
    await openaiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit: (e) => emitted.push(e) },
    );

    expect(emitted).toContain('thinking');
    expect(emitted).toContain('token_tick');
    expect(emitted).toContain('signal_detected');
    expect(emitted).toContain('company_done');
    expect(emitted).not.toContain('signal_discarded');
  });

  it('emits signal_discarded when radar_activo is No', async () => {
    const noResult = JSON.stringify({
      empresa_evaluada:    'Copa Airlines',
      radar_activo:        'No',
      linea_negocio:       'BHS',
      tipo_senal:          'Sin Señal',
      pais:                'Panama',
      empresa_o_proyecto:  'Copa Airlines',
      descripcion_resumen: 'Sin señales de inversión BHS activas para 2026-2028.',
      criterios_cumplidos: [],
      total_criterios:     0,
      ventana_compra:      'Sin señal',
      monto_inversion:     'No reportado',
      fuente_link:         'No disponible',
      fuente_nombre:       '',
      fecha_senal:         'No disponible',
      evaluacion_temporal: '🔴 Descarte',
      observaciones:       null,
      motivo_descarte:     'Hub inaugurado 2025; sin fases futuras.',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(noResult),
    }));

    const emitted: string[] = [];
    await openaiProvider.scan(
      { company: { name: 'Copa Airlines', country: 'Panama' }, line: 'BHS', empresaId: null },
      { emit: (e) => emitted.push(e) },
    );

    expect(emitted).toContain('signal_discarded');
    expect(emitted).not.toContain('signal_detected');
  });

  it('returns scan result with correct token counts and search_calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeResponsesApiResponse(VALID_RESULT),
    }));

    const result = await openaiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    expect(result.tokens_input).toBe(1200);
    expect(result.tokens_output).toBe(300);
    expect(result.search_calls).toBe(2);
    expect(result.cost_usd).toBeGreaterThan(0);
    expect(result.result.radar_activo).toBe('Sí');
  });

  it('throws when API returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:      false,
      status:  429,
      headers: { get: () => '0' }, // retry-after=0 so retries don't stall the test
      text:    async () => '{"error":{"message":"You exceeded your current quota"}}',
    }));

    await expect(
      openaiProvider.scan({
        company:  { name: 'Test', country: 'Colombia' },
        line:     'BHS',
        empresaId: null,
      }),
    ).rejects.toThrow('429');
  });

  it('throws when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      openaiProvider.scan({
        company:  { name: 'Test', country: 'Colombia' },
        line:     'BHS',
        empresaId: null,
      }),
    ).rejects.toThrow('OPENAI_API_KEY');
  });
});
