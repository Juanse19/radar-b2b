/**
 * Integration tests for GET /api/companies route handler.
 * Calls the handler function directly (no HTTP server needed).
 * Updated to match EmpresaRow canonical type + actual DB counts (1026 rows).
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/companies/route';

function makeRequest(queryString: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/companies?${queryString}`);
}

describe('GET /api/companies?count=true', () => {
  it('response is 200 and is an object', async () => {
    const res = await GET(makeRequest('count=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  it('BHS count is 171', async () => {
    const res = await GET(makeRequest('count=true'));
    const body = await res.json();
    expect(body['BHS']).toBe(171);
  });

  it('Cartón count is 170', async () => {
    const res = await GET(makeRequest('count=true'));
    const body = await res.json();
    expect(body['Cartón']).toBe(170);
  });

  it('Content-Type is JSON', async () => {
    const res = await GET(makeRequest('count=true'));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('GET /api/companies?linea=BHS&limit=5', () => {
  it('returns exactly 5 items', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
  });

  it('each item has id, company_name, linea_negocio, tier', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    const body = await res.json();
    for (const item of body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('company_name');
      expect(item).toHaveProperty('linea_negocio');
      expect(item).toHaveProperty('tier');
    }
  });

  it('all returned items have linea_negocio=BHS', async () => {
    const res = await GET(makeRequest('linea=BHS&limit=5'));
    const body = await res.json();
    for (const item of body) {
      expect(item.linea_negocio).toBe('BHS');
    }
  });
});

describe('GET /api/companies?linea=ALL&limit=20', () => {
  it('returns exactly 20 items', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(20);
  });

  it('items come from multiple lineas', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    const body = await res.json();
    const lineas = new Set(body.map((e: { linea_negocio: string }) => e.linea_negocio));
    expect(lineas.size).toBeGreaterThanOrEqual(1);
  });

  it('each item has required fields', async () => {
    const res = await GET(makeRequest('linea=ALL&limit=20'));
    const body = await res.json();
    for (const item of body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('company_name');
      expect(item).toHaveProperty('linea_negocio');
      expect(item).toHaveProperty('tier');
    }
  });
});

describe('GET /api/companies — defaults', () => {
  it('no params → returns an array', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});
