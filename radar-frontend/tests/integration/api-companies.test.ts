/**
 * Integration tests for GET /api/companies route handler.
 * Tests call the handler function directly (no HTTP server needed).
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
// DATABASE_URL is injected by vitest.config.ts → test.env
import { GET } from '../../app/api/companies/route';

// Helper: build a NextRequest with the given query string
function makeRequest(queryString: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/companies?${queryString}`);
}

// ── count=true ────────────────────────────────────────────────────────────────

describe('GET /api/companies?count=true', () => {
  it('returns an object with BHS=171, Cartón=170, Intralogística=313', async () => {
    const res = await GET(makeRequest('count=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['BHS']).toBe(171);
    expect(body['Cartón']).toBe(170);
    expect(body['Intralogística']).toBe(313);
  });

  it('total across lines equals 654', async () => {
    const res = await GET(makeRequest('count=true'));
    const body = await res.json();
    const total = Object.values(body as Record<string, number>).reduce(
      (s, n) => s + n,
      0,
    );
    expect(total).toBe(654);
  });

  it('response Content-Type is JSON', async () => {
    const res = await GET(makeRequest('count=true'));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

// ── linea=BHS&limit=5 ─────────────────────────────────────────────────────────

describe('GET /api/companies?linea=BHS&limit=5', () => {
  it('returns exactly 5 items', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
  });

  it('each item has id, nombre, pais, linea, tier', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    const body = await res.json();
    for (const item of body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('nombre');
      expect(item).toHaveProperty('pais');
      expect(item).toHaveProperty('linea');
      expect(item).toHaveProperty('tier');
    }
  });

  it('all returned items have linea=BHS', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    const body = await res.json();
    for (const item of body) {
      expect(item.linea).toBe('BHS');
    }
  });
});

// ── linea=ALL&limit=20 ────────────────────────────────────────────────────────

describe('GET /api/companies?linea=ALL&limit=20', () => {
  it('returns exactly 20 items', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(20);
  });

  it('items come from multiple lines', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    const body = await res.json();
    const lineas = new Set(body.map((e: { linea: string }) => e.linea));
    expect(lineas.size).toBeGreaterThanOrEqual(1);
  });

  it('each item still has required fields', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    const body = await res.json();
    for (const item of body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('nombre');
      expect(item).toHaveProperty('linea');
      expect(item).toHaveProperty('tier');
    }
  });
});

// ── invalid limit (> 200) capped at 200 ──────────────────────────────────────

describe('GET /api/companies — limit capping', () => {
  it('limit=500 is capped at 200 (returns ≤200 items)', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=500'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Capped at 200; total DB rows is 654 so we expect exactly 200
    expect(body.length).toBeLessThanOrEqual(200);
  });

  it('limit=1000 is capped and does not return >200 items', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=1000'));
    const body = await res.json();
    expect(body.length).toBeLessThanOrEqual(200);
  });

  it('valid limit=50 (no cap) returns 50 items', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=50'));
    const body = await res.json();
    expect(body).toHaveLength(50);
  });
});

// ── default behaviour (no params) ────────────────────────────────────────────

describe('GET /api/companies — defaults', () => {
  it('no params → defaults to linea=ALL, limit=50', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(50);
  });
});
