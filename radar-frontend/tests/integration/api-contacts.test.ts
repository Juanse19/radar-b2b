// tests/integration/api-contacts.test.ts
// GET y POST /api/contacts — mapeo a campos en español (ContactoRow)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetContactos, mockGetContactosCount, mockCrearContacto, mockGetCurrentSession,
} = vi.hoisted(() => ({
  mockGetContactos:      vi.fn(),
  mockGetContactosCount: vi.fn(),
  mockCrearContacto:     vi.fn(),
  mockGetCurrentSession: vi.fn(),
}));

vi.mock('@/lib/contacts', () => ({
  getContactos:      mockGetContactos,
  getContactosCount: mockGetContactosCount,
  crearContacto:     mockCrearContacto,
}));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession: mockGetCurrentSession }));

import { GET, POST } from '../../app/api/contacts/route';

const SESSION_ADMIN = {
  userId: 'u-1', email: 'admin@matec.com', name: 'Admin',
  role: 'ADMIN' as const, accessState: 'ACTIVO' as const,
};

function makeContacto(overrides = {}) {
  return {
    id: 1, empresa_id: 42,
    nombre: 'Juan Pérez', cargo: 'Director de Operaciones',
    email: 'juan@bimbo.com', telefono: '+52-55-1234',
    linkedin_url: 'https://linkedin.com/in/juanperez',
    empresa_nombre: 'Grupo Bimbo', linea_negocio: 'Final de Línea',
    fuente: 'apollo', hubspot_status: 'pending',
    hubspot_id: null, apollo_id: 'apo-123',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

const makeGet = (q = '') => new NextRequest(`http://localhost:3000/api/contacts?${q}`);
const makePost = (body: object) =>
  new NextRequest('http://localhost:3000/api/contacts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin sesión → 401', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null);
    expect((await GET(makeGet())).status).toBe(401);
  });

  it('retorna contactos con campos en español', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(SESSION_ADMIN);
    mockGetContactos.mockResolvedValueOnce([makeContacto()]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const [c] = await res.json();
    expect(c).toMatchObject({
      nombre: 'Juan Pérez', cargo: 'Director de Operaciones',
      email: 'juan@bimbo.com', telefono: '+52-55-1234',
      empresaNombre: 'Grupo Bimbo', fuente: 'apollo',
    });
  });

  it('?count=true → retorna { total: N }', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(SESSION_ADMIN);
    mockGetContactosCount.mockResolvedValueOnce(247);
    const res = await GET(makeGet('count=true'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 247 });
    expect(mockGetContactos).not.toHaveBeenCalled();
  });

  it('limit=9999 → se clampea a 500', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(SESSION_ADMIN);
    mockGetContactos.mockResolvedValueOnce([]);
    await GET(makeGet('limit=9999'));
    expect(mockGetContactos).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });
});

describe('POST /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin sesión → 401', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null);
    expect((await POST(makePost({ empresa_id: 1 }))).status).toBe(401);
  });

  it('rol AUXILIAR → 403', async () => {
    mockGetCurrentSession.mockResolvedValueOnce({ ...SESSION_ADMIN, role: 'AUXILIAR' });
    expect((await POST(makePost({ empresa_id: 1 }))).status).toBe(403);
  });

  it('sin empresa_id → 400', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(SESSION_ADMIN);
    expect((await POST(makePost({ nombre: 'María' }))).status).toBe(400);
  });

  it('happy path → 201', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(SESSION_ADMIN);
    mockCrearContacto.mockResolvedValueOnce(makeContacto({ id: 55 }));
    const res = await POST(makePost({ empresa_id: 42, nombre: 'Juan Pérez' }));
    expect(res.status).toBe(201);
  });
});
