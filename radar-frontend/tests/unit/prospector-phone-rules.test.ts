/**
 * Unit tests para lib/prospector/phone-rules.ts
 *
 * Matriz nivel × tier para la decisión automática de revelar teléfono.
 */
import { describe, it, expect } from 'vitest';
import { needsPhone, creditCost, type Tier } from '@/lib/prospector/phone-rules';
import type { Nivel } from '@/lib/prospector/levels';

describe('needsPhone', () => {
  it('C-LEVEL → true en todos los tiers', () => {
    const tiers: Tier[] = ['A-ORO', 'A', 'B', 'C', 'sin_calificar'];
    for (const tier of tiers) {
      expect(needsPhone({ nivel: 'C-LEVEL', tier })).toBe(true);
    }
  });

  it('DIRECTOR → solo en tier A-ORO o A', () => {
    expect(needsPhone({ nivel: 'DIRECTOR', tier: 'A-ORO' })).toBe(true);
    expect(needsPhone({ nivel: 'DIRECTOR', tier: 'A' })).toBe(true);
    expect(needsPhone({ nivel: 'DIRECTOR', tier: 'B' })).toBe(false);
    expect(needsPhone({ nivel: 'DIRECTOR', tier: 'C' })).toBe(false);
    expect(needsPhone({ nivel: 'DIRECTOR', tier: 'sin_calificar' })).toBe(false);
    expect(needsPhone({ nivel: 'DIRECTOR' })).toBe(false);
  });

  it.each<[Nivel, Tier]>([
    ['GERENTE',  'A-ORO'],
    ['GERENTE',  'A'],
    ['GERENTE',  'B'],
    ['JEFE',     'A-ORO'],
    ['JEFE',     'A'],
    ['ANALISTA', 'A-ORO'],
  ])('%s en tier %s → false', (nivel, tier) => {
    expect(needsPhone({ nivel, tier })).toBe(false);
  });
});

describe('creditCost', () => {
  it('1 crédito sin teléfono', () => {
    expect(creditCost(false)).toBe(1);
  });
  it('9 créditos con teléfono', () => {
    expect(creditCost(true)).toBe(9);
  });
});
