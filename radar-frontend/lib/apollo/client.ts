/**
 * lib/apollo/client.ts — Apollo.io HTTP client (server-only).
 *
 * Wraps fetch with x-api-key auth and exponential retry on HTTP 429.
 * No Apollo SDK dependency; we hit api.apollo.io directly.
 */
import 'server-only';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

const RETRY_DELAYS_MS = [30_000, 60_000, 90_000];

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error('APOLLO_API_KEY not configured');
  }
  return key;
}

export class ApolloRateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Apollo rate limit exhausted after retries (last delay ${retryAfterMs}ms)`);
    this.name = 'ApolloRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ApolloHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Apollo HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'ApolloHttpError';
    this.status = status;
    this.body = body;
  }
}

export interface ApolloPostOptions {
  /** Notified before each retry sleep so callers (SSE emitters) can inform clients. */
  onRateLimit?: (attempt: number, waitMs: number) => void;
  /** Hard timeout for any single attempt. Default 25_000ms. */
  perAttemptTimeoutMs?: number;
}

/**
 * POST a JSON body to an Apollo endpoint and return the parsed response.
 * Retries up to 3 times on HTTP 429 with exponential backoff (30s, 60s, 90s).
 */
export async function apolloPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  opts: ApolloPostOptions = {},
): Promise<T> {
  const url = `${APOLLO_BASE}${endpoint}`;
  const apiKey = getApiKey();
  const timeoutMs = opts.perAttemptTimeoutMs ?? 25_000;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     apiKey,
          'Cache-Control': 'no-cache',
          'Accept':        'application/json',
        },
        body:    JSON.stringify(body),
        signal:  controller.signal,
        cache:   'no-store',
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status !== 429) {
      if (!res.ok) {
        const text = await res.text();
        throw new ApolloHttpError(res.status, text);
      }
      return (await res.json()) as T;
    }

    if (attempt >= RETRY_DELAYS_MS.length) {
      throw new ApolloRateLimitError(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    }

    const waitMs = RETRY_DELAYS_MS[attempt];
    opts.onRateLimit?.(attempt + 1, waitMs);
    await sleep(waitMs);
  }

  throw new ApolloRateLimitError(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Boot-time guard: confirms APOLLO_API_KEY is server-side only.
 * Throws if anyone accidentally re-exposed it via NEXT_PUBLIC_.
 */
export function assertApolloKeyServerOnly(): void {
  if (process.env.NEXT_PUBLIC_APOLLO_API_KEY) {
    throw new Error('APOLLO_API_KEY must NOT be prefixed with NEXT_PUBLIC_');
  }
}
