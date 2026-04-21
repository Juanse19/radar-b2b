/**
 * Unit tests for the Admin API Keys routes and db-migrations helpers.
 *
 * Strategy:
 *  - All external I/O (pgQuery, pgLit, SCHEMA, auth session) is mocked.
 *  - Next.js Request / Response are simulated with native Node.js objects
 *    (no DOM / jsdom needed — vitest.config uses environment: 'node').
 *  - We import the route handlers after setting up mocks so vi.mock hoisting works.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: vi.fn(),
  pgLit:   vi.fn((val: unknown) => `'${String(val).replace(/'/g, "''")}'`),
  SCHEMA:  'matec_radar',
}));

vi.mock('@/lib/radar-v2/db-migrations', () => ({
  ensureAiProviderConfigsTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: vi.fn(),
}));

// Next.js server internals referenced transitively
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { pgQuery } from '@/lib/db/supabase/pg_client';
import { getCurrentSession } from '@/lib/auth/session';
import { GET, POST } from '@/app/api/admin/api-keys/route';
import { PUT, DELETE } from '@/app/api/admin/api-keys/[id]/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a NextRequest-compatible object for the route handlers.
 * Next.js GET handlers access `req.nextUrl.searchParams` — we need to attach
 * `nextUrl` so the native Request object works with the route code.
 */
function makeRequest(
  method: string,
  url: string,
  body?: unknown,
): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body    = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const req = new Request(url, init) as Request & { nextUrl: URL };
  // Attach nextUrl — Next.js adds this in production, but node:test env doesn't
  req.nextUrl = new URL(url);
  return req;
}

const mockSession = { id: 'user-1', role: 'ADMIN', email: 'admin@matec.com' };

// ── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated
  (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
});

// ── GET /api/admin/api-keys ───────────────────────────────────────────────────

describe('GET /api/admin/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'Unauthorized');
  });

  it('returns masked list — api_key_masked present, api_key_enc absent', async () => {
    const fakeRows = [
      {
        id:                 'uuid-1',
        provider:           'anthropic',
        label:              'Claude Sonnet',
        model:              'claude-sonnet-4-6',
        api_key_enc:        'sk-ant-abc123xyz',
        is_active:          true,
        is_default:         true,
        monthly_budget_usd: 50,
        created_at:         '2026-04-01T00:00:00Z',
        updated_at:         '2026-04-01T00:00:00Z',
      },
    ];
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRows);

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0]).toHaveProperty('api_key_masked');
    expect(json[0]).not.toHaveProperty('api_key_enc');
    expect(json[0].api_key_masked).toMatch(/^••••••••/);
  });

  it('masks a real key — shows last 4 chars', async () => {
    const fakeRows = [
      {
        id: 'uuid-2', provider: 'openai', label: 'GPT-4o', model: 'gpt-4o',
        api_key_enc: 'sk-abc123xyz0',
        is_active: false, is_default: false,
        monthly_budget_usd: null,
        created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
      },
    ];
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRows);

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    const json = await res.json();

    // Key: 'sk-abc123xyz0' → last 4 = 'xyz0' → masked = '••••••••xyz0'
    expect(json[0].api_key_masked).toBe('••••••••xyz0');
  });

  it('empty api_key_enc shows "(sin configurar)"', async () => {
    const fakeRows = [
      {
        id: 'uuid-3', provider: 'google', label: 'Gemini', model: 'gemini-2.0-flash',
        api_key_enc: '',
        is_active: false, is_default: false,
        monthly_budget_usd: null,
        created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
      },
    ];
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRows);

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    const json = await res.json();

    expect(json[0].api_key_masked).toBe('(sin configurar)');
  });

  it('whitespace-only api_key_enc shows "(sin configurar)"', async () => {
    const fakeRows = [
      {
        id: 'uuid-4', provider: 'anthropic', label: 'Test', model: 'claude-haiku',
        api_key_enc: '   ',
        is_active: false, is_default: false,
        monthly_budget_usd: null,
        created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
      },
    ];
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRows);

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    const json = await res.json();

    expect(json[0].api_key_masked).toBe('(sin configurar)');
  });

  it('returns 500 when pgQuery throws', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection failed'));

    const req = makeRequest('GET', 'http://localhost/api/admin/api-keys');
    const res = await GET(req as never);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'DB connection failed');
  });
});

// ── POST /api/admin/api-keys ──────────────────────────────────────────────────

describe('POST /api/admin/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', label: 'GPT-4o', model: 'gpt-4o', api_key: 'sk-test',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when api_key is empty string', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', label: 'GPT-4o', model: 'gpt-4o', api_key: '',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/api_key/i);
  });

  it('returns 400 when api_key is whitespace only', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', label: 'GPT-4o', model: 'gpt-4o', api_key: '   ',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when provider is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      label: 'GPT-4o', model: 'gpt-4o', api_key: 'sk-validkey',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/provider/i);
  });

  it('returns 400 when label is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', model: 'gpt-4o', api_key: 'sk-validkey',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when model is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', label: 'GPT-4o', api_key: 'sk-validkey',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('successful insert — calls pgQuery with INSERT and returns 201', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'new-uuid' }]);

    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider:           'anthropic',
      label:              'Claude Sonnet',
      model:              'claude-sonnet-4-6',
      api_key:            'sk-ant-validkey123',
      is_active:          true,
      is_default:         false,
      monthly_budget_usd: 100,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('id', 'new-uuid');

    // pgQuery should have been called with an INSERT statement
    const callArg: string = (pgQuery as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] ?? '';
    expect(callArg.toUpperCase()).toContain('INSERT INTO');
  });

  it('returns 500 when pgQuery throws during INSERT', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('unique_violation'));

    const req = makeRequest('POST', 'http://localhost/api/admin/api-keys', {
      provider: 'openai', label: 'GPT-4o', model: 'gpt-4o', api_key: 'sk-key',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/admin/api-keys/[id] ─────────────────────────────────────────────

describe('PUT /api/admin/api-keys/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = makeRequest('PUT', 'http://localhost/api/admin/api-keys/some-id', {
      label: 'Updated Label',
    });
    const res = await PUT(req as never, { params: Promise.resolve({ id: 'some-id' }) });
    expect(res.status).toBe(401);
  });

  it('clears other defaults when is_default: true — calls UPDATE before main UPDATE', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'uuid-1' }]);

    const req = makeRequest('PUT', 'http://localhost/api/admin/api-keys/uuid-1', {
      is_default: true,
      label:      'Default config',
    });
    const res = await PUT(req as never, { params: Promise.resolve({ id: 'uuid-1' }) });
    expect(res.status).toBe(200);

    // pgQuery should have been called at least twice: one clear + one update
    expect((pgQuery as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);

    // First call should set is_default = FALSE for other rows
    const firstCall: string = (pgQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstCall.toUpperCase()).toContain('IS_DEFAULT = FALSE');
  });

  it('does NOT call clear-defaults when is_default is not true', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'uuid-2' }]);

    const req = makeRequest('PUT', 'http://localhost/api/admin/api-keys/uuid-2', {
      label: 'Just a label change',
    });
    await PUT(req as never, { params: Promise.resolve({ id: 'uuid-2' }) });

    // Only 1 pgQuery call expected (the main UPDATE)
    expect((pgQuery as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('returns 404 when row not found', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([]); // empty RETURNING

    const req = makeRequest('PUT', 'http://localhost/api/admin/api-keys/nonexistent', {
      label: 'test',
    });
    const res = await PUT(req as never, { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });

  it('main UPDATE query contains SET and WHERE clauses', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'uuid-3' }]);

    const req = makeRequest('PUT', 'http://localhost/api/admin/api-keys/uuid-3', {
      model: 'gpt-4o-mini',
    });
    await PUT(req as never, { params: Promise.resolve({ id: 'uuid-3' }) });

    const lastCall: string = (pgQuery as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] ?? '';
    expect(lastCall.toUpperCase()).toContain('UPDATE');
    expect(lastCall.toUpperCase()).toContain('WHERE');
  });
});

// ── DELETE /api/admin/api-keys/[id] ──────────────────────────────────────────

describe('DELETE /api/admin/api-keys/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = makeRequest('DELETE', 'http://localhost/api/admin/api-keys/uuid-del');
    const res = await DELETE(req as never, { params: Promise.resolve({ id: 'uuid-del' }) });
    expect(res.status).toBe(401);
  });

  it('calls DELETE query and returns deleted id', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'uuid-del' }]);

    const req = makeRequest('DELETE', 'http://localhost/api/admin/api-keys/uuid-del');
    const res = await DELETE(req as never, { params: Promise.resolve({ id: 'uuid-del' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('id', 'uuid-del');

    const callArg: string = (pgQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.toUpperCase()).toContain('DELETE FROM');
  });

  it('returns 404 when row not found', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockResolvedValue([]); // nothing deleted

    const req = makeRequest('DELETE', 'http://localhost/api/admin/api-keys/ghost-id');
    const res = await DELETE(req as never, { params: Promise.resolve({ id: 'ghost-id' }) });
    expect(res.status).toBe(404);
  });

  it('returns 500 when pgQuery throws', async () => {
    (pgQuery as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('permission denied'));

    const req = makeRequest('DELETE', 'http://localhost/api/admin/api-keys/uuid-x');
    const res = await DELETE(req as never, { params: Promise.resolve({ id: 'uuid-x' }) });
    expect(res.status).toBe(500);
  });
});
