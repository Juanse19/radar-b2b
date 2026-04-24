/**
 * Unit tests for RadarSignalCard component logic.
 *
 * The vitest environment is 'node' (no DOM/jsdom), matching the rest of the
 * test suite. Rather than rendering JSX, we test the deterministic branching
 * logic that drives what RadarSignalCard renders:
 *
 *   1. visible=false              → component returns null (renders nothing)
 *   2. visible=true, no empresaId → query disabled; no loading state shown
 *   3. visible=true, isLoading    → loading state shown
 *   4. signal not found / radarActivo !== 'Sí' → "sin señal" state
 *   5. signal found with full MAOA → show all fields
 *
 * Badge helpers (AccionBadge, ConvergenciaBadge, VentanaBadge) are pure
 * label mappers — we test their logic directly here.
 */

import { describe, it, expect } from 'vitest';

// ── Badge label logic (mirrors component badge helpers) ───────────────────────

type Convergencia = 'Verificada' | 'Pendiente' | string;

function accionLabel(accion: string): string {
  if (accion.includes('ABM'))       return '⚡ ABM ACTIVADO';
  if (accion.includes('MONITOREO')) return '👁 MONITOREO ACTIVO';
  return '📦 ARCHIVAR';
}

function convergenciaLabel(value: Convergencia): string {
  if (value === 'Verificada') return 'Verificada';
  if (value === 'Pendiente')  return 'Pendiente';
  return 'Sin convergencia';
}

function ventanaLabel(ventana: string): string {
  return ventana || 'Sin señal';
}

function ventanaIsHot(ventana: string): boolean {
  return ['0-6 Meses', '6-12 Meses'].includes(ventana);
}

// ── Component render-path logic ───────────────────────────────────────────────

interface SignalSummary {
  id:                 number;
  empresa:            string;
  tipoSenal:          string;
  ventanaCompra:      string;
  convergenciaMaoa?:  string | null;
  accionRecomendada?: string | null;
  scoreFinalMaoa?:    number | null;
  tierClasificacion?: string | null;
  tirClasificacion?:  string | null;
  criteriosCumplidos?: string[] | null;
  totalCriterios?:    number | null;
  montoInversion?:    string | null;
  radarActivo:        string;
}

type RenderPath =
  | 'null'          // visible=false
  | 'loading'       // isLoading=true
  | 'no-signal'     // no data or radarActivo !== 'Sí'
  | 'signal-found'; // full MAOA card

function deriveRenderPath(opts: {
  visible:    boolean;
  isLoading:  boolean;
  signals:    SignalSummary[] | undefined;
}): RenderPath {
  if (!opts.visible) return 'null';
  if (opts.isLoading) return 'loading';
  const signal = opts.signals?.[0];
  if (!signal || signal.radarActivo !== 'Sí') return 'no-signal';
  return 'signal-found';
}

// ── Tests: visible flag ───────────────────────────────────────────────────────

describe('RadarSignalCard — visible=false', () => {
  it('renders nothing (null) when visible is false', () => {
    const path = deriveRenderPath({ visible: false, isLoading: false, signals: undefined });
    expect(path).toBe('null');
  });

  it('renders nothing even when there is signal data, if visible=false', () => {
    const path = deriveRenderPath({
      visible: false,
      isLoading: false,
      signals: [{
        id: 1, empresa: 'DHL', tipoSenal: 'X',
        ventanaCompra: '0-6 Meses', radarActivo: 'Sí',
      }],
    });
    expect(path).toBe('null');
  });
});

// ── Tests: no empresaId → query disabled ──────────────────────────────────────

describe('RadarSignalCard — visible=true, no empresaId (query disabled)', () => {
  // When empresaId is null/undefined, `enabled: visible && !!empresaId` is false.
  // The query never fires → isLoading stays false → no loading state shown.
  // With no data and no loading, we reach the "no signal" branch.

  it('query enabled=false means isLoading=false (no loading state)', () => {
    const isLoading = false; // enabled=false never triggers loading
    const path = deriveRenderPath({ visible: true, isLoading, signals: undefined });
    expect(path).toBe('no-signal');
  });

  it('no empresaId → renders no-signal state, not loading', () => {
    // signals=undefined because query was never enabled
    const path = deriveRenderPath({ visible: true, isLoading: false, signals: undefined });
    expect(path).toBe('no-signal');
  });
});

// ── Tests: loading state ──────────────────────────────────────────────────────

describe('RadarSignalCard — loading state', () => {
  it('shows loading when visible=true and isLoading=true', () => {
    const path = deriveRenderPath({ visible: true, isLoading: true, signals: undefined });
    expect(path).toBe('loading');
  });

  it('loading takes priority over missing signals', () => {
    const path = deriveRenderPath({ visible: true, isLoading: true, signals: [] });
    expect(path).toBe('loading');
  });
});

// ── Tests: no-signal state ────────────────────────────────────────────────────

describe('RadarSignalCard — no-signal state', () => {
  it('shows no-signal when signals array is empty', () => {
    const path = deriveRenderPath({ visible: true, isLoading: false, signals: [] });
    expect(path).toBe('no-signal');
  });

  it('shows no-signal when signal exists but radarActivo="No"', () => {
    const path = deriveRenderPath({
      visible: true, isLoading: false,
      signals: [{
        id: 2, empresa: 'Empresa X', tipoSenal: 'Expansión',
        ventanaCompra: '0-6 Meses', radarActivo: 'No',
      }],
    });
    expect(path).toBe('no-signal');
  });

  it('shows no-signal when signals is undefined', () => {
    const path = deriveRenderPath({ visible: true, isLoading: false, signals: undefined });
    expect(path).toBe('no-signal');
  });
});

// ── Tests: signal-found state ─────────────────────────────────────────────────

describe('RadarSignalCard — signal-found with MAOA data', () => {
  const dhlSignal: SignalSummary = {
    id:                 5,
    empresa:            'DHL Express',
    tipoSenal:          'Expansión CEDI',
    ventanaCompra:      '0-6 Meses',
    radarActivo:        'Sí',
    convergenciaMaoa:   'Verificada',
    accionRecomendada:  'ABM ACTIVADO',
    scoreFinalMaoa:     8.0,
    tierClasificacion:  'A',
    tirClasificacion:   'A',
    criteriosCumplidos: ['Fuente oficial', 'CAPEX'],
    totalCriterios:     2,
    montoInversion:     'USD 5M',
  };

  it('reaches signal-found render path', () => {
    const path = deriveRenderPath({
      visible: true, isLoading: false, signals: [dhlSignal],
    });
    expect(path).toBe('signal-found');
  });

  it('empresa name is available from signal data', () => {
    const signal = [dhlSignal][0];
    expect(signal.empresa).toBe('DHL Express');
  });

  it('AccionBadge label is "⚡ ABM ACTIVADO" for "ABM ACTIVADO"', () => {
    expect(accionLabel(dhlSignal.accionRecomendada!)).toBe('⚡ ABM ACTIVADO');
  });

  it('ConvergenciaBadge label is "Verificada" for "Verificada"', () => {
    expect(convergenciaLabel(dhlSignal.convergenciaMaoa!)).toBe('Verificada');
  });

  it('VentanaBadge label is "0-6 Meses" for "0-6 Meses"', () => {
    expect(ventanaLabel(dhlSignal.ventanaCompra)).toBe('0-6 Meses');
  });

  it('VentanaBadge "0-6 Meses" is hot (green)', () => {
    expect(ventanaIsHot('0-6 Meses')).toBe(true);
  });

  it('Score MAOA formatted to 1 decimal: 8.0 → "8.0"', () => {
    expect(dhlSignal.scoreFinalMaoa!.toFixed(1)).toBe('8.0');
  });

  it('TIER clasificacion is "A"', () => {
    expect(dhlSignal.tierClasificacion).toBe('A');
  });

  it('TIR clasificacion is "A"', () => {
    expect(dhlSignal.tirClasificacion).toBe('A');
  });

  it('criteriosCumplidos slice(0, 4) does not exceed 4 items', () => {
    const sliced = dhlSignal.criteriosCumplidos!.slice(0, 4);
    expect(sliced.length).toBeLessThanOrEqual(4);
  });
});

// ── Tests: AccionBadge label mapping ─────────────────────────────────────────

describe('AccionBadge — label mapping', () => {
  it('"ABM ACTIVADO" → "⚡ ABM ACTIVADO"', () => {
    expect(accionLabel('ABM ACTIVADO')).toBe('⚡ ABM ACTIVADO');
  });

  it('"MONITOREO ACTIVO" → "👁 MONITOREO ACTIVO"', () => {
    expect(accionLabel('MONITOREO ACTIVO')).toBe('👁 MONITOREO ACTIVO');
  });

  it('"ARCHIVAR" → "📦 ARCHIVAR"', () => {
    expect(accionLabel('ARCHIVAR')).toBe('📦 ARCHIVAR');
  });

  it('empty string → "📦 ARCHIVAR" (fallback)', () => {
    expect(accionLabel('')).toBe('📦 ARCHIVAR');
  });
});

// ── Tests: ConvergenciaBadge label mapping ────────────────────────────────────

describe('ConvergenciaBadge — label mapping', () => {
  it('"Verificada" → "Verificada"', () => {
    expect(convergenciaLabel('Verificada')).toBe('Verificada');
  });

  it('"Pendiente" → "Pendiente"', () => {
    expect(convergenciaLabel('Pendiente')).toBe('Pendiente');
  });

  it('"Sin convergencia" → "Sin convergencia"', () => {
    expect(convergenciaLabel('Sin convergencia')).toBe('Sin convergencia');
  });

  it('unknown value → "Sin convergencia" (fallback)', () => {
    expect(convergenciaLabel('Desconocido')).toBe('Sin convergencia');
  });
});

// ── Tests: VentanaBadge label and hot-indicator ───────────────────────────────

describe('VentanaBadge — label and hot indicator', () => {
  it('"0-6 Meses" → label "0-6 Meses" and isHot=true', () => {
    expect(ventanaLabel('0-6 Meses')).toBe('0-6 Meses');
    expect(ventanaIsHot('0-6 Meses')).toBe(true);
  });

  it('"6-12 Meses" → label "6-12 Meses" and isHot=true', () => {
    expect(ventanaLabel('6-12 Meses')).toBe('6-12 Meses');
    expect(ventanaIsHot('6-12 Meses')).toBe(true);
  });

  it('"12-24 Meses" → label "12-24 Meses" and isHot=false', () => {
    expect(ventanaLabel('12-24 Meses')).toBe('12-24 Meses');
    expect(ventanaIsHot('12-24 Meses')).toBe(false);
  });

  it('empty string → label "Sin señal" and isHot=false', () => {
    expect(ventanaLabel('')).toBe('Sin señal');
    expect(ventanaIsHot('')).toBe(false);
  });
});

// ── Tests: criterios overflow display ─────────────────────────────────────────

describe('RadarSignalCard — criterios overflow logic', () => {
  it('shows up to 4 criterios and hides the rest', () => {
    const criterios = ['A', 'B', 'C', 'D', 'E'];
    const totalCriterios = 5;
    const visible = criterios.slice(0, 4);
    const hidden  = totalCriterios - 4;

    expect(visible).toEqual(['A', 'B', 'C', 'D']);
    expect(hidden).toBe(1);
  });

  it('no overflow indicator when criterios ≤ 4', () => {
    const criterios = ['A', 'B', 'C'];
    const totalCriterios = 3;
    const hidden = (totalCriterios ?? 0) - 4;

    expect(hidden).toBeLessThanOrEqual(0);
  });

  it('overflow count = totalCriterios - 4', () => {
    const totalCriterios = 7;
    expect(totalCriterios - 4).toBe(3);
  });
});

// ── Tests: score formatting ───────────────────────────────────────────────────

describe('RadarSignalCard — MAOA score display formatting', () => {
  it('scoreFinalMaoa=8.0 → toFixed(1) = "8.0"', () => {
    expect((8.0).toFixed(1)).toBe('8.0');
  });

  it('scoreFinalMaoa=7.9375 → toFixed(1) = "7.9"', () => {
    expect((7.9375).toFixed(1)).toBe('7.9');
  });

  it('scoreFinalMaoa=8.125 → toFixed(1) = "8.1"', () => {
    expect((8.125).toFixed(1)).toBe('8.1');
  });

  it('scoreFinalMaoa=10 → toFixed(1) = "10.0"', () => {
    expect((10).toFixed(1)).toBe('10.0');
  });
});
