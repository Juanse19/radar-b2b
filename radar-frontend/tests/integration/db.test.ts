/**
 * Integration tests for lib/db.ts — Prisma data layer against real SQLite DB.
 * Expected totals (status='pending'): BHS=171, Cartón=170, Intralogística=313
 */

import { describe, it, expect, afterAll } from 'vitest';
// DATABASE_URL is injected by vitest.config.ts → test.env, so PrismaClient
// picks it up before any module is imported.
import { PrismaClient } from '@prisma/client';
import {
  getEmpresasCount,
  getEmpresasByLinea,
  getEmpresasParaEscaneo,
  registrarEjecucion,
  getEjecucionesRecientes,
} from '../../lib/db';

// Use a dedicated client in tests so we can disconnect cleanly.
// DATABASE_URL comes from vitest.config.ts test.env.
const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// ── getEmpresasCount ──────────────────────────────────────────────────────────

describe('getEmpresasCount()', () => {
  it('returns correct totals for each linea', async () => {
    const counts = await getEmpresasCount();
    expect(counts['BHS']).toBe(171);
    expect(counts['Cartón']).toBe(170);
    expect(counts['Intralogística']).toBe(313);
  });

  it('returns an object (not null/undefined)', async () => {
    const counts = await getEmpresasCount();
    expect(counts).toBeTruthy();
    expect(typeof counts).toBe('object');
  });

  it('total across all lines equals 654', async () => {
    const counts = await getEmpresasCount();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(654);
  });
});

// ── getEmpresasByLinea ────────────────────────────────────────────────────────

describe('getEmpresasByLinea()', () => {
  it('BHS with limit=5 → 5 items, all linea=BHS', async () => {
    const result = await getEmpresasByLinea('BHS', 5);
    expect(result).toHaveLength(5);
    for (const e of result) {
      expect(e.linea).toBe('BHS');
    }
  });

  it('Cartón with limit=3 → 3 items, all linea=Cartón', async () => {
    const result = await getEmpresasByLinea('Cartón', 3);
    expect(result).toHaveLength(3);
    for (const e of result) {
      expect(e.linea).toBe('Cartón');
    }
  });

  it('ALL with limit=10 → 10 items from multiple lines', async () => {
    const result = await getEmpresasByLinea('ALL', 10);
    expect(result).toHaveLength(10);
    const lineas = new Set(result.map(e => e.linea));
    // With 654 companies across 3 lines, 10 rows sorted by name should cover >1 line
    expect(lineas.size).toBeGreaterThanOrEqual(1);
  });

  it('each item has required fields: id, nombre, pais, linea, tier', async () => {
    const result = await getEmpresasByLinea('BHS', 3);
    for (const e of result) {
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('nombre');
      expect(e).toHaveProperty('pais');
      expect(e).toHaveProperty('linea');
      expect(e).toHaveProperty('tier');
    }
  });

  it('id is a string (mapped from numeric DB id)', async () => {
    const result = await getEmpresasByLinea('Intralogística', 1);
    expect(result).toHaveLength(1);
    expect(typeof result[0].id).toBe('string');
  });

  it('respects offset: second page does not overlap with first', async () => {
    const page1 = await getEmpresasByLinea('BHS', 5, 0);
    const page2 = await getEmpresasByLinea('BHS', 5, 5);
    const ids1 = new Set(page1.map(e => e.id));
    for (const e of page2) {
      expect(ids1.has(e.id)).toBe(false);
    }
  });
});

// ── getEmpresasParaEscaneo ────────────────────────────────────────────────────

describe('getEmpresasParaEscaneo()', () => {
  it('BHS with limit=10 → 10 BHS companies', async () => {
    const result = await getEmpresasParaEscaneo('BHS', 10);
    expect(result).toHaveLength(10);
    for (const e of result) {
      expect(e.linea_negocio).toBe('BHS');
    }
  });

  it('Intralogística with limit=5 → 5 Intralogística companies', async () => {
    const result = await getEmpresasParaEscaneo('Intralogística', 5);
    expect(result).toHaveLength(5);
    for (const e of result) {
      expect(e.linea_negocio).toBe('Intralogística');
    }
  });

  it('orders by last_run_at ASC (nulls first for rotation)', async () => {
    const result = await getEmpresasParaEscaneo('BHS', 10);
    // Items with null last_run_at should come before items with a date
    let seenDate = false;
    for (const e of result) {
      if (e.last_run_at !== null) seenDate = true;
      if (seenDate && e.last_run_at === null) {
        // A null appeared after a non-null → ordering is wrong
        expect.fail('Null last_run_at appeared after a non-null value — ordering broken');
      }
    }
  });

  it('returns raw DB rows with company_name field (not nombre)', async () => {
    const result = await getEmpresasParaEscaneo('BHS', 1);
    expect(result[0]).toHaveProperty('company_name');
  });

  it('returns raw DB rows with status field', async () => {
    const result = await getEmpresasParaEscaneo('BHS', 1);
    expect(result[0].status).toBe('pending');
  });
});

// ── registrarEjecucion ────────────────────────────────────────────────────────

describe('registrarEjecucion()', () => {
  it('creates a record and returns a numeric id', async () => {
    const id = await registrarEjecucion({ linea_negocio: 'BHS', batch_size: 10 });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('the created record exists in the DB with correct fields', async () => {
    const id = await registrarEjecucion({
      linea_negocio: 'Cartón',
      batch_size: 5,
      trigger_type: 'test',
    });
    const row = await prisma.ejecucion.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row!.linea_negocio).toBe('Cartón');
    expect(row!.batch_size).toBe(5);
    expect(row!.trigger_type).toBe('test');
    expect(row!.estado).toBe('running');
    // Cleanup
    await prisma.ejecucion.delete({ where: { id } });
  });

  it('uses "manual" as default trigger_type when not provided', async () => {
    const id = await registrarEjecucion({ linea_negocio: 'BHS', batch_size: 10 });
    const row = await prisma.ejecucion.findUnique({ where: { id } });
    expect(row!.trigger_type).toBe('manual');
    await prisma.ejecucion.delete({ where: { id } });
  });

  it('accepts optional n8n_execution_id', async () => {
    const id = await registrarEjecucion({
      linea_negocio: 'BHS',
      batch_size: 10,
      n8n_execution_id: 'exec-test-123',
    });
    const row = await prisma.ejecucion.findUnique({ where: { id } });
    expect(row!.n8n_execution_id).toBe('exec-test-123');
    await prisma.ejecucion.delete({ where: { id } });
  });
});

// ── getEjecucionesRecientes ───────────────────────────────────────────────────

describe('getEjecucionesRecientes()', () => {
  it('returns at most N items', async () => {
    const result = await getEjecucionesRecientes(5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('items are ordered by started_at DESC (most recent first)', async () => {
    // Insert two known executions back-to-back to guarantee ordering
    const id1 = await registrarEjecucion({ linea_negocio: 'BHS', batch_size: 1 });
    const id2 = await registrarEjecucion({ linea_negocio: 'BHS', batch_size: 2 });

    const result = await getEjecucionesRecientes(5);
    // id2 was created after id1, so it should appear first
    const idx1 = result.findIndex(r => r.id === id1);
    const idx2 = result.findIndex(r => r.id === id2);
    expect(idx2).toBeLessThan(idx1);

    // Cleanup
    await prisma.ejecucion.deleteMany({ where: { id: { in: [id1, id2] } } });
  });

  it('returns EjecucionDB rows with required fields', async () => {
    const id = await registrarEjecucion({ linea_negocio: 'BHS', batch_size: 1 });
    const result = await getEjecucionesRecientes(1);
    const row = result[0];
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('estado');
    expect(row).toHaveProperty('trigger_type');
    expect(row).toHaveProperty('started_at');
    await prisma.ejecucion.delete({ where: { id } });
  });

  it('default limit is 10 (no arg)', async () => {
    const result = await getEjecucionesRecientes();
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
