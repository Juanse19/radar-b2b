/**
 * Data-quality / validation tests for the empresas table.
 * Verifies referential integrity and expected shape of every row.
 *
 * NOTE: DB has been expanded to 6 business lines.
 * Known data issue: 186 rows have 'Intralogistica' (missing tilde) — tracked as Bug D.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// All lineas that are currently in the DB (including the typo variant)
const EXPECTED_LINEAS = new Set([
  'BHS',
  'Cartón',
  'Intralogística',
  'Intralogistica',   // ← data quality issue (missing tilde); 186 rows
]);

describe('DB data quality — empresas table', () => {
  it('total row count is 1026', async () => {
    const total = await prisma.empresa.count();
    expect(total).toBe(1026);
  });

  it('all companies have a non-empty company_name', async () => {
    const bad = await prisma.empresa.findMany({
      where: { company_name: { equals: '' } },
      select: { id: true, company_name: true },
    });
    expect(bad).toHaveLength(0);
  });

  it('all companies have a known linea_negocio', async () => {
    const all = await prisma.empresa.findMany({
      select: { id: true, linea_negocio: true },
    });
    const invalid = all.filter(e => !EXPECTED_LINEAS.has(e.linea_negocio));
    expect(invalid).toHaveLength(0);
  });

  it('no company has null linea_negocio', async () => {
    const all = await prisma.empresa.findMany({
      select: { id: true, linea_negocio: true },
    });
    const nulls = all.filter(e => e.linea_negocio === null || e.linea_negocio === undefined);
    expect(nulls).toHaveLength(0);
  });

  it('all companies have status="pending"', async () => {
    const nonPending = await prisma.empresa.findMany({
      where: { status: { not: 'pending' } },
      select: { id: true, status: true },
    });
    expect(nonPending).toHaveLength(0);
  });

  it('BHS count is 171', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'BHS' } });
    expect(count).toBe(171);
  });

  it('Cartón count is 170', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'Cartón' } });
    expect(count).toBe(170);
  });

  it('Intralogística (with tilde) count is 499', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'Intralogística' } });
    expect(count).toBe(499);
  });

  it('[DATA ISSUE] Intralogistica (without tilde) — 186 rows with typo', async () => {
    const count = await prisma.empresa.count({ where: { linea_negocio: 'Intralogistica' } });
    // These rows exist due to a data import issue. They should be normalized to 'Intralogística'.
    // Track this as a migration task before going to Supabase.
    expect(count).toBe(186);
  });

  it('all companies have a non-empty tier', async () => {
    const badTier = await prisma.empresa.findMany({
      where: { tier: '' },
      select: { id: true, tier: true },
    });
    expect(badTier).toHaveLength(0);
  });

  it('ids are unique', async () => {
    const all = await prisma.empresa.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const ids = all.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('linea values in schema exactly match expected set', async () => {
    const counts = await prisma.empresa.groupBy({
      by: ['linea_negocio'],
      _count: { linea_negocio: true },
    });
    const keys = new Set(counts.map(r => r.linea_negocio));
    expect(keys).toEqual(EXPECTED_LINEAS);
  });
});
