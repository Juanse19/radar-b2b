/**
 * Unit tests for lib/comercial/providers/gemini.ts
 *
 * Validates the Google Search Grounding integration:
 *  - Calls POST /generateContent with tools: [{ googleSearch: {} }]
 *  - Emits `search_query` from groundingMetadata.searchEntryPoint
 *  - Emits `reading_source` for each groundingChunk web URL (max 10)
 *  - Parses the response text for the final JSON
 *  - Emits correct SSE events: thinking, search_query, reading_source,
 *    token_tick, signal_detected | signal_discarded, company_done
 *  - supports('web_search') returns true
 *  - Throws on non-OK HTTP response or missing API key
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

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
  descripcion_resumen: 'Aena Brasil anunció inversión de R$ 2.400M en el aeropuerto de Guarulhos para BHS Terminal 3.',
  criterios_cumplidos: ['Inversión confirmada', 'CAPEX declarado'],
  total_criterios:     2,
  ventana_compra:      '12-18 Meses',
  monto_inversion:     'R$ 2.400 millones',
  fuente_link:         'https://www.aena.br/noticias/gru-2026',
  fuente_nombre:       'Web Corporativa / Operador (Peso 4)',
  fecha_senal:         '10/04/2026',
  evaluacion_temporal: '🟢 Válido',
  observaciones:       null,
  motivo_descarte:     '',
});

/** Builds a Gemini generateContent response with grounding metadata */
function makeGeminiResponse(text: string, withGrounding = true) {
  return {
    candidates: [
      {
        content: { parts: [{ text }] },
        ...(withGrounding
          ? {
              groundingMetadata: {
                searchEntryPoint: {
                  renderedContent: 'Aena Brasil CAPEX 2026 BHS inversión',
                },
                groundingChunks: [
                  { web: { uri: 'https://www.aena.br/noticias/gru-2026', title: 'Aena Brasil — Expansión GRU 2026' } },
                  { web: { uri: 'https://www.infraestructura.gov.br/gru', title: 'Plan Maestro GRU 2025-2030' } },
                  { web: { uri: 'https://www.bnamericas.com/aena-bhs', title: 'BNAmericas — Aena BHS GRU' } },
                ],
              },
            }
          : {}),
      },
    ],
    usageMetadata: {
      promptTokenCount:     2000,
      candidatesTokenCount: 400,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('geminiProvider — Google Search Grounding', () => {
  let geminiProvider: typeof import('@/lib/comercial/providers/gemini').geminiProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GOOGLE_API_KEY = 'AIza-test-key';
    const mod = await import('@/lib/comercial/providers/gemini');
    geminiProvider = mod.geminiProvider;
  });

  it('supports web_search and streaming', () => {
    expect(geminiProvider.supports('web_search')).toBe(true);
    expect(geminiProvider.supports('streaming')).toBe(true);
    expect(geminiProvider.supports('prompt_caching')).toBe(false);
  });

  it('sends tools: [{ googleSearch: {} }] in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    });
    vi.stubGlobal('fetch', fetchMock);

    await geminiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty('tools');
    expect(body.tools).toContainEqual({ googleSearch: {} });
  });

  it('calls the Generative Language API endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    });
    vi.stubGlobal('fetch', fetchMock);

    await geminiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('generateContent');
    expect(url).toContain('AIza-test-key');
  });

  it('emits search_query from groundingMetadata.searchEntryPoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    }));

    const emitted: Array<{ event: string; data: unknown }> = [];
    await geminiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit: (event, data) => emitted.push({ event, data }) },
    );

    const searchEvents = emitted.filter(e => e.event === 'search_query');
    expect(searchEvents).toHaveLength(1);
    const d = searchEvents[0].data as Record<string, string>;
    expect(d.query).toContain('Aena');
    expect(d.empresa).toBe('Aena');
  });

  it('emits reading_source for each groundingChunk URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    }));

    const emitted: Array<{ event: string; data: unknown }> = [];
    await geminiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit: (event, data) => emitted.push({ event, data }) },
    );

    const sourceEvents = emitted.filter(e => e.event === 'reading_source');
    expect(sourceEvents).toHaveLength(3);
    const urls = sourceEvents.map(e => (e.data as Record<string, string>).url);
    expect(urls).toContain('https://www.aena.br/noticias/gru-2026');
    expect(urls).toContain('https://www.infraestructura.gov.br/gru');
  });

  it('emits thinking, token_tick, signal_detected, company_done', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    }));

    const emitted: string[] = [];
    await geminiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit: (e) => emitted.push(e) },
    );

    expect(emitted).toContain('thinking');
    expect(emitted).toContain('token_tick');
    expect(emitted).toContain('signal_detected');
    expect(emitted).toContain('company_done');
  });

  it('emits signal_discarded when radar_activo is No', async () => {
    const noResult = JSON.stringify({
      empresa_evaluada: 'Test Co', radar_activo: 'No',
      linea_negocio: 'BHS', tipo_senal: 'Sin Señal', pais: 'Colombia',
      empresa_o_proyecto: 'Test Co',
      descripcion_resumen: 'Sin señal encontrada para el período 2026-2028.',
      criterios_cumplidos: [], total_criterios: 0, ventana_compra: 'Sin señal',
      monto_inversion: 'No reportado', fuente_link: 'No disponible',
      fuente_nombre: '', fecha_senal: 'No disponible',
      evaluacion_temporal: '🔴 Descarte', observaciones: null,
      motivo_descarte: 'Sin proyectos identificados.',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(noResult, false),
    }));

    const emitted: string[] = [];
    await geminiProvider.scan(
      { company: { name: 'Test Co', country: 'Colombia' }, line: 'BHS', empresaId: null },
      { emit: (e) => emitted.push(e) },
    );

    expect(emitted).toContain('signal_discarded');
    expect(emitted).not.toContain('signal_detected');
  });

  it('sets search_calls from groundingChunks length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT),
    }));

    const result = await geminiProvider.scan({
      company:  { name: 'Aena', country: 'Brasil' },
      line:     'BHS',
      empresaId: null,
    });

    // 3 grounding chunks → search_calls = 3
    expect(result.search_calls).toBe(3);
    expect(result.tokens_input).toBe(2000);
    expect(result.tokens_output).toBe(400);
  });

  it('works without grounding metadata (no search events)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => makeGeminiResponse(VALID_RESULT, false),
    }));

    const emitted: string[] = [];
    const result = await geminiProvider.scan(
      { company: { name: 'Aena', country: 'Brasil' }, line: 'BHS', empresaId: null },
      { emit: (e) => emitted.push(e) },
    );

    expect(emitted).not.toContain('search_query');
    expect(emitted).not.toContain('reading_source');
    expect(result.search_calls).toBe(0);
  });

  it('throws when API returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:     false,
      status: 403,
      text:   async () => 'API_KEY_INVALID',
    }));

    await expect(
      geminiProvider.scan({
        company:  { name: 'Test', country: 'Colombia' },
        line:     'BHS',
        empresaId: null,
      }),
    ).rejects.toThrow('403');
  });

  it('throws when no API key is configured', async () => {
    delete process.env.GOOGLE_API_KEY;

    await expect(
      geminiProvider.scan({
        company:  { name: 'Test', country: 'Colombia' },
        line:     'BHS',
        empresaId: null,
      }),
    ).rejects.toThrow('GOOGLE_API_KEY');
  });
});
