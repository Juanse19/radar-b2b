/**
 * Data-quality / validation tests for the empresas table.
 * Verifies referential integrity and expected shape of every row.
 */

import { describe, it, expect, afterAll } from 'vitest';
// DATABASE_URL is injected by vitest.config.ts → test.env
import { PrismaClient } from '@prisma/client';

// DATABASE_URL comes from vitest.config.ts test.env
const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const VALID_LINEAS = new Set(['BHS', 'Cartón', 'Intralogística']);

// ── Data quality ──────────────────────────────────────────────────────────────

describe('DB data quality — empresas table', () => {
  it('total row count is 654', async () => {
    const total = await prisma.empresa.count();
    expect(total).toBe(654);
  });

  it('all 654 companies have a non-null, non-empty company_name', async () => {
    const bad = await prisma.empresa.findMany({
      where: {
        OR: [
          { company_name: { equals: '' } },
        ],
      },
      select: { id: true, company_name: true },
    });
    // Prisma schema has company_name as required String (no ?) so nulls are impossible;
    // we check for empties.
    expect(bad).toHaveLength(0);
  });

  it('all companies have a valid linea_negocio (BHS | Cartón | Intralogística)', async () => {
    const all = await prisma.empresa.findMany({
      select: { id: true, linea_negocio: true },
    });
    const invalid = all.filter(e => !VALID_LINEAS.has(e.linea_negocio));
    expect(invalid).toHaveLength(0);
  });

  it('no company has null linea_negocio', async () => {
    // The Prisma schema marks linea_negocio as non-optional String,
    // but we run the raw query check for belt-and-suspenders assurance.
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
    const count = await prisma.empresa.count({
      where: { linea_negocio: 'BHS' },
    });
    expect(count).toBe(171);
  });

  it('Cartón count is 170', async () => {
    const count = await prisma.empresa.count({
      where: { linea_negocio: 'Cartón' },
    });
    expect(count).toBe(170);
  });

  it('Intralogística count is 313', async () => {
    const count = await prisma.empresa.count({
      where: { linea_negocio: 'Intralogística' },
    });
    expect(count).toBe(313);
  });

  it('all companies have a non-empty tier', async () => {
    const badTier = await prisma.empresa.findMany({
      where: { tier: '' },
      select: { id: true, tier: true },
    });
    expect(badTier).toHaveLength(0);
  });

  it('ids are unique (auto-increment guarantees, sanity check)', async () => {
    const all = await prisma.empresa.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const ids = all.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('schema linea values exactly match the three expected lines', async () => {
    const counts = await prisma.empresa.groupBy({
      by: ['linea_negocio'],
      _count: { linea_negocio: true },
    });
    const keys = counts.map(r => r.linea_negocio).sort();
    expect(keys).toEqual(['BHS', 'Cartón', 'Intralogística'].sort());
  });
});
