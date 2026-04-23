/**
 * Unit tests for lib/comercial/db-migrations.ts
 *
 * Tests cover:
 *   - ensureAiProviderConfigsTable: CREATE + SEED on first call
 *   - ensureAiProviderConfigsTable: idempotent (cached flag — does not re-run)
 *   - ensureAiProviderConfigsTable: throws and leaves flag unset on failure
 *   - isTableMissingError: various error shapes
 *
 * NOTE: The module-level `migrationRan` flag persists across tests within one
 * module import. We use vi.resetModules() + dynamic re-import to get a fresh
 * module state for each describe block that needs it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Static mocks (hoisted — applied before any module is imported) ────────────
//
// These top-level vi.mock() calls are hoisted by Vitest and persist across
// vi.resetModules() calls. That means re-importing @/lib/comercial/db-migrations
// after resetModules() will still receive the mocked pg_client — but pgQuery
// will be a fresh vi.fn() because the factory runs again.

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/supabase/pg_client', () => ({
  pgQuery: vi.fn(),
  SCHEMA:  'matec_radar',
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a freshly-imported db-migrations module (fresh migrationRan = false)
 * and the pgQuery spy from the same module graph.
 *
 * Strategy: vi.resetModules() clears the module registry so a subsequent
 * dynamic import loads a brand-new instance of db-migrations (with
 * migrationRan reset to false). The top-level vi.mock() factory is re-invoked
 * but returns the SAME spy object reference — so we call vi.clearAllMocks()
 * after the reset to zero out call history on the shared spy.
 */
async function freshModule(): Promise<{
  mod: typeof import('@/lib/comercial/db-migrations');
  pgQuery: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  vi.clearAllMocks(); // clear call history on the shared spy so counts start at 0
  const mod     = await import('@/lib/comercial/db-migrations');
  const pgMod   = await import('@/lib/db/supabase/pg_client');
  const pgQuery = pgMod.pgQuery as ReturnType<typeof vi.fn>;
  return { mod, pgQuery };
}

// ── ensureAiProviderConfigsTable ──────────────────────────────────────────────

describe('ensureAiProviderConfigsTable', () => {
  it('runs CREATE TABLE and seed INSERT on first call', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureAiProviderConfigsTable();

    // Should call pgQuery exactly twice: CREATE + SEED
    expect(pgQuery).toHaveBeenCalledTimes(2);

    const [createCall, seedCall] = pgQuery.mock.calls as [string[], string[]];
    expect(createCall[0].toUpperCase()).toContain('CREATE TABLE IF NOT EXISTS');
    expect(seedCall[0].toUpperCase()).toContain('INSERT INTO');
  });

  it('does not re-run on second call (cached migrationRan flag)', async () => {
    // Use one freshModule() call, then call ensureAiProviderConfigsTable twice
    // on the SAME module instance — migrationRan should be true after first call.
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureAiProviderConfigsTable(); // first call → 2 pgQuery calls
    const callsAfterFirst = pgQuery.mock.calls.length;

    await mod.ensureAiProviderConfigsTable(); // second call → cached, no extra calls
    const callsAfterSecond = pgQuery.mock.calls.length;

    expect(callsAfterFirst).toBe(2);
    expect(callsAfterSecond).toBe(2); // no new calls on second invocation
  });

  it('throws when pgQuery fails and does NOT set migrationRan', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockRejectedValue(new Error('relation "matec_radar.ai_provider_configs" does not exist'));

    await expect(mod.ensureAiProviderConfigsTable()).rejects.toThrow('does not exist');

    // After failure, calling again should retry (pgQuery is called again)
    pgQuery.mockResolvedValue([]);
    await mod.ensureAiProviderConfigsTable();

    // First failed attempt called pgQuery once (CREATE failed, never reached SEED).
    // Second successful attempt called it twice more. Total >= 3.
    expect(pgQuery.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('CREATE TABLE SQL targets the correct schema and table name', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureAiProviderConfigsTable();

    const createSql: string = pgQuery.mock.calls[0][0];
    expect(createSql).toContain('matec_radar.ai_provider_configs');
  });

  it('SEED INSERT seeds anthropic, openai, and google providers', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureAiProviderConfigsTable();

    const seedSql: string = pgQuery.mock.calls[1][0];
    expect(seedSql).toContain('anthropic');
    expect(seedSql).toContain('openai');
    expect(seedSql).toContain('google');
    expect(seedSql.toUpperCase()).toContain('ON CONFLICT');
  });
});

// ── ensureRadarV2Tables ───────────────────────────────────────────────────────

describe('ensureRadarV2Tables', () => {
  it('runs 5 pgQuery calls (5 SQL statements) on first call', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureRadarV2Tables();

    expect(pgQuery).toHaveBeenCalledTimes(5);
  });

  it('is idempotent — second call on same module instance makes no extra pgQuery calls', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureRadarV2Tables();
    const callsAfterFirst = pgQuery.mock.calls.length;

    await mod.ensureRadarV2Tables();
    const callsAfterSecond = pgQuery.mock.calls.length;

    expect(callsAfterFirst).toBe(5);
    expect(callsAfterSecond).toBe(5); // no new calls on second invocation
  });

  it('throws and leaves radarV2TablesRan = false when first pgQuery fails', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockRejectedValue(new Error('relation does not exist'));

    await expect(mod.ensureRadarV2Tables()).rejects.toThrow('does not exist');

    // After failure, a second call should retry — pgQuery is invoked again
    pgQuery.mockResolvedValue([]);
    await mod.ensureRadarV2Tables();

    // First call: 1 failing pgQuery. Second call: 5 pgQuery calls. Total >= 6.
    expect(pgQuery.mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it('SQL targets ${SCHEMA}.radar_v2_sessions table name', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureRadarV2Tables();

    const firstSql: string = pgQuery.mock.calls[0][0];
    expect(firstSql).toContain('matec_radar.radar_v2_sessions');
  });

  it('SQL includes ALTER TABLE ... ADD COLUMN IF NOT EXISTS duration_ms', async () => {
    const { mod, pgQuery } = await freshModule();
    pgQuery.mockResolvedValue([]);

    await mod.ensureRadarV2Tables();

    // Step 2 (index 1) is the ALTER TABLE adding duration_ms
    const alterSql: string = pgQuery.mock.calls[1][0];
    expect(alterSql.toUpperCase()).toContain('ALTER TABLE');
    expect(alterSql.toUpperCase()).toContain('ADD COLUMN IF NOT EXISTS');
    expect(alterSql).toContain('duration_ms');
  });
});

// ── isTableMissingError ───────────────────────────────────────────────────────

describe('isTableMissingError', () => {
  // Import directly for these pure-function tests (no module reset needed)
  let isTableMissingError: (err: unknown) => boolean;

  beforeEach(async () => {
    const mod = await import('@/lib/comercial/db-migrations');
    isTableMissingError = mod.isTableMissingError;
  });

  it('returns true for an error containing "42P01"', () => {
    expect(isTableMissingError(new Error('ERROR 42P01: relation "foo" does not exist'))).toBe(true);
  });

  it('returns true for an error containing "does not exist"', () => {
    expect(isTableMissingError(new Error('relation "matec_radar.ai_provider_configs" does not exist'))).toBe(true);
  });

  it('returns true for a plain object with a matching message', () => {
    expect(isTableMissingError({ message: 'table does not exist' })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isTableMissingError(new Error('connection refused'))).toBe(false);
  });

  it('returns false for a non-Error string', () => {
    expect(isTableMissingError('some string error')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTableMissingError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTableMissingError(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isTableMissingError(42)).toBe(false);
  });

  it('returns false for empty Error (no message)', () => {
    expect(isTableMissingError(new Error(''))).toBe(false);
  });
});
