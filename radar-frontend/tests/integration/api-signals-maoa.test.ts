// tests/integration/api-signals-maoa.test.ts
// Verifies that GET /api/signals maps MAOA fields correctly in the response.
//
// The route handler (app/api/signals/route.ts) casts DB rows to SenalRowExtended
// which adds optional MAOA columns returned by migration 010. This test confirms:
//   • All MAOA fields present in the response when populated in the DB row
//   • Fields degrade gracefully (undefined) when absent in the DB row
//   • radarActivo is "Sí" or "No" (never the raw boolean)
//   • ventanaCompra is present as a string field

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted() runs before vi.mock() hoisting — ensures mock refs are stable
const {
  mockGetSenales,
  mockCrearSenal,
  mockGetResults,
  mockGetScoreTier,
} = vi.hoisted(() => ({
  mockGetSenales:   vi.fn(),
  mockCrearSenal:   vi.fn(),
  mockGetResults:   vi.fn(),
  mockGetScoreTier: vi.fn((s: number) => (s >= 8 ? 'ORO' : s >= 5 ? 'Monitoreo' : 'Contexto')),
}));

vi.mock('@/lib/db',     () => ({ getSenales: mockGetSenales, crearSenal: mockCrearSenal }));
vi.mock('@/lib/sheets', () => ({ getResults: mockGetResults }));
vi.mock('@/components/ScoreBadge', () => ({ getScoreTier: mockGetScoreTier }));

import { GET } from '../../app/api/signals/route';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A minimal SenalRow that satisfies the required columns.
 * MAOA fields (convergencia_maoa etc.) are optional — caller can add them.
 */
function makeSenalRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                  1,
    empresa_id:          10,
    ejecucion_id:        null,
    empresa_nombre:      'DHL Express',
    empresa_pais:        'Mexico',
    linea_negocio:       'Intralogística',
    tier:                'ORO',
    radar_activo:        true,
    tipo_senal:          'Expansión CEDI',
    descripcion:         'Apertura de nuevo centro de distribución en Monterrey',
    fuente:              'Licitación pública IMSS',
    fuente_url:          'https://compranet.gob.mx/123',
    score_radar:         9,
    ventana_compra:      '0-6 Meses',
    prioridad_comercial: 'ALTA',
    motivo_descarte:     null,
    ticket_estimado:     null,
    razonamiento_agente: 'Score alto por fuente oficial + CAPEX',
    created_at:          new Date('2026-04-01').toISOString(),
    ...overrides,
  };
}

/** SenalRow with all MAOA extended fields populated (post migration 010). */
function makeSenalRowWithMaoa(overrides: Record<string, unknown> = {}) {
  return makeSenalRow({
    convergencia_maoa:    'Pendiente',
    accion_recomendada:   'MONITOREO ACTIVO',
    tier_score:           8.625,
    tier_clasificacion:   'A',
    tir_score:            7.625,
    tir_clasificacion:    'B',
    score_final_maoa:     8.125,
    criterios_cumplidos:  ['Fuente oficial', 'CAPEX declarado', 'Horizonte ≤12m'],
    total_criterios:      3,
    monto_inversion:      'USD 12M',
    fecha_senal:          '2026-04-01',
    evaluacion_temporal:  'En horizonte',
    observaciones_maoa:   'Empresa en lista prioritaria BHS',
    empresa_o_proyecto:   'DHL Express CEDI Monterrey',
    company_domain:       'dhl.com',
    ...overrides,
  });
}

const makeGet = (q = '') =>
  new NextRequest(`http://localhost:3000/api/signals?${q}`);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/signals — MAOA field mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResults.mockResolvedValue([]);
  });

  it('maps tipoSenal from tipo_senal DB column', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRow()]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const [s] = await res.json();
    expect(s).toHaveProperty('tipoSenal', 'Expansión CEDI');
  });

  it('maps radarActivo to "Sí" when radar_activo is true', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRow({ radar_activo: true })]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.radarActivo).toBe('Sí');
  });

  it('maps radarActivo to "No" when radar_activo is false', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRow({ radar_activo: false })]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.radarActivo).toBe('No');
  });

  it('maps ventanaCompra from ventana_compra DB column', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRow({ ventana_compra: '6-12 Meses' })]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.ventanaCompra).toBe('6-12 Meses');
  });

  it('maps convergenciaMaoa from convergencia_maoa when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(s).toHaveProperty('convergenciaMaoa', 'Pendiente');
  });

  it('maps accionRecomendada from accion_recomendada when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(s).toHaveProperty('accionRecomendada', 'MONITOREO ACTIVO');
  });

  it('maps scoreFinalMaoa from score_final_maoa when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(typeof s.scoreFinalMaoa).toBe('number');
    expect(s.scoreFinalMaoa).toBeCloseTo(8.125, 3);
  });

  it('maps tierClasificacion from tier_clasificacion when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(s).toHaveProperty('tierClasificacion', 'A');
  });

  it('maps tirClasificacion from tir_clasificacion when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(s).toHaveProperty('tirClasificacion', 'B');
  });

  it('maps criteriosCumplidos as string[] when present', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();
    expect(Array.isArray(s.criteriosCumplidos)).toBe(true);
    expect(s.criteriosCumplidos).toEqual(['Fuente oficial', 'CAPEX declarado', 'Horizonte ≤12m']);
  });

  it('all MAOA fields undefined/omitted when DB row has no MAOA columns', async () => {
    // A plain row without any MAOA extended fields
    mockGetSenales.mockResolvedValueOnce([makeSenalRow()]);
    const [s] = await (await GET(makeGet())).json();

    // The route uses `?? undefined` which serialises to omission in JSON
    expect(s.convergenciaMaoa).toBeUndefined();
    expect(s.accionRecomendada).toBeUndefined();
    expect(s.scoreFinalMaoa).toBeUndefined();
    expect(s.tierClasificacion).toBeUndefined();
    expect(s.tirClasificacion).toBeUndefined();
    expect(s.criteriosCumplidos).toBeUndefined();
  });

  it('full MAOA response shape for a DHL row matches expected object', async () => {
    mockGetSenales.mockResolvedValueOnce([makeSenalRowWithMaoa()]);
    const [s] = await (await GET(makeGet())).json();

    expect(s).toMatchObject({
      // Core fields
      empresa:            'DHL Express',
      pais:               'Mexico',
      linea:              'Intralogística',
      tier:               'ORO',
      radarActivo:        'Sí',
      tipoSenal:          'Expansión CEDI',
      ventanaCompra:      '0-6 Meses',
      // MAOA fields
      convergenciaMaoa:   'Pendiente',
      accionRecomendada:  'MONITOREO ACTIVO',
      scoreFinalMaoa:     8.125,
      tierClasificacion:  'A',
      tirClasificacion:   'B',
      criteriosCumplidos: ['Fuente oficial', 'CAPEX declarado', 'Horizonte ≤12m'],
    });
  });

  it('convergenciaMaoa="Verificada" maps correctly', async () => {
    mockGetSenales.mockResolvedValueOnce([
      makeSenalRowWithMaoa({
        convergencia_maoa:  'Verificada',
        accion_recomendada: 'ABM ACTIVADO',
        tier_clasificacion: 'A',
        tir_clasificacion:  'A',
        score_final_maoa:   9.0,
      }),
    ]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.convergenciaMaoa).toBe('Verificada');
    expect(s.accionRecomendada).toBe('ABM ACTIVADO');
    expect(s.tierClasificacion).toBe('A');
    expect(s.tirClasificacion).toBe('A');
    expect(s.scoreFinalMaoa).toBeCloseTo(9.0, 3);
  });

  it('convergenciaMaoa="Sin convergencia" maps to ARCHIVAR action', async () => {
    mockGetSenales.mockResolvedValueOnce([
      makeSenalRowWithMaoa({
        convergencia_maoa:  'Sin convergencia',
        accion_recomendada: 'ARCHIVAR',
        tier_clasificacion: 'C',
        tir_clasificacion:  'C',
        score_final_maoa:   2.5,
      }),
    ]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.convergenciaMaoa).toBe('Sin convergencia');
    expect(s.accionRecomendada).toBe('ARCHIVAR');
    expect(s.scoreFinalMaoa).toBeCloseTo(2.5, 3);
  });

  it('null criterios_cumplidos in DB → criteriosCumplidos undefined in response', async () => {
    mockGetSenales.mockResolvedValueOnce([
      makeSenalRowWithMaoa({ criterios_cumplidos: null }),
    ]);
    const [s] = await (await GET(makeGet())).json();
    expect(s.criteriosCumplidos).toBeUndefined();
  });
});
