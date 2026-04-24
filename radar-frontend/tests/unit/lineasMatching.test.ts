/**
 * Unit tests for the business-line selector matching logic in ManualAgentForm.
 *
 * Validates that VALUE_TO_CODIGO + dual codigo/nombre filter correctly maps
 * DB rows (with both `codigo` and `nombre` fields) to LINEA_OPTIONS_ALL entries.
 *
 * This is the critical Sprint-3 fix: previously the form only matched by
 * `nombre` exact string, and DB names didn't match frontend constants, causing
 * only "Intralogística" to appear in the selector.
 */

import { describe, it, expect } from 'vitest';
import { LINEAS_FALLBACK } from '@/hooks/useLineasActivas';
import { LINEA_OPTIONS_ALL } from '@/lib/constants/lineas';
import type { LineaRow } from '@/app/api/lineas/route';

// ── Replica of the matching logic from ManualAgentForm ────────────────────────

const VALUE_TO_CODIGO: Record<string, string> = {
  'BHS':           'bhs',
  'Cartón':        'carton_papel',
  'Intralogística':'intralogistica',
  'Final de Línea':'final_linea',
  'Motos':         'motos',
  'SOLUMAT':       'solumat',
};

function filterLineas(lineasActivas: LineaRow[]) {
  const dbCodigos = new Set(lineasActivas.map(l => l.codigo).filter(Boolean));
  const dbNames   = new Set(lineasActivas.map(l => l.nombre));
  return LINEA_OPTIONS_ALL.filter(o =>
    o.value === 'ALL'
    || dbCodigos.has(VALUE_TO_CODIGO[o.value] ?? '')
    || dbNames.has(o.value),
  );
}

// ── DB rows fixtures ──────────────────────────────────────────────────────────

/** What the production DB returns after the Sprint-3 fix (all 6 active). */
const ALL_SIX_FROM_DB: LineaRow[] = [
  { id: '1', codigo: 'bhs',            nombre: 'BHS',             color_hex: null, icono: null, descripcion: null },
  { id: '2', codigo: 'carton_papel',   nombre: 'Cartón',           color_hex: null, icono: null, descripcion: null },
  { id: '3', codigo: 'intralogistica', nombre: 'Intralogística',   color_hex: null, icono: null, descripcion: null },
  { id: '7', codigo: 'final_linea',    nombre: 'Final de Línea',   color_hex: null, icono: null, descripcion: null },
  { id: '8', codigo: 'motos',          nombre: 'Motos',            color_hex: null, icono: null, descripcion: null },
  { id: '9', codigo: 'solumat',        nombre: 'SOLUMAT',          color_hex: null, icono: null, descripcion: null },
];

/** Legacy scenario: only Intralogística was active (the bug that triggered Sprint-3). */
const ONLY_INTRALOGISTICA: LineaRow[] = [
  { id: '3', codigo: 'intralogistica', nombre: 'Intralogística', color_hex: null, icono: null, descripcion: null },
];

/** Partial set — imagine 3 lines enabled in staging. */
const THREE_LINES: LineaRow[] = [
  { id: '1', codigo: 'bhs',          nombre: 'BHS',           color_hex: null, icono: null, descripcion: null },
  { id: '3', codigo: 'intralogistica', nombre: 'Intralogística', color_hex: null, icono: null, descripcion: null },
  { id: '9', codigo: 'solumat',      nombre: 'SOLUMAT',       color_hex: null, icono: null, descripcion: null },
];

/** Rows without `codigo` field — fallback path (old API version). */
const NO_CODIGO: LineaRow[] = [
  { id: '3', nombre: 'Intralogística', color_hex: null, icono: null, descripcion: null },
  { id: '7', nombre: 'Final de Línea', color_hex: null, icono: null, descripcion: null },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('business-line selector matching (ManualAgentForm)', () => {
  describe('filterLineas — full DB set', () => {
    it('shows all 7 options (6 lines + ALL) when all 6 lines are active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result).toHaveLength(7);
    });

    it('always includes the ALL option', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      const all = result.find(o => o.value === 'ALL');
      expect(all).toBeDefined();
    });

    it('includes BHS when codigo=bhs is active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result.some(o => o.value === 'BHS')).toBe(true);
    });

    it('includes Cartón when codigo=carton_papel is active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result.some(o => o.value === 'Cartón')).toBe(true);
    });

    it('includes Final de Línea when codigo=final_linea is active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result.some(o => o.value === 'Final de Línea')).toBe(true);
    });

    it('includes Motos when codigo=motos is active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result.some(o => o.value === 'Motos')).toBe(true);
    });

    it('includes SOLUMAT when codigo=solumat is active', () => {
      const result = filterLineas(ALL_SIX_FROM_DB);
      expect(result.some(o => o.value === 'SOLUMAT')).toBe(true);
    });
  });

  describe('filterLineas — partial/legacy DB sets', () => {
    it('shows only Intralogística + ALL when only that line is active (old bug state)', () => {
      const result = filterLineas(ONLY_INTRALOGISTICA);
      expect(result).toHaveLength(2);
      const vals = result.map(o => o.value);
      expect(vals).toContain('Intralogística');
      expect(vals).toContain('ALL');
    });

    it('shows exactly 3 lines + ALL for THREE_LINES fixture', () => {
      const result = filterLineas(THREE_LINES);
      expect(result).toHaveLength(4);
      const vals = result.map(o => o.value);
      expect(vals).toContain('BHS');
      expect(vals).toContain('Intralogística');
      expect(vals).toContain('SOLUMAT');
      expect(vals).toContain('ALL');
    });

    it('excludes lines not in the DB set', () => {
      const result = filterLineas(THREE_LINES);
      const vals = result.map(o => o.value);
      expect(vals).not.toContain('Cartón');
      expect(vals).not.toContain('Final de Línea');
      expect(vals).not.toContain('Motos');
    });
  });

  describe('filterLineas — nombre fallback (no codigo)', () => {
    it('matches by nombre when codigo is absent', () => {
      const result = filterLineas(NO_CODIGO);
      const vals = result.map(o => o.value);
      expect(vals).toContain('Intralogística');
      expect(vals).toContain('Final de Línea');
    });

    it('does not include lines not matched by nombre either', () => {
      const result = filterLineas(NO_CODIGO);
      expect(result.some(o => o.value === 'BHS')).toBe(false);
      expect(result.some(o => o.value === 'Motos')).toBe(false);
    });
  });

  describe('LINEAS_FALLBACK — hook fallback', () => {
    it('LINEAS_FALLBACK has 6 entries (all lines, no ALL)', () => {
      expect(LINEAS_FALLBACK).toHaveLength(6);
    });

    it('all 6 fallback entries have a codigo field', () => {
      LINEAS_FALLBACK.forEach(l => {
        expect(l.codigo).toBeDefined();
        expect(typeof l.codigo).toBe('string');
        expect(l.codigo!.length).toBeGreaterThan(0);
      });
    });

    it('fallback codigos match VALUE_TO_CODIGO values', () => {
      const allowedCodigos = new Set(Object.values(VALUE_TO_CODIGO));
      LINEAS_FALLBACK.forEach(l => {
        expect(allowedCodigos.has(l.codigo!)).toBe(true);
      });
    });

    it('filterLineas with LINEAS_FALLBACK shows all 7 options', () => {
      const result = filterLineas(LINEAS_FALLBACK);
      expect(result).toHaveLength(7);
    });
  });

  describe('VALUE_TO_CODIGO coverage', () => {
    it('every non-ALL LINEA_OPTIONS_ALL value has a mapping', () => {
      const nonAllOptions = LINEA_OPTIONS_ALL.filter(o => o.value !== 'ALL');
      nonAllOptions.forEach(opt => {
        expect(VALUE_TO_CODIGO[opt.value]).toBeDefined();
      });
    });

    it('all mapped codigos are non-empty strings', () => {
      Object.values(VALUE_TO_CODIGO).forEach(codigo => {
        expect(typeof codigo).toBe('string');
        expect(codigo.length).toBeGreaterThan(0);
      });
    });
  });
});
