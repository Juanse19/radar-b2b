/**
 * Unit tests for lib/radar-v2/rag.ts
 *
 * Coverage:
 *   embed()          — Voyage AI & OpenAI paths, missing-key errors, HTTP errors
 *   retrieveContext()— graceful degradation w/o PINECONE_API_KEY, parallel queries
 *   upsertSenal()    — skips without key, embeds + upserts + writes ingest log
 *   buildRagBlock()  — empty context, full context, partial sections
 *
 * All network calls (fetch) and Pinecone SDK are mocked. `server-only` is
 * stubbed so the module can be imported outside Next.js.
 */

import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

// ---------------------------------------------------------------------------
// Static hoisted mocks — vi.hoisted() ensures these are available in
// vi.mock() factories (which are hoisted to the top of the file by Vitest).
// ---------------------------------------------------------------------------

const { mockPgQuery, mockUpsert, mockQuery, mockNamespace, mockIndex } =
  vi.hoisted(() => {
    const mockUpsert    = vi.fn().mockResolvedValue(undefined);
    const mockQuery     = vi.fn().mockResolvedValue({ matches: [] });
    const mockNamespace = vi.fn().mockReturnValue({ upsert: mockUpsert, query: mockQuery });
    const mockIndex     = vi.fn().mockReturnValue({ namespace: mockNamespace });
    const mockPgQuery   = vi.fn().mockResolvedValue([]);
    return { mockPgQuery, mockUpsert, mockQuery, mockNamespace, mockIndex };
  });

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: mockPgQuery,
  pgLit:   (v: unknown) => (v === null ? 'NULL' : `'${String(v)}'`),
  SCHEMA:  'matec_radar',
}));

// `new Pinecone(...)` requires a regular function (not an arrow fn) as constructor.
vi.mock('@pinecone-database/pinecone', () => ({
  // eslint-disable-next-line prefer-arrow-callback
  Pinecone: vi.fn(function MockPinecone() { return { index: mockIndex }; }),
}));

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are registered)
// ---------------------------------------------------------------------------

import {
  embed,
  retrieveContext,
  upsertSenal,
  buildRagBlock,
  type RagContext,
  type RagMatch,
} from '@/lib/radar-v2/rag';
import type { Agente1Result } from '@/lib/radar-v2/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_VECTOR = Array.from({ length: 1024 }, (_, i) => i / 1024);

/** Build a minimal Agente1Result for upsertSenal tests. */
function makeResult(overrides: Partial<Agente1Result> = {}): Agente1Result {
  return {
    empresa_evaluada:    'TestCorp SA',
    radar_activo:        'Sí',
    linea_negocio:       'BHS',
    tipo_senal:          'CAPEX declarado',
    pais:                'Colombia',
    empresa_o_proyecto:  'Terminal Norte',
    descripcion_resumen: 'Expansión aeropuerto.',
    criterios_cumplidos: ['Inversión confirmada'],
    total_criterios:     3,
    ventana_compra:      '6-12 Meses',
    monto_inversion:     '$50M USD',
    fuente_link:         'https://example.com/noticia',
    fuente_nombre:       'El Tiempo',
    fecha_senal:         '2026-04-01',
    evaluacion_temporal: 'Vigente',
    observaciones:       null,
    motivo_descarte:     'N/A',
    ...overrides,
  };
}

/** Build a minimal RagMatch. */
function makeMatch(overrides: Partial<RagMatch> = {}): RagMatch {
  return {
    id: 'vec-001',
    score: 0.92,
    metadata: {
      tipo:           'senal_historica',
      empresa:        'AirCargo LATAM',
      pais:           'Colombia',
      linea:          'BHS',
      radar_activo:   'Sí',
      tipo_senal:     'Licitación',
      ventana_compra: '0-6 Meses',
      monto:          '$30M',
      fuente:         'SECOP',
      fecha:          '2026-01',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// embed()
// ---------------------------------------------------------------------------

describe('embed()', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, savedEnv);
    vi.restoreAllMocks();
  });

  it('calls Voyage AI endpoint and returns first embedding', async () => {
    process.env.EMBEDDING_PROVIDER = 'voyage';
    process.env.VOYAGE_API_KEY     = 'voyage-test-key';
    process.env.EMBEDDING_MODEL    = 'voyage-3';

    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await embed('test query');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('voyage-3');
    expect(body.input).toEqual(['test query']);
    expect(result).toBe(FAKE_VECTOR);
  });

  it('calls OpenAI endpoint when EMBEDDING_PROVIDER=openai', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY     = 'openai-test-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await embed('query text');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(result).toBe(FAKE_VECTOR);
  });

  it('throws when VOYAGE_API_KEY is missing', async () => {
    process.env.EMBEDDING_PROVIDER = 'voyage';
    delete process.env.VOYAGE_API_KEY;

    await expect(embed('hello')).rejects.toThrow('VOYAGE_API_KEY not set');
  });

  it('throws when OPENAI_API_KEY is missing', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    await expect(embed('hello')).rejects.toThrow('OPENAI_API_KEY not set');
  });

  it('throws on non-ok Voyage response (HTTP 429)', async () => {
    process.env.EMBEDDING_PROVIDER = 'voyage';
    process.env.VOYAGE_API_KEY     = 'voyage-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:     false,
      status: 429,
    } as unknown as Response));

    await expect(embed('rate limited')).rejects.toThrow('Voyage AI embed HTTP 429');
  });

  it('throws on non-ok OpenAI response (HTTP 401)', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY     = 'bad-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:     false,
      status: 401,
    } as unknown as Response));

    await expect(embed('unauth')).rejects.toThrow('OpenAI embed HTTP 401');
  });

  it('defaults to voyage provider when EMBEDDING_PROVIDER is unset', async () => {
    delete process.env.EMBEDDING_PROVIDER;
    process.env.VOYAGE_API_KEY = 'voyage-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    await embed('default provider');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('voyageai.com');
  });
});

// ---------------------------------------------------------------------------
// retrieveContext()
// ---------------------------------------------------------------------------

describe('retrieveContext()', () => {
  beforeEach(() => {
    // Clear call history only — preserves mockReturnValue/mockImplementation
    mockQuery.mockClear();
    mockQuery.mockResolvedValue({ matches: [] });
    mockUpsert.mockClear();
    mockPgQuery.mockClear();
    mockPgQuery.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty context when PINECONE_API_KEY is not set', async () => {
    const saved = process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_API_KEY;

    const ctx = await retrieveContext('TestCorp', 'BHS');

    expect(ctx).toEqual({ similares: [], keywords: [], criterios: [] });
    // Pinecone should NOT be instantiated
    const { Pinecone } = await import('@pinecone-database/pinecone');
    expect(Pinecone).not.toHaveBeenCalled();

    process.env.PINECONE_API_KEY = saved;
  });

  it('makes 3 parallel namespace.query calls with correct filters', async () => {
    process.env.PINECONE_API_KEY      = 'pc-test-key';
    process.env.PINECONE_INDEX        = 'matec-radar';
    process.env.PINECONE_NAMESPACE_V2 = 'radar_v2';
    process.env.VOYAGE_API_KEY        = 'voyage-key';
    process.env.EMBEDDING_PROVIDER    = 'voyage';

    // Mock embed so we don't actually call Voyage AI
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    mockQuery.mockResolvedValue({ matches: [] });

    await retrieveContext('Grupo Bimbo', 'Final de Línea');

    // Should have called namespace.query 3 times (Promise.all)
    expect(mockQuery).toHaveBeenCalledTimes(3);

    // Verify filter values
    const filters = mockQuery.mock.calls.map(
      (c: [{ filter: Record<string, unknown> }]) => c[0].filter?.tipo?.$eq,
    );
    expect(filters).toContain('senal_historica');
    expect(filters).toContain('keyword');
    expect(filters).toContain('criterio');
  });

  it('queries topK=5 for similares, topK=3 for keywords and criterios', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    mockQuery.mockResolvedValue({ matches: [] });

    await retrieveContext('Empresa X', 'Intralogística');

    const topKValues = mockQuery.mock.calls.map(
      (c: [{ topK: number; filter: { tipo: { $eq: string } } }]) => ({
        topK:  c[0].topK,
        tipo:  c[0].filter?.tipo?.$eq,
      }),
    );

    const similares = topKValues.find(v => v.tipo === 'senal_historica');
    const keywords  = topKValues.find(v => v.tipo === 'keyword');
    const criterios = topKValues.find(v => v.tipo === 'criterio');

    expect(similares?.topK).toBe(5);
    expect(keywords?.topK).toBe(3);
    expect(criterios?.topK).toBe(3);
  });

  it('maps Pinecone results into RagMatch[] with id, score and metadata', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    const fakeMatch = {
      id:       'vec-abc',
      score:    0.95,
      metadata: { tipo: 'senal_historica', empresa: 'TestCorp', pais: 'Colombia' },
    };

    // Simulate: similares returns 1 match, keywords/criterios return empty
    mockQuery
      .mockResolvedValueOnce({ matches: [fakeMatch] }) // similares
      .mockResolvedValueOnce({ matches: [] })           // keywords
      .mockResolvedValueOnce({ matches: [] });          // criterios

    const ctx = await retrieveContext('TestCorp', 'BHS');

    expect(ctx.similares).toHaveLength(1);
    expect(ctx.similares[0]).toMatchObject({
      id:    'vec-abc',
      score: 0.95,
      metadata: expect.objectContaining({ empresa: 'TestCorp' }),
    });
    expect(ctx.keywords).toHaveLength(0);
    expect(ctx.criterios).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// upsertSenal()
// ---------------------------------------------------------------------------

describe('upsertSenal()', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockUpsert.mockResolvedValue(undefined);
    mockPgQuery.mockClear();
    mockPgQuery.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips silently when PINECONE_API_KEY is not set', async () => {
    const saved = process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_API_KEY;

    await expect(upsertSenal(makeResult(), 'session-001')).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();

    process.env.PINECONE_API_KEY = saved;
  });

  it('builds embedding text from key result fields', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    const capturedBody: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody.push(init.body as string);
      return Promise.resolve({
        ok:   true,
        json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
      } as unknown as Response);
    }));

    const r = makeResult({ empresa_evaluada: 'AeroCorp', monto_inversion: '$100M' });
    await upsertSenal(r, 'ses-1');

    const body = JSON.parse(capturedBody[0]);
    expect(body.input[0]).toContain('AeroCorp');
    expect(body.input[0]).toContain('$100M');
    expect(body.input[0]).toContain('Colombia');
  });

  it('upserts exactly one vector to Pinecone with correct metadata', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    const r = makeResult();
    await upsertSenal(r, 'session-xyz');

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [records] = mockUpsert.mock.calls[0] as [Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>];
    expect(records).toHaveLength(1);

    const { values, metadata } = records[0];
    expect(values).toBe(FAKE_VECTOR);
    expect(metadata.tipo).toBe('senal_historica');
    expect(metadata.empresa).toBe('TestCorp SA');
    expect(metadata.radar_activo).toBe('Sí');
    expect(metadata.linea).toBe('BHS');
    expect(metadata.session_id).toBe('session-xyz');
  });

  it('writes an entry to radar_v2_rag_ingest_log via pgQuery', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    await upsertSenal(makeResult(), 'ses-log');

    expect(mockPgQuery).toHaveBeenCalledOnce();
    const sql = mockPgQuery.mock.calls[0][0] as string;
    expect(sql).toContain('radar_v2_rag_ingest_log');
    expect(sql).toContain('senal');
    expect(sql).toContain('ses-log');
  });

  it('stores empty string in session_id metadata when sessionId is blank', async () => {
    process.env.PINECONE_API_KEY   = 'pc-key';
    process.env.VOYAGE_API_KEY     = 'voyage-key';
    process.env.EMBEDDING_PROVIDER = 'voyage';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ data: [{ embedding: FAKE_VECTOR }] }),
    } as unknown as Response));

    await upsertSenal(makeResult(), '   ');

    const [records] = mockUpsert.mock.calls[0] as [Array<{ metadata: Record<string, unknown> }>];
    expect(records[0].metadata.session_id).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildRagBlock()
// ---------------------------------------------------------------------------

describe('buildRagBlock()', () => {
  it('returns empty string when all arrays are empty', () => {
    const ctx: RagContext = { similares: [], keywords: [], criterios: [] };
    expect(buildRagBlock(ctx)).toBe('');
  });

  it('includes H2 header when context is non-empty', () => {
    const ctx: RagContext = {
      similares: [makeMatch()],
      keywords:  [],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('## Contexto histórico (RAG)');
  });

  it('formats similares section with empresa, pais, tipo_senal, ventana, monto, radar', () => {
    const ctx: RagContext = {
      similares: [makeMatch()],
      keywords:  [],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('### Señales similares detectadas previamente');
    expect(block).toContain('AirCargo LATAM');
    expect(block).toContain('Colombia');
    expect(block).toContain('Licitación');
    expect(block).toContain('0-6 Meses');
    expect(block).toContain('$30M');
    expect(block).toContain('Radar: Sí');
  });

  it('formats keywords section from metadata.text', () => {
    const ctx: RagContext = {
      similares: [],
      keywords: [
        { id: 'kw-1', score: 0.9, metadata: { tipo: 'keyword', text: 'ampliación terminal' } },
        { id: 'kw-2', score: 0.8, metadata: { tipo: 'keyword', text: 'CAPEX aeropuerto' } },
      ],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('### Keywords relevantes para esta línea');
    expect(block).toContain('- ampliación terminal');
    expect(block).toContain('- CAPEX aeropuerto');
  });

  it('formats criterios section from metadata.text', () => {
    const ctx: RagContext = {
      similares: [],
      keywords:  [],
      criterios: [
        { id: 'cr-1', metadata: { tipo: 'criterio', text: 'Inversión declarada en documento oficial' } },
      ],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('### Criterios de evaluación aplicables');
    expect(block).toContain('- Inversión declarada en documento oficial');
  });

  it('skips keywords entries that have no metadata.text', () => {
    const ctx: RagContext = {
      similares: [],
      keywords: [
        { id: 'kw-no-text', score: 0.5, metadata: { tipo: 'keyword' } },
      ],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    // Header should appear (non-empty keywords array) but no bullet content
    expect(block).toContain('### Keywords relevantes para esta línea');
    expect(block).not.toContain('- undefined');
  });

  it('skips similares entries that have no metadata', () => {
    const ctx: RagContext = {
      similares: [{ id: 'bare', score: 0.7 }], // no metadata
      keywords:  [],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('## Contexto histórico (RAG)');
    // Should not crash and should not include undefined values
    expect(block).not.toContain('undefined');
  });

  it('renders all three sections when all are populated', () => {
    const ctx: RagContext = {
      similares: [makeMatch()],
      keywords:  [{ id: 'k', metadata: { tipo: 'keyword', text: 'baggage handling' } }],
      criterios: [{ id: 'c', metadata: { tipo: 'criterio', text: 'Permiso ambiental otorgado' } }],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('Señales similares');
    expect(block).toContain('Keywords');
    expect(block).toContain('Criterios');
  });

  it('uses ? placeholders for missing metadata fields in similares', () => {
    const ctx: RagContext = {
      similares: [
        { id: 'x', score: 0.5, metadata: { tipo: 'senal_historica' } }, // no empresa, pais, etc.
      ],
      keywords:  [],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    // Should display ? for missing fields, not crash
    expect(block).toContain('?');
    expect(block).not.toMatch(/undefined/);
  });
});
