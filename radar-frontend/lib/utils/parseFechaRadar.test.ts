import { describe, it, expect } from 'vitest';
import { parseFechaRadar, formatFechaRadar, fechaHoyES } from './parseFechaRadar';

describe('parseFechaRadar', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseFechaRadar('15/03/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
  });

  it('parses ISO YYYY-MM-DD', () => {
    const d = parseFechaRadar('2026-03-15');
    expect(d?.getFullYear()).toBe(2026);
  });

  it('returns null for "No disponible"', () => {
    expect(parseFechaRadar('No disponible')).toBeNull();
    expect(parseFechaRadar('no disponible')).toBeNull();
  });

  it('returns null for empty / null / undefined', () => {
    expect(parseFechaRadar('')).toBeNull();
    expect(parseFechaRadar(null)).toBeNull();
    expect(parseFechaRadar(undefined)).toBeNull();
    expect(parseFechaRadar('—')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseFechaRadar('not a date')).toBeNull();
  });
});

describe('formatFechaRadar', () => {
  it('formats DD/MM/YYYY input as locale string', () => {
    expect(formatFechaRadar('15/03/2026')).toMatch(/15\/03\/2026/);
  });

  it('returns dash for invalid', () => {
    expect(formatFechaRadar('No disponible')).toBe('—');
    expect(formatFechaRadar(null)).toBe('—');
  });
});

describe('fechaHoyES', () => {
  it('returns DD/MM/YYYY format', () => {
    expect(fechaHoyES()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
