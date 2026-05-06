/**
 * Unit tests para lib/prospector/levels.ts
 *
 * Verifica clasificación de cargos en español/inglés y mapeo a seniority.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyLevel,
  nivelToSeniority,
  NIVEL_ORDEN,
  type Nivel,
} from '@/lib/prospector/levels';

describe('classifyLevel', () => {
  describe('C-LEVEL', () => {
    const titles = [
      'CEO',
      'COO',
      'CFO',
      'CIO',
      'CTO',
      'Chief Executive Officer',
      'Chief Operating Officer',
      'Gerente General',
      'Director General',
      'Managing Director',
      'Country Manager',
      'Presidente',
      'President',
      'Founder',
      'Fundador',
      'Owner',
      'Dueño',
    ];
    for (const t of titles) {
      it(`classifies "${t}" as C-LEVEL`, () => {
        expect(classifyLevel(t)).toBe('C-LEVEL');
      });
    }
  });

  describe('DIRECTOR', () => {
    const titles = [
      'VP of Operations',
      'Vice President',
      'Vicepresidente',
      'Director de Operaciones',
      'Directora de Marketing',
      'Director de Infraestructura',
    ];
    for (const t of titles) {
      it(`classifies "${t}" as DIRECTOR`, () => {
        expect(classifyLevel(t)).toBe('DIRECTOR');
      });
    }
  });

  describe('GERENTE', () => {
    const titles = [
      'Gerente de Planta',
      'Plant Manager',
      'Operations Manager',
      'Head of Operations',
      'Production Manager',
      'Manufacturing Manager',
    ];
    for (const t of titles) {
      it(`classifies "${t}" as GERENTE`, () => {
        expect(classifyLevel(t)).toBe('GERENTE');
      });
    }
  });

  describe('JEFE', () => {
    const titles = [
      'Jefe de Compras',
      'Coordinador de Logística',
      'Supervisor de Producción',
      'Logistics Coordinator',
      'Production Supervisor',
      'Encargado de Almacén',
      'Team Lead',
    ];
    for (const t of titles) {
      it(`classifies "${t}" as JEFE`, () => {
        expect(classifyLevel(t)).toBe('JEFE');
      });
    }
  });

  describe('ANALISTA fallback', () => {
    it('returns ANALISTA for empty/null/unknown', () => {
      expect(classifyLevel('')).toBe('ANALISTA');
      expect(classifyLevel(null)).toBe('ANALISTA');
      expect(classifyLevel(undefined)).toBe('ANALISTA');
      expect(classifyLevel('Software Engineer')).toBe('ANALISTA');
      expect(classifyLevel('Analista')).toBe('ANALISTA');
    });
  });

  describe('priority — C-LEVEL beats DIRECTOR keyword', () => {
    it('"CEO and Director" → C-LEVEL', () => {
      expect(classifyLevel('CEO and Director')).toBe('C-LEVEL');
    });
    it('"Gerente General y Director" → C-LEVEL', () => {
      expect(classifyLevel('Gerente General y Director')).toBe('C-LEVEL');
    });
  });
});

describe('NIVEL_ORDEN', () => {
  it('C-LEVEL has lowest order (highest priority)', () => {
    expect(NIVEL_ORDEN['C-LEVEL']).toBe(0);
  });
  it('orders levels correctly for sorting', () => {
    const levels: Nivel[] = ['ANALISTA', 'JEFE', 'C-LEVEL', 'GERENTE', 'DIRECTOR'];
    const sorted = [...levels].sort((a, b) => NIVEL_ORDEN[a] - NIVEL_ORDEN[b]);
    expect(sorted).toEqual(['C-LEVEL', 'DIRECTOR', 'GERENTE', 'JEFE', 'ANALISTA']);
  });
});

describe('nivelToSeniority', () => {
  it('maps each level to expected seniority enum', () => {
    expect(nivelToSeniority('C-LEVEL')).toBe('c_suite');
    expect(nivelToSeniority('DIRECTOR')).toBe('director');
    expect(nivelToSeniority('GERENTE')).toBe('manager');
    expect(nivelToSeniority('JEFE')).toBe('manager');
    expect(nivelToSeniority('ANALISTA')).toBe('contributor');
  });
});
