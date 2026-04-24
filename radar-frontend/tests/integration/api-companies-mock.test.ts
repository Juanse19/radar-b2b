// tests/integration/api-companies-mock.test.ts
// GET /api/companies — con mocks (sin Supabase real)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetEmpresasByLinea = vi.fn();
const mockGetEmpresasCount   = vi.fn();
const mockGetCurrentSession  = vi.fn();

vi.mock('@/lib/db', () => ({
  getEmpresasByLinea: mockGetEmpresasByLinea,
  getEmpresasCount:   mockGetEmpresasCount,
}));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession: mockGetCurrentSession }));

import { GET } from '../../app/api/companies/route';

const SESSION = {
  userId: 'u-1', email: 'admin@matec.com', name: 'Admin',
  role: 'ADMIN' as const, accessState: 'ACTIVO' as const,
};

function makeEmpresa(overrides = {}) {
  return {
    id: 1, company_name: 'Grupo Bimbo', pais: 'Mexico',
    linea_negocio: 'Final de Línea', tier: 'ORO',
    company_domain: 'grupobimbo.com', score_calificacion: 9,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const makeGet = (q = '') =>
  new NextRequest(`http://localhost:3000/api/companies?${q}`);

describe('GET /api/companies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentSession.mockResolvedValue(SESSION);
  });

  it('sin sesión → 401', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('retorna lista de empresas', async () => {
    mockGetEmpresasByLinea.mockResolvedValueOnce([makeEmpresa()]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('company_name', 'Grupo Bimbo');
  });

  it('?linea=BHS → filtra por línea', async () => {
    mockGetEmpresasByLinea.mockResolvedValueOnce([]);
    await GET(makeGet('linea=BHS'));
    expect(mockGetEmpresasByLinea).toHaveBeenCalledWith(
      expect.stringContaining('BHS'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('?count=true → retorna { total }', async () => {
    mockGetEmpresasCount.mockResolvedValueOnce(829);
    const res = await GET(makeGet('count=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total', 829);
  });
});
