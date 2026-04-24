/**
 * Unit tests for ScoreBadge utility functions.
 */

import { describe, it, expect } from 'vitest';
import { normalizeScore, getScoreTier } from '../../components/ScoreBadge';

describe('normalizeScore()', () => {
  it('returns score as-is when ≤ 10', () => {
    expect(normalizeScore(8)).toBe(8);
    expect(normalizeScore(10)).toBe(10);
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(5)).toBe(5);
  });

  it('divides by 10 and rounds when score > 10', () => {
    expect(normalizeScore(80)).toBe(8);
    expect(normalizeScore(100)).toBe(10);
    expect(normalizeScore(50)).toBe(5);
    expect(normalizeScore(75)).toBe(8); // Math.round(7.5) = 8
  });

  it('handles boundary value 11', () => {
    expect(normalizeScore(11)).toBe(1); // Math.round(1.1) = 1
  });
});

describe('getScoreTier()', () => {
  it('returns ORO for raw score ≥ 8', () => {
    expect(getScoreTier(8)).toBe('ORO');
    expect(getScoreTier(9)).toBe('ORO');
    expect(getScoreTier(10)).toBe('ORO');
  });

  it('returns ORO for 0-100 scale score that normalizes to ≥ 8', () => {
    // normalizeScore(80) = 8 → ORO
    expect(getScoreTier(80)).toBe('ORO');
    expect(getScoreTier(90)).toBe('ORO');
    expect(getScoreTier(100)).toBe('ORO');
    // normalizeScore(79) = Math.round(7.9) = 8 → ORO (rounds up)
    expect(getScoreTier(79)).toBe('ORO');
  });

  it('returns Monitoreo for normalized score 5-7', () => {
    expect(getScoreTier(5)).toBe('Monitoreo');
    expect(getScoreTier(6)).toBe('Monitoreo');
    expect(getScoreTier(7)).toBe('Monitoreo');
  });

  it('returns Monitoreo for 0-100 scale score normalizing to 5-7', () => {
    // normalizeScore(50) = 5, normalizeScore(74) = 7
    expect(getScoreTier(50)).toBe('Monitoreo');
    expect(getScoreTier(70)).toBe('Monitoreo');
    // normalizeScore(74) = Math.round(7.4) = 7 → Monitoreo
    expect(getScoreTier(74)).toBe('Monitoreo');
  });

  it('returns Contexto for normalized score 1-4', () => {
    expect(getScoreTier(1)).toBe('Contexto');
    expect(getScoreTier(3)).toBe('Contexto');
    expect(getScoreTier(4)).toBe('Contexto');
  });

  it('returns Sin Señal for score 0', () => {
    expect(getScoreTier(0)).toBe('Sin Señal');
  });

  it('boundary score=4 → Contexto, not Monitoreo', () => {
    expect(getScoreTier(4)).toBe('Contexto');
  });

  it('boundary score=5 → Monitoreo, not Contexto', () => {
    expect(getScoreTier(5)).toBe('Monitoreo');
  });

  it('boundary score=8 → ORO, not Monitoreo', () => {
    expect(getScoreTier(8)).toBe('ORO');
  });

  it('boundary score=7 → Monitoreo, not ORO', () => {
    expect(getScoreTier(7)).toBe('Monitoreo');
  });
});
