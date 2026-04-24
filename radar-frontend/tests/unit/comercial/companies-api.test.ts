/**
 * Unit tests for app/api/comercial/companies/route.ts — mock fallback path.
 *
 * The mock fallback is active when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * are NOT set. Tests verify filtering by linea, the ALL shortcut, name search,
 * and the auth guard.
 *
 * Mocks:
 *  - server-only (no-op)
 *  - lib/auth/session (returns a valid session by default)
 *  - lib/db/supabase/pg_client (not called in the fallback path)
 *  - next/server (minimal NextResponse shim)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Static mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

// Factory must use vi.fn() inline — no top-level variable references allowed
// inside vi.mock factories (they are hoisted above variable declarations).
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

// Minimal NextResponse shim compatible with the route's usage pattern.
vi.mock('next/server', () => {
  return {
    NextRequest: class {
      url: string;
      nextUrl: URL;
      constructor(url: string) {
        this.url     = url;
        this.nextUrl = new URL(url);
      }
    },
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

import { GET } from '@/app/api/comercial/companies/route';
import { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';

// Typed reference to the mock — retrieved after the module has been loaded.
const mockGetCurrentSession = vi.mocked(getCurrentSession);

// ── Types mirrored from the route ─────────────────────────────────────────────

interface MockCompany {
  id:      number;
  name:    string;
  country: string;
  tier:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a NextRequest with the given query params and calls GET.
 * Returns status + parsed body array.
 */
async function callGET(params: Record<string, string> = {}): Promise<{
  status:  number;
  body:    MockCompany[];
}> {
  const url = new URL('http://localhost/api/comercial/companies');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const req = new NextRequest(url.toString());
  const res = await GET(req);
  const r   = res as unknown as { _data: unknown; _status: number };
  return { status: r._status, body: r._data as MockCompany[] };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/comercial/companies — mock fallback (no Supabase)', () => {
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    // Remove Supabase env vars to activate the mock fallback.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Reset the session mock to a valid session before each test.
    mockGetCurrentSession.mockResolvedValue({
      id: '1', name: 'Test User', email: 'test@matec.com',
      role: 'ADMIN' as const, accessState: 'ACTIVO' as const,
    });
  });

  afterEach(() => {
    if (origSupabaseUrl) process.env.SUPABASE_URL = origSupabaseUrl;
    if (origSupabaseKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  it('returns 401 when session is null', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null);
    const { status } = await callGET();
    expect(status).toBe(401);
  });

  // ── Basic shape ──────────────────────────────────────────────────────────────

  it('returns 200 with an array when session is valid', async () => {
    const { status, body } = await callGET();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('each company has id, name, country, tier fields (no linea exposed)', async () => {
    const { body } = await callGET();
    expect(body.length).toBeGreaterThan(0);
    for (const company of body) {
      expect(typeof company.id).toBe('number');
      expect(typeof company.name).toBe('string');
      expect(typeof company.country).toBe('string');
      expect(typeof company.tier).toBe('string');
      // The route strips `linea` from the mock response via destructuring
      expect((company as Record<string, unknown>)['linea']).toBeUndefined();
    }
  });

  // ── linea = 'ALL' ────────────────────────────────────────────────────────────

  it('returns all mock companies when linea is ALL', async () => {
    const { body: all  } = await callGET({ linea: 'ALL' });
    const { body: none } = await callGET();
    // Both should return the same count (ALL == no filter)
    expect(all.length).toBe(none.length);
    expect(all.length).toBeGreaterThanOrEqual(8); // MOCK_COMPANIES has 8 entries
  });

  // ── linea = 'BHS' ────────────────────────────────────────────────────────────

  it('returns only BHS companies when linea is BHS', async () => {
    const { body } = await callGET({ linea: 'BHS' });
    expect(body.length).toBeGreaterThanOrEqual(1);
    // The route strips linea from the returned object; verify count matches
    // MOCK_COMPANIES has 2 BHS entries (id 1 and 2)
    expect(body.length).toBe(2);
  });

  it('BHS companies do not include companies from other lineas', async () => {
    const { body: bhs          } = await callGET({ linea: 'BHS' });
    const { body: intralogistic } = await callGET({ linea: 'Intralogística' });

    const bhsIds   = new Set(bhs.map(c => c.id));
    const intraIds = new Set(intralogistic.map(c => c.id));
    // Intersection must be empty — BHS and Intralogística are distinct mock sets
    const overlap = [...bhsIds].filter(id => intraIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  // ── linea = 'Final de Línea' ─────────────────────────────────────────────────

  it('returns matching companies when linea is "Final de Línea"', async () => {
    const { body } = await callGET({ linea: 'Final de Línea' });
    expect(body.length).toBeGreaterThanOrEqual(1);
    // MOCK_COMPANIES has 1 Final de Línea entry (id 6)
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(6);
  });

  it('returns empty array for unknown linea', async () => {
    const { body } = await callGET({ linea: 'NonExistent' });
    expect(body).toHaveLength(0);
  });

  // ── Name search (?q=) ─────────────────────────────────────────────────────────

  it('filters by name when ?q= is provided (case-insensitive)', async () => {
    const { body } = await callGET({ q: 'demo 1' });
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(1);
    expect(body[0].name.toLowerCase()).toContain('demo 1');
  });

  it('returns all companies whose name contains the query string', async () => {
    // All 8 mock companies have "Demo" in their name
    const { body } = await callGET({ q: 'Demo' });
    expect(body.length).toBe(8);
  });

  it('returns empty array when q has no match', async () => {
    const { body } = await callGET({ q: 'zzznomatch' });
    expect(body).toHaveLength(0);
  });

  // ── Combined: linea + q ───────────────────────────────────────────────────────

  it('applies both linea and q filters when both are provided', async () => {
    // linea=BHS → 2 companies (id 1, 2); q=Demo 1 → only id 1
    const { body } = await callGET({ linea: 'BHS', q: 'Demo 1' });
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(1);
  });

  // ── URL-encoded linea ────────────────────────────────────────────────────────

  it('handles URL-encoded linea parameter (e.g. Final%20de%20L%C3%ADnea)', async () => {
    const encoded = encodeURIComponent('Final de Línea');
    const { body } = await callGET({ linea: encoded });
    expect(body.length).toBe(1);
  });
});
