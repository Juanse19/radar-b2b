/**
 * Unit tests for lib/radar-v2/scanner.ts — resolveProviderConfig env-var fallback
 * and getActiveBudget behaviour when DB is available or unavailable.
 *
 * resolveProviderConfig is private, so we exercise it indirectly through
 * getActiveBudget, which calls resolveProviderConfig and returns budget.
 *
 * Each describe block uses vi.resetModules() + dynamic re-import so the
 * module-level state in scanner.ts is fresh for every test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Static mocks (hoisted before any import) ──────────────────────────────────

vi.mock('server-only', () => ({}));

const mockPgFirst = vi.fn();
vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgFirst: mockPgFirst,
  pgQuery: vi.fn().mockResolvedValue([]),
  pgLit:   (v: unknown) => `'${String(v)}'`,
  SCHEMA:  'matec_radar',
}));

// Stub providers so scanner.ts does not try to load the real Claude/OpenAI/Gemini
// implementations (which have hard server-only deps).
vi.mock('@/lib/radar-v2/providers', () => ({
  getProvider: vi.fn(() => ({
    name:     'claude',
    model:    'claude-sonnet-4-6',
    scan:     vi.fn(),
    estimate: vi.fn(),
    supports: vi.fn(() => false),
  })),
}));

// RAG is optional / non-fatal in scanner.ts — stub it out.
vi.mock('@/lib/radar-v2/rag', () => ({
  upsertSenal:     vi.fn(),
  retrieveContext: vi.fn().mockResolvedValue([]),
  buildRagBlock:   vi.fn(() => ''),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a fresh scanner module instance (module-level flags reset to initial
 * state) together with a cleared pgFirst spy.
 */
async function freshScanner(): Promise<{
  mod: typeof import('@/lib/radar-v2/scanner');
  pgFirst: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  vi.clearAllMocks();
  const mod    = await import('@/lib/radar-v2/scanner');
  const pgMod  = await import('@/lib/db/supabase/pg_client');
  const spy    = pgMod.pgFirst as ReturnType<typeof vi.fn>;
  return { mod, pgFirst: spy };
}

// ── getActiveBudget / resolveProviderConfig ───────────────────────────────────

describe('resolveProviderConfig env-var fallback (via getActiveBudget)', () => {
  beforeEach(() => {
    process.env.CLAUDE_API_KEY  = 'env-claude-key';
    process.env.OPENAI_API_KEY  = 'env-openai-key';
    process.env.GOOGLE_API_KEY  = 'env-google-key';
  });

  it('returns DB budget when DB query succeeds with a numeric budget', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockResolvedValue({
      api_key_enc:        'db-key',
      model:              'gpt-4o',
      monthly_budget_usd: '50',
    });

    const budget = await mod.getActiveBudget('openai');

    expect(budget).toBe(50);
    expect(pgFirst).toHaveBeenCalledWith(
      expect.stringContaining('ai_provider_configs'),
    );
  });

  it('returns null when DB row has null monthly_budget_usd', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockResolvedValue({
      api_key_enc:        'db-key',
      model:              'gpt-4o',
      monthly_budget_usd: null,
    });

    const budget = await mod.getActiveBudget('openai');

    expect(budget).toBeNull();
  });

  it('falls back gracefully (returns null) when DB throws a "table missing" error', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockRejectedValue(new Error('42P01: relation does not exist'));

    const budget = await mod.getActiveBudget('openai');

    expect(budget).toBeNull();
  });

  it('falls back gracefully when DB throws a network error for claude provider', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockRejectedValue(new Error('network error'));

    await expect(mod.getActiveBudget('claude')).resolves.toBeNull();
  });

  it('falls back gracefully when DB throws a network error for gemini provider', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockRejectedValue(new Error('connection refused'));

    await expect(mod.getActiveBudget('gemini')).resolves.toBeNull();
  });

  it('queries ai_provider_configs with the correct provider column value for claude', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockResolvedValue(null); // no active row

    await mod.getActiveBudget('claude');

    // claude → 'anthropic' in the DB
    expect(pgFirst).toHaveBeenCalledWith(
      expect.stringContaining("'anthropic'"),
    );
  });

  it('queries ai_provider_configs with the correct provider column value for openai', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockResolvedValue(null);

    await mod.getActiveBudget('openai');

    expect(pgFirst).toHaveBeenCalledWith(
      expect.stringContaining("'openai'"),
    );
  });

  it('returns null when no active row exists (pgFirst returns null)', async () => {
    const { mod, pgFirst } = await freshScanner();
    pgFirst.mockResolvedValue(null);

    const budget = await mod.getActiveBudget('openai');

    expect(budget).toBeNull();
  });
});
