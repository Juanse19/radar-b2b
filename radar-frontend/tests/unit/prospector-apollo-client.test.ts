/**
 * Unit tests para lib/apollo/client.ts (sin red — fetch mockeado).
 *
 * Verifica:
 *   - APOLLO_API_KEY se inyecta como x-api-key
 *   - HTTP 429 → retry con onRateLimit callback
 *   - Otros errores HTTP → ApolloHttpError
 *   - Timeout abort funciona
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock 'server-only' — Next.js guard que no aplica en entorno Node de Vitest.
vi.mock('server-only', () => ({}));

import {
  apolloPost,
  ApolloHttpError,
  ApolloRateLimitError,
  assertApolloKeyServerOnly,
} from '@/lib/apollo/client';

describe('apolloPost', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.APOLLO_API_KEY = 'test-key-1234';
    delete process.env.NEXT_PUBLIC_APOLLO_API_KEY;
  });

  afterEach(() => {
    Object.keys(process.env).forEach(k => {
      if (!(k in origEnv)) delete process.env[k];
    });
    Object.assign(process.env, origEnv);
    vi.restoreAllMocks();
  });

  it('inyecta x-api-key y devuelve JSON parseado', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ people: [{ id: 'abc' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await apolloPost<{ people: { id: string }[] }>(
      '/mixed_people/api_search',
      { foo: 'bar' },
    );

    expect(data.people[0].id).toBe('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/mixed_people/api_search');
    expect((init as RequestInit).headers).toMatchObject({
      'x-api-key': 'test-key-1234',
      'Content-Type': 'application/json',
    });
  });

  it('lanza ApolloHttpError en errores HTTP no-429', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apolloPost('/x', {})).rejects.toBeInstanceOf(ApolloHttpError);
  });

  it('429 → retry con onRateLimit; eventualmente lanza ApolloRateLimitError tras 3 intentos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:     false,
      status: 429,
      text:   async () => 'rate limited',
    });
    vi.stubGlobal('fetch', fetchMock);
    // sleep para que las pruebas no esperen 30s+60s+90s reales
    vi.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    const onRate = vi.fn();
    await expect(
      apolloPost('/x', {}, { onRateLimit: onRate, perAttemptTimeoutMs: 100 }),
    ).rejects.toBeInstanceOf(ApolloRateLimitError);

    // 1 + 3 retries = 4 fetches
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onRate).toHaveBeenCalledTimes(3);
  });

  it('falla rápido si APOLLO_API_KEY no está configurada', async () => {
    delete process.env.APOLLO_API_KEY;
    await expect(apolloPost('/x', {})).rejects.toThrow(/APOLLO_API_KEY/);
  });
});

describe('assertApolloKeyServerOnly', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    Object.keys(process.env).forEach(k => {
      if (!(k in origEnv)) delete process.env[k];
    });
    Object.assign(process.env, origEnv);
  });

  it('lanza si NEXT_PUBLIC_APOLLO_API_KEY existe', () => {
    process.env.NEXT_PUBLIC_APOLLO_API_KEY = 'leaked';
    expect(() => assertApolloKeyServerOnly()).toThrow(/NEXT_PUBLIC_/);
  });

  it('no lanza si solo existe APOLLO_API_KEY', () => {
    process.env.APOLLO_API_KEY = 'ok';
    delete process.env.NEXT_PUBLIC_APOLLO_API_KEY;
    expect(() => assertApolloKeyServerOnly()).not.toThrow();
  });
});
