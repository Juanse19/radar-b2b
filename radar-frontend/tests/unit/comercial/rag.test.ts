/**
 * Unit tests for lib/comercial/rag.ts
 *
 * Coverage:
 *   embed()          — Pinecone native inference, missing-key error, empty-values error
 *   retrieveContext()— graceful degradation w/o PINECONE_API_KEY, parallel queries
 *   upsertSenal()    — skips without key, embeds + upserts + writes ingest log
 *   buildRagBlock()  — empty context, full context, partial sections
 *
 * Pinecone SDK (including inference) is mocked. `server-only` is stubbed so
 * the module can be imported outside Next.js.
 */

import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

// ---------------------------------------------------------------------------
// Static hoisted mocks
// ---------------------------------------------------------------------------

const { mockPgQuery, mockInferenceEmbed, mockUpsert, mockQuery, mockNamespace, mockIndex } =
  vi.hoisted(() => {
    const mockInferenceEmbed = vi.fn().mockResolvedValue({ data: [{ values: [] }] });
    const mockUpsert         = vi.fn().mockResolvedValue(undefined);
    const mockQuery          = vi.fn().mockResolvedValue({ matches: [] });
    const mockNamespace      = vi.fn().mockReturnValue({ upsert: mockUpsert, query: mockQuery });
    const mockIndex          = vi.fn().mockReturnValue({ namespace: mockNamespace });
    const mockPgQuery        = vi.fn().mockResolvedValue([]);
    return { mockPgQuery, mockInferenceEmbed, mockUpsert, mockQuery, mockNamespace, mockIndex };
  });

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: mockPgQuery,
  pgLit:   (v: unknown) => (v === null ? 'NULL' : `'${String(v)}'`),
  SCHEMA:  'matec_radar',
}));

// eslint-disable-next-line prefer-arrow-callback
vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn(function MockPinecone() {
    return {
      index:     mockIndex,
      inference: { embed: mockInferenceEmbed },
    };
  }),
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
} from '@/lib/comercial/rag';
import type { Agente1Result } from '@/lib/comercial/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_VECTOR = Array.from({ length: 1024 }, (_, i) => i / 1024);

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

  beforeEach(() => {
    mockInferenceEmbed.mockClear();
    mockInferenceEmbed.mockResolvedValue({ data: [{ values: FAKE_VECTOR }] });
  });

  afterEach(() => {
    Object.assign(process.env, savedEnv);
    vi.restoreAllMocks();
  });

  it('calls pc.inference.embed with model, text array, and inputType=query by default', async () => {
    process.env.PINECONE_API_KEY        = 'pc-test-key';
    process.env.PINECONE_EMBEDDING_MODEL = 'multilingual-e5-large';

    const result = await embed('test query');

    expect(mockInferenceEmbed).toHaveBeenCalledOnce();
    const [model, inputs, params] = mockInferenceEmbed.mock.calls[0] as [
      string,
      string[],
      { inputType: string; truncate: string },
    ];
    expect(model).toBe('multilingual-e5-large');
    expect(inputs).toEqual(['test query']);
    expect(params.inputType).toBe('query');
    expect(params.truncate).toBe('END');
    expect(result).toBe(FAKE_VECTOR);
  });

  it('passes inputType=passage when explicitly requested', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

    await embed('corpus text', 'passage');

    const [, , params] = mockInferenceEmbed.mock.calls[0] as [
      string,
      string[],
      { inputType: string },
    ];
    expect(params.inputType).toBe('passage');
  });

  it('uses multilingual-e5-large as default model when PINECONE_EMBEDDING_MODEL is unset', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';
    delete process.env.PINECONE_EMBEDDING_MODEL;

    await embed('test');

    const [model] = mockInferenceEmbed.mock.calls[0] as [string];
    expect(model).toBe('multilingual-e5-large');
  });

  it('throws when PINECONE_API_KEY is not set', async () => {
    delete process.env.PINECONE_API_KEY;

    await expect(embed('hello')).rejects.toThrow('PINECONE_API_KEY not set');
  });

  it('throws when inference returns no values', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';
    mockInferenceEmbed.mockResolvedValueOnce({ data: [{}] }); // no values field

    await expect(embed('text')).rejects.toThrow('no embedding values');
  });
});

// ---------------------------------------------------------------------------
// retrieveContext()
// ---------------------------------------------------------------------------

describe('retrieveContext()', () => {
  beforeEach(() => {
    mockInferenceEmbed.mockClear();
    mockInferenceEmbed.mockResolvedValue({ data: [{ values: FAKE_VECTOR }] });
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
    expect(mockInferenceEmbed).not.toHaveBeenCalled();

    process.env.PINECONE_API_KEY = saved;
  });

  it('makes 3 parallel namespace.query calls with correct filters', async () => {
    process.env.PINECONE_API_KEY              = 'pc-test-key';
    process.env.PINECONE_INDEX                = 'matec-radar';
    process.env.PINECONE_NAMESPACE_COMERCIAL  = 'comercial_dev';

    await retrieveContext('Grupo Bimbo', 'Final de Línea');

    expect(mockQuery).toHaveBeenCalledTimes(3);

    const filters = mockQuery.mock.calls.map(
      (c: [{ filter: Record<string, unknown> }]) => c[0].filter?.tipo?.$eq,
    );
    expect(filters).toContain('senal_historica');
    expect(filters).toContain('keyword');
    expect(filters).toContain('criterio');
  });

  it('queries topK=5 for similares, topK=3 for keywords and criterios', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

    await retrieveContext('Empresa X', 'Intralogística');

    const topKValues = mockQuery.mock.calls.map(
      (c: [{ topK: number; filter: { tipo: { $eq: string } } }]) => ({
        topK: c[0].topK,
        tipo: c[0].filter?.tipo?.$eq,
      }),
    );

    expect(topKValues.find(v => v.tipo === 'senal_historica')?.topK).toBe(5);
    expect(topKValues.find(v => v.tipo === 'keyword')?.topK).toBe(3);
    expect(topKValues.find(v => v.tipo === 'criterio')?.topK).toBe(3);
  });

  it('maps Pinecone results into RagMatch[] with id, score and metadata', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

    const fakeMatch = {
      id:       'vec-abc',
      score:    0.95,
      metadata: { tipo: 'senal_historica', empresa: 'TestCorp', pais: 'Colombia' },
    };

    mockQuery
      .mockResolvedValueOnce({ matches: [fakeMatch] })
      .mockResolvedValueOnce({ matches: [] })
      .mockResolvedValueOnce({ matches: [] });

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
    mockInferenceEmbed.mockClear();
    mockInferenceEmbed.mockResolvedValue({ data: [{ values: FAKE_VECTOR }] });
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
    process.env.PINECONE_API_KEY = 'pc-key';

    const r = makeResult({ empresa_evaluada: 'AeroCorp', monto_inversion: '$100M' });
    await upsertSenal(r, 'ses-1');

    expect(mockInferenceEmbed).toHaveBeenCalledOnce();
    const [, [text]] = mockInferenceEmbed.mock.calls[0] as [string, string[]];
    expect(text).toContain('AeroCorp');
    expect(text).toContain('$100M');
    expect(text).toContain('Colombia');
  });

  it('calls embed with inputType=passage', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

    await upsertSenal(makeResult(), 'ses-1');

    const [, , params] = mockInferenceEmbed.mock.calls[0] as [
      string,
      string[],
      { inputType: string },
    ];
    expect(params.inputType).toBe('passage');
  });

  it('upserts exactly one vector to Pinecone with correct metadata', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

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
    process.env.PINECONE_API_KEY = 'pc-key';

    await upsertSenal(makeResult(), 'ses-log');

    expect(mockPgQuery).toHaveBeenCalledOnce();
    const sql = mockPgQuery.mock.calls[0][0] as string;
    expect(sql).toContain('radar_v2_rag_ingest_log');
    expect(sql).toContain('senal');
    expect(sql).toContain('ses-log');
  });

  it('stores empty string in session_id metadata when sessionId is blank', async () => {
    process.env.PINECONE_API_KEY = 'pc-key';

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
      keywords: [{ id: 'kw-no-text', score: 0.5, metadata: { tipo: 'keyword' } }],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
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
      similares: [{ id: 'x', score: 0.5, metadata: { tipo: 'senal_historica' } }],
      keywords:  [],
      criterios: [],
    };
    const block = buildRagBlock(ctx);
    expect(block).toContain('?');
    expect(block).not.toMatch(/undefined/);
  });
});
