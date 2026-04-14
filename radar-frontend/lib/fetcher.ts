// lib/fetcher.ts
// Single resilient fetch helper used by all client-side queries.
//
// Why this exists:
//   When a Next.js API route returns 500, the body is an HTML error page, not
//   JSON. Calling `res.json()` on that throws SyntaxError, which escapes the
//   React Query boundary and crashes the page. We also want structured
//   `ApiError`s so UI layers can decide whether to show a toast or silently
//   fall back.
//
// Usage:
//   const data = await fetchJson<Senal[]>('/api/signals');            // plain
//   const safe = await fetchJsonSafe<Senal[]>('/api/signals', []);    // never throws

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetches JSON from a URL with proper error handling.
 * Throws `ApiError` on non-2xx responses or invalid JSON bodies.
 *
 * Use with React Query — the error will be captured in `query.error`
 * and kept out of the error boundary (as long as `throwOnError: false`).
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // Network failure, CORS, offline, etc.
    throw new ApiError(
      0,
      url,
      err instanceof Error ? err.message : 'Network error',
    );
  }

  if (!res.ok) {
    // Try to read a message from the body but never let it crash us.
    let detail = '';
    try {
      const text = await res.text();
      // If the body looks like JSON, extract `.error`; otherwise take a short snippet.
      if (text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          detail = parsed.error ?? parsed.message ?? '';
        } catch {
          detail = text.slice(0, 120);
        }
      } else if (text) {
        detail = text.slice(0, 120);
      }
    } catch {
      // swallow — we already know the status
    }
    throw new ApiError(
      res.status,
      url,
      `${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, url, 'Respuesta no es JSON válido');
  }
}

/**
 * Like `fetchJson` but never throws — returns `fallback` on any error.
 * Useful when a failure shouldn't block the UI (e.g., stats widgets).
 */
export async function fetchJsonSafe<T>(
  url: string,
  fallback: T,
  init?: RequestInit,
): Promise<T> {
  try {
    return await fetchJson<T>(url, init);
  } catch {
    return fallback;
  }
}
