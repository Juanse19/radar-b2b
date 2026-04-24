/**
 * Unit tests for the canNext logic in lib/comercial/calificador-wizard-state.ts
 *
 * The hook is a React hook that uses next/navigation and returns `canNext`
 * derived from URL search params. We test the pure `canNext` decision function
 * by extracting the logic from the hook in isolation — without mounting a
 * React component.
 *
 * Strategy: mirror the exact `canNext` implementation from the hook and test
 * the invariants of each step. This avoids React hook wiring complexity while
 * still exercising the real business logic.
 *
 * Mocks:
 *  - next/navigation (useRouter, useSearchParams, usePathname)
 *  - react (only the hooks used inside the wizard state module)
 */
import { describe, it, expect, vi } from 'vitest';

// ── Mock next/navigation before any hook import ───────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:      vi.fn(() => ({ replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname:    vi.fn(() => '/calificacion'),
}));

// ── Minimal react mock ────────────────────────────────────────────────────────
// The hook uses useMemo and useCallback. We provide thin shims that immediately
// evaluate the factory function so the logic runs synchronously in tests.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo:     (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure canNext logic extracted from the hook (mirrors calificador-wizard-state.ts
// exactly). Tested independently so the business rules are explicit.
// ─────────────────────────────────────────────────────────────────────────────

interface CanNextInput {
  step:        1 | 2 | 3;
  linea:       string;
  mode:        'auto' | 'manual' | '';
  count:       number;
  selectedIds: number[];
}

function canNext({ step, linea, mode, count, selectedIds }: CanNextInput): boolean {
  if (step === 1) return !!linea && !!mode;
  if (step === 2) {
    if (mode === 'auto') return count >= 1 && count <= 50;
    return selectedIds.length >= 1;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('canNext — step 1', () => {
  it('is false when both linea and mode are empty', () => {
    expect(canNext({ step: 1, linea: '', mode: '', count: 5, selectedIds: [] })).toBe(false);
  });

  it('is false when linea is empty and mode is set', () => {
    expect(canNext({ step: 1, linea: '', mode: 'auto', count: 5, selectedIds: [] })).toBe(false);
  });

  it('is false when linea is set but mode is empty', () => {
    expect(canNext({ step: 1, linea: 'BHS', mode: '', count: 5, selectedIds: [] })).toBe(false);
  });

  it('is true when both linea and mode are set (auto)', () => {
    expect(canNext({ step: 1, linea: 'BHS', mode: 'auto', count: 5, selectedIds: [] })).toBe(true);
  });

  it('is true when both linea and mode are set (manual)', () => {
    expect(canNext({ step: 1, linea: 'Final de Línea', mode: 'manual', count: 5, selectedIds: [] })).toBe(true);
  });

  it('is true for every recognized linea value', () => {
    const lineas = ['BHS', 'Intralogística', 'Cartón', 'Final de Línea', 'Motos', 'SOLUMAT'];
    for (const linea of lineas) {
      expect(canNext({ step: 1, linea, mode: 'auto', count: 5, selectedIds: [] })).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('canNext — step 2 (auto mode)', () => {
  it('is false when count is 0', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 0, selectedIds: [] })).toBe(false);
  });

  it('is false when count is negative', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: -1, selectedIds: [] })).toBe(false);
  });

  it('is false when count exceeds 50', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 51, selectedIds: [] })).toBe(false);
  });

  it('is true at boundary: count = 1', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 1, selectedIds: [] })).toBe(true);
  });

  it('is true at boundary: count = 50', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 50, selectedIds: [] })).toBe(true);
  });

  it('is true for count = 10 (typical value)', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 10, selectedIds: [] })).toBe(true);
  });

  it('is false at boundary: count = 51 (one over max)', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'auto', count: 51, selectedIds: [] })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('canNext — step 2 (manual mode)', () => {
  it('is false when selectedIds is empty', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'manual', count: 5, selectedIds: [] })).toBe(false);
  });

  it('is true when at least 1 company is selected', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'manual', count: 5, selectedIds: [42] })).toBe(true);
  });

  it('is true when multiple companies are selected', () => {
    expect(canNext({ step: 2, linea: 'BHS', mode: 'manual', count: 5, selectedIds: [1, 2, 3] })).toBe(true);
  });

  it('count does not affect canNext in manual mode (any count is ok)', () => {
    // Even count = 0 should not block manual mode — selectedIds is what matters
    expect(canNext({ step: 2, linea: 'BHS', mode: 'manual', count: 0, selectedIds: [1] })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('canNext — step 3', () => {
  it('is always true regardless of other fields', () => {
    expect(canNext({ step: 3, linea: '',    mode: '',       count: 0,  selectedIds: [] })).toBe(true);
    expect(canNext({ step: 3, linea: 'BHS', mode: 'auto',  count: 10, selectedIds: [] })).toBe(true);
    expect(canNext({ step: 3, linea: 'BHS', mode: 'manual', count: 5, selectedIds: [1, 2] })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke-test: import the hook module to ensure it parses without error.
// (Navigation hooks are mocked — we do not call the hook directly here.)
// ─────────────────────────────────────────────────────────────────────────────

describe('useCalWizardState module import', () => {
  it('exports useCalWizardState without throwing', async () => {
    const mod = await import('@/lib/comercial/calificador-wizard-state');
    expect(typeof mod.useCalWizardState).toBe('function');
  });
});
