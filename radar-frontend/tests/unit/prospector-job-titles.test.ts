/**
 * Unit tests para lib/apollo/job-titles.ts
 */
import { describe, it, expect } from 'vitest';
import { getDefaultTitles, SUBLINEAS_WITH_DEFAULTS } from '@/lib/apollo/job-titles';

describe('getDefaultTitles', () => {
  it('cubre las 6 sub-líneas + logística', () => {
    const expected = [
      'aeropuertos',
      'cargo_uld',
      'carton_corrugado',
      'final_linea',
      'ensambladoras_motos',
      'solumat',
      'logistica',
    ];
    for (const k of expected) {
      expect(SUBLINEAS_WITH_DEFAULTS).toContain(k);
    }
  });

  it('devuelve >= 8 titles para cada sub-línea conocida', () => {
    for (const codigo of SUBLINEAS_WITH_DEFAULTS) {
      const titles = getDefaultTitles(codigo);
      expect(titles.length).toBeGreaterThanOrEqual(8);
      expect(titles.every(t => typeof t === 'string' && t.length > 0)).toBe(true);
    }
  });

  it('aeropuertos incluye títulos clave', () => {
    const titles = getDefaultTitles('aeropuertos');
    expect(titles).toContain('Director de Operaciones Aeroportuarias');
    expect(titles).toContain('Airport Operations Manager');
    expect(titles).toContain('CEO');
  });

  it('cargo_uld incluye Cargo Operations Manager', () => {
    expect(getDefaultTitles('cargo_uld')).toContain('Cargo Operations Manager');
  });

  it('carton_corrugado incluye Plant Manager', () => {
    expect(getDefaultTitles('carton_corrugado')).toContain('Plant Manager');
  });

  it('normaliza variantes con guiones/espacios/mayúsculas', () => {
    const ref = getDefaultTitles('cargo_uld');
    expect(getDefaultTitles('Cargo-ULD')).toEqual(ref);
    expect(getDefaultTitles('CARGO_ULD')).toEqual(ref);
    expect(getDefaultTitles('cargo uld')).toEqual(ref);
  });

  it('cae al fallback (final_linea) para códigos desconocidos', () => {
    const fallback = getDefaultTitles('final_linea');
    expect(getDefaultTitles('subliana_inexistente')).toEqual(fallback);
    expect(getDefaultTitles(null)).toEqual(fallback);
    expect(getDefaultTitles(undefined)).toEqual(fallback);
    expect(getDefaultTitles('')).toEqual(fallback);
  });
});
