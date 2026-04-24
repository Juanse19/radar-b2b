// tests/integration/api-signals.test.ts
// GET y POST /api/signals — verifica mapeo de campos y nombre correcto crearSenal

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted() ejecuta antes del hoisting de vi.mock, permitiendo refs a mocks
const { mockGetSenales, mockCrearSenal, mockGetResults, mockGetScoreTier } = vi.hoisted(() => ({
  mockGetSenales:   vi.fn(),
  mockCrearSenal:   vi.fn(),
  mockGetResults:   vi.fn(),
  mockGetScoreTier: vi.fn((s: number) => (s >= 8 ? 'ORO' : s >= 5 ? 'Monitoreo' : 'Contexto')),
}));

vi.mock('@/lib/db', () => ({ getSenales: mockGetSenales, crearSenal: mockCrearSenal }));
vi.mock('@/lib/sheets', () => ({ getResults: mockGetResults }));
vi.mock('@/components/ScoreBadge', () => ({ getScoreTier: mockGetScoreTier }));

import { GET, POST } from '../../app/api/signals/route';

function makeSenalRow(overrides = {}) {
  return {
    id: 1, empresa_id: 42, ejecucion_id: null,
    empresa_nombre: 'Grupo Bimbo', empresa_pais: 'Mexico',
    linea_negocio: 'Final de Línea', tier: 'ORO',
    radar_activo: true, tipo_senal: 'Expansión de planta',
    descripcion: 'Apertura de nueva línea de producción en Monterrey',
    fuente: null, fuente_url: null, score_radar: 9,
    ventana_compra: '0-3 meses', prioridad_comercial: 'ALTA',
    motivo_descarte: null, ticket_estimado: null,
    razonamiento_agente: 'Score alto',
    created_at: new Date('2026-04-01').toISOString(),
    ...overrides,
  };
}

const makeGet = (q = '') => new NextRequest(`http://localhost:3000/api/signals?${q}`);
const makePost = (body: object) =>
  new NextRequest('http://localhost:3000/api/signals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/signals', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetResults.mockResolvedValue([]); });

  it('retorna señales mapeadas correctamente desde la BD', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRow()]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const [s] = await res.json();
    expect(s).toMatchObject({
      id: 1, scoreRadar: 9,
      tipoSenal: 'Expansión de planta',
      radarActivo: 'Sí', tier: 'ORO',
      descripcion: 'Apertura de nueva línea de producción en Monterrey',
    });
  });

  it('tier=ORO → pasa scoreGte=8 a getSenales', async () => {
    mockGetSenales.mockResolvedValueOnce([]);
    await GET(makeGet('tier=ORO'));
    expect(mockGetSenales).toHaveBeenCalledWith(expect.objectContaining({ scoreGte: 8 }));
  });

  it('tier=Monitoreo → pasa scoreGte=5, scoreLt=8', async () => {
    mockGetSenales.mockResolvedValueOnce([]);
    await GET(makeGet('tier=Monitoreo'));
    expect(mockGetSenales).toHaveBeenCalledWith(
      expect.objectContaining({ scoreGte: 5, scoreLt: 8 }),
    );
  });

  it('limit=9999 → se clampea a 500', async () => {
    mockGetSenales.mockResolvedValueOnce([]);
    await GET(makeGet('limit=9999'));
    expect(mockGetSenales).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });

  it('BD vacía → hace fallback a getResults de sheets', async () => {
    mockGetSenales.mockResolvedValueOnce([]);
    mockGetResults.mockResolvedValueOnce([{ scoreRadar: 9, empresa: 'Nutresa' }]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(mockGetResults).toHaveBeenCalled();
  });
});

describe('POST /api/signals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea señal y retorna 201', async () => {
    mockCrearSenal.mockResolvedValueOnce({ id: 10, score_radar: 8 });
    const res = await POST(makePost({
      empresa_nombre: 'Nutresa', linea_negocio: 'Final de Línea',
      radar_activo: true, score_radar: 8,
    }));
    expect(res.status).toBe(201);
    expect(mockCrearSenal).toHaveBeenCalled();
  });

  it('error DB → 500 con mensaje', async () => {
    mockCrearSenal.mockRejectedValueOnce(new Error('pgQuery HTTP 500'));
    const res = await POST(makePost({ empresa_nombre: 'Test', linea_negocio: 'BHS' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toHaveProperty('error');
  });
});
