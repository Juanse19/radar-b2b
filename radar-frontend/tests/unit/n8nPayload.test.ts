/**
 * Unit tests for lib/n8n.ts — payload construction logic.
 * Verifies that empresas are mapped correctly to the WF01 schema.
 * Network calls are mocked via vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the mapping logic indirectly via triggerScan's payload shape.
// Import the EmpresaPayload type for type safety.
import type { EmpresaPayload } from '../../lib/n8n';

// ── Helper: create a mock fetch that captures the request body ────────────────

function mockFetch(responseOverride?: object) {
  const captured: { body: unknown }[] = [];
  const mockFn = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    captured.push({ body });
    return {
      ok: true,
      status: 200,
      json: async () => responseOverride ?? { message: 'Workflow was started' },
      text: async () => JSON.stringify(responseOverride ?? {}),
    } as Response;
  });
  return { mockFn, captured };
}

// ── EmpresaPayload mapping ────────────────────────────────────────────────────

describe('triggerScan() — payload mapping', () => {
  let restoreFetch: () => void;

  beforeEach(() => {
    // No real network calls in tests
    const original = global.fetch;
    restoreFetch = () => { global.fetch = original; };
  });

  afterEach(() => {
    restoreFetch?.();
    vi.restoreAllMocks();
  });

  it('maps empresa.nombre → empresa field (not nombre)', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'BHS',
      batchSize: 1,
      empresas: [{ nombre: 'Aeropuerto El Dorado', pais: 'Colombia', linea: 'BHS' }],
    }).catch(() => {}); // ignore any follow-up errors

    const body = captured[0]?.body as { empresas: { empresa: string }[] };
    expect(body.empresas[0]).toHaveProperty('empresa', 'Aeropuerto El Dorado');
    expect(body.empresas[0]).not.toHaveProperty('nombre');
  });

  it('maps empresa.linea → linea_negocio field', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'BHS',
      batchSize: 1,
      empresas: [{ nombre: 'Test SA', linea: 'BHS' }],
    }).catch(() => {});

    const body = captured[0]?.body as { empresas: { linea_negocio: string }[] };
    expect(body.empresas[0]).toHaveProperty('linea_negocio', 'BHS');
  });

  it('defaults pais to Colombia when not provided', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'Cartón',
      batchSize: 1,
      empresas: [{ nombre: 'Papeles SA' }], // no pais
    }).catch(() => {});

    const body = captured[0]?.body as { empresas: { pais: string }[] };
    expect(body.empresas[0]).toHaveProperty('pais', 'Colombia');
  });

  it('defaults company_domain to empty string when dominio is null', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'BHS',
      batchSize: 1,
      empresas: [{ nombre: 'Test SA', dominio: null }],
    }).catch(() => {});

    const body = captured[0]?.body as { empresas: { company_domain: string }[] };
    expect(body.empresas[0]).toHaveProperty('company_domain', '');
  });

  it('includes trigger_type: "manual" in every payload', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'BHS',
      batchSize: 2,
      empresas: [
        { nombre: 'A', pais: 'Colombia' },
        { nombre: 'B', pais: 'Mexico' },
      ],
    }).catch(() => {});

    const body = captured[0]?.body as { trigger_type: string; empresas: object[] };
    expect(body.trigger_type).toBe('manual');
    expect(body.empresas).toHaveLength(2);
  });

  it('falls back to empresasEspecificas when empresas array not provided', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({
      linea: 'BHS',
      batchSize: 2,
      empresasEspecificas: ['Empresa A', 'Empresa B'],
    }).catch(() => {});

    const body = captured[0]?.body as { empresas: { empresa: string; linea_negocio: string }[] };
    expect(body.empresas).toHaveLength(2);
    expect(body.empresas[0]).toHaveProperty('empresa', 'Empresa A');
    expect(body.empresas[0]).toHaveProperty('linea_negocio', 'BHS');
  });
});

// ── Payload shape validation ──────────────────────────────────────────────────

describe('EmpresaPayload mapping — edge cases', () => {
  it('empty empresas array sends empty empresas[] to webhook', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({ linea: 'BHS', batchSize: 0, empresas: [] }).catch(() => {});

    const body = captured[0]?.body as { empresas: unknown[] };
    expect(Array.isArray(body.empresas)).toBe(true);
    expect(body.empresas).toHaveLength(0);
  });

  it('multiple empresas are all mapped correctly', async () => {
    const { mockFn, captured } = mockFetch();
    vi.stubGlobal('fetch', mockFn);

    const inputEmpresas: EmpresaPayload[] = [
      { nombre: 'LATAM Airlines', pais: 'Chile',    linea: 'BHS', dominio: 'latam.com' },
      { nombre: 'Avianca',        pais: 'Colombia', linea: 'BHS', dominio: 'avianca.com' },
    ];

    const { triggerScan } = await import('../../lib/n8n');
    await triggerScan({ linea: 'BHS', batchSize: 2, empresas: inputEmpresas }).catch(() => {});

    const body = captured[0]?.body as {
      empresas: { empresa: string; pais: string; linea_negocio: string; company_domain: string }[];
    };

    expect(body.empresas[0]).toMatchObject({
      empresa:        'LATAM Airlines',
      pais:           'Chile',
      linea_negocio:  'BHS',
      company_domain: 'latam.com',
    });
    expect(body.empresas[1]).toMatchObject({
      empresa:        'Avianca',
      pais:           'Colombia',
      linea_negocio:  'BHS',
      company_domain: 'avianca.com',
    });
  });
});
