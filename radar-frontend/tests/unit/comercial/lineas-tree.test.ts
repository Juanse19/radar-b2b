/**
 * Unit tests for app/api/comercial/lineas-tree/route.ts
 *
 * Tests the fallback shape returned when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are NOT set (local dev without DB).
 *
 * Uses the exported FALLBACK_TREE via the GET handler.
 *
 * Mocks:
 *  - server-only (no-op)
 *  - lib/auth/session (returns a valid session)
 *  - lib/db/supabase/pg_client (not called in fallback path)
 *  - next/server (minimal NextResponse shim)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Static mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id:          '1',
    name:        'Test User',
    email:       'test@matec.com',
    role:        'ADMIN',
    accessState: 'ACTIVO',
  }),
}));

vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: vi.fn().mockResolvedValue([]),
  pgFirst: vi.fn().mockResolvedValue(null),
  pgLit:   (v: unknown) => `'${String(v)}'`,
  SCHEMA:  'matec_radar',
}));

// Minimal NextResponse shim that satisfies the route's usage.
vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((data: unknown, init?: { status?: number }) => ({
        _data:   data,
        _status: init?.status ?? 200,
        json:    async () => data,
        status:  init?.status ?? 200,
      })),
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────

import { GET, type ParentLineaItem, type SubLineaItem } from '@/app/api/comercial/lineas-tree/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Invokes GET and returns the parsed JSON body plus HTTP status. */
async function callGET(): Promise<{ status: number; body: unknown }> {
  const response = await GET();
  // The mock NextResponse.json stores data in _data / _status
  const r = response as unknown as { _data: unknown; _status: number };
  return { status: r._status, body: r._data };
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

const VALID_SUB_LINEA_VALUES = new Set([
  'BHS',
  'Intralogística',
  'Motos',
  'Cartón',
  'Final de Línea',
  'SOLUMAT',
]);

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/comercial/lineas-tree — fallback (no Supabase)', () => {
  const origSupabaseUrl     = process.env.SUPABASE_URL;
  const origSupabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    // Ensure Supabase env vars are absent so the fallback path is taken.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    // Restore to avoid polluting other tests.
    if (origSupabaseUrl)  process.env.SUPABASE_URL = origSupabaseUrl;
    if (origSupabaseKey)  process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
  });

  // ── Structure ───────────────────────────────────────────────────────────────

  it('returns HTTP 200', async () => {
    const { status } = await callGET();
    expect(status).toBe(200);
  });

  it('returns an array', async () => {
    const { body } = await callGET();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns exactly 3 parent lineas', async () => {
    const { body } = await callGET();
    expect((body as ParentLineaItem[]).length).toBe(3);
  });

  // ── Parent linea shape ──────────────────────────────────────────────────────

  it('each parent has code, label, description, and subLineas array', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    for (const parent of lineas) {
      expect(typeof parent.code).toBe('string');
      expect(parent.code.length).toBeGreaterThan(0);

      expect(typeof parent.label).toBe('string');
      expect(parent.label.length).toBeGreaterThan(0);

      expect(typeof parent.description).toBe('string');

      expect(Array.isArray(parent.subLineas)).toBe(true);
    }
  });

  // ── BHS parent ──────────────────────────────────────────────────────────────

  it('BHS parent exists with code "bhs"', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const bhs = lineas.find(l => l.code === 'bhs');
    expect(bhs).toBeDefined();
    expect(bhs?.label).toBe('BHS');
  });

  it('BHS parent has at least 1 sub-linea', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const bhs = lineas.find(l => l.code === 'bhs');
    expect(bhs?.subLineas.length).toBeGreaterThanOrEqual(1);
  });

  // ── Sub-linea shape ─────────────────────────────────────────────────────────

  it('each sub-linea has value, label, description', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    for (const parent of lineas) {
      for (const sub of parent.subLineas) {
        expect(typeof sub.value).toBe('string');
        expect(sub.value.length).toBeGreaterThan(0);

        expect(typeof sub.label).toBe('string');
        expect(sub.label.length).toBeGreaterThan(0);

        expect(typeof sub.description).toBe('string');
      }
    }
  });

  it('all sub-linea value fields are recognized LINE_FILTER keys', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const allSubValues = lineas.flatMap(l => l.subLineas).map((s: SubLineaItem) => s.value);

    for (const value of allSubValues) {
      expect(VALID_SUB_LINEA_VALUES.has(value)).toBe(true);
    }
  });

  it('covers all 6 expected line values across sub-lineas', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const allSubValues = new Set(
      lineas.flatMap(l => l.subLineas).map((s: SubLineaItem) => s.value),
    );

    for (const expected of VALID_SUB_LINEA_VALUES) {
      expect(allSubValues.has(expected)).toBe(true);
    }
  });

  // ── Intralogística parent ────────────────────────────────────────────────────

  it('Intralogística parent exists and contains Motos sub-linea', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const intra = lineas.find(l => l.code === 'intralogistica');
    expect(intra).toBeDefined();
    const subValues = intra!.subLineas.map(s => s.value);
    expect(subValues).toContain('Intralogística');
    expect(subValues).toContain('Motos');
  });

  // ── Cartón/papel parent ──────────────────────────────────────────────────────

  it('Cartón parent exists and contains Cartón, Final de Línea, SOLUMAT', async () => {
    const { body } = await callGET();
    const lineas = body as ParentLineaItem[];
    const carton = lineas.find(l => l.code === 'carton_papel');
    expect(carton).toBeDefined();
    const subValues = carton!.subLineas.map(s => s.value);
    expect(subValues).toContain('Cartón');
    expect(subValues).toContain('Final de Línea');
    expect(subValues).toContain('SOLUMAT');
  });

  // ── Auth guard — endpoint is public (reference data, not sensitive) ──────────

  it('returns 200 even when no session (no auth required)', async () => {
    const { getCurrentSession } = await import('@/lib/auth/session');
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const response = await GET();
    const r = response as unknown as { _status: number };
    expect(r._status).toBe(200);
  });
});
