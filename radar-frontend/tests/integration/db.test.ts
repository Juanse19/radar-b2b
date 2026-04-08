/**
 * Integration tests for lib/db — data layer against real SQLite DB.
 * Uses EmpresaRow canonical type: id:number, company_name, linea_negocio.
 *
 * DB state (Apr 2026): 1026 rows total.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getEmpresasByLinea } from '../../lib/db';
import type { EmpresaRow } from '../../lib/db/types';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('getEmpresasByLinea()', () => {
  it('BHS with limit=5 — all have linea_negocio=BHS', async () => {
    const result = await getEmpresasByLinea('BHS', 5);
    expect(result).toHaveLength(5);
    for (const e of result as EmpresaRow[]) {
      expect(e.linea_negocio).toBe('BHS');
    }
  });

  it('Cartón with limit=3 — all have linea_negocio=Cartón', async () => {
    const result = await getEmpresasByLinea('Cartón', 3);
    expect(result).toHaveLength(3);
    for (const e of result as EmpresaRow[]) {
      expect(e.linea_negocio).toBe('Cartón');
    }
  });

  it('ALL with limit=10 returns 10 items', async () => {
    const result = await getEmpresasByLinea('ALL', 10);
    expect(result).toHaveLength(10);
  });

  it('each item has EmpresaRow fields: id, company_name, linea_negocio, tier, status', async () => {
    const result = await getEmpresasByLinea('BHS', 3);
    for (const e of result as EmpresaRow[]) {
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('company_name');
      expect(e).toHaveProperty('linea_negocio');
      expect(e).toHaveProperty('tier');
      expect(e).toHaveProperty('status');
    }
  });

  it('id is a number (not string)', async () => {
    const result = await getEmpresasByLinea('BHS', 1);
    expect(typeof (result[0] as EmpresaRow).id).toBe('number');
  });

  it('page 2 does not overlap with page 1', async () => {
    const page1 = await getEmpresasByLinea('BHS', 5, 0);
    const page2 = await getEmpresasByLinea('BHS', 5, 5);
    const ids1 = new Set((page1 as EmpresaRow[]).map(e => e.id));
    for (const e of page2 as EmpresaRow[]) {
      expect(ids1.has(e.id)).toBe(false);
    }
  });

  it('ALL returns companies from at least 2 lineas', async () => {
    const result = await getEmpresasByLinea('ALL', 50);
    const lineas = new Set((result as EmpresaRow[]).map(e => e.linea_negocio));
    expect(lineas.size).toBeGreaterThanOrEqual(2);
  });
});

describe('DB linea counts', () => {
  it('BHS has 171 entries', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'BHS' } });
    expect(count).toBe(171);
  });

  it('Cartón has 170 entries', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'Cartón' } });
    expect(count).toBe(170);
  });

  it('total rows is 1026', async () => {
    const count = await prisma.empresa.count();
    expect(count).toBe(1026);
  });
});
