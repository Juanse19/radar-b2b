import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { validateAgente1Result } from '@/lib/comercial/validation';
import type { Agente1Result } from '@/lib/comercial/schema';

const TODAY = new Date('2026-05-05T12:00:00Z');

function baseSi(overrides: Partial<Agente1Result> = {}): Agente1Result {
  return {
    empresa_evaluada:    'Grupo UMA',
    radar_activo:        'Sí',
    linea_negocio:       'Intralogística',
    tipo_senal:          'Expansión / Nueva Planta',
    pais:                'Colombia',
    empresa_o_proyecto:  'Planta Pereira',
    descripcion_resumen: 'Grupo UMA anunció una nueva planta de ensamblaje con CAPEX confirmado para 2027.',
    criterios_cumplidos: ['c1', 'c2', 'c3'],
    total_criterios:     3,
    ventana_compra:      '6-12 Meses',
    monto_inversion:     'USD 30M',
    fuente_link:         'https://example.com/2026/04/uma-planta',
    fuente_nombre:       'Reuters',
    fecha_senal:         '15/04/2026',
    evaluacion_temporal: '',
    observaciones:       null,
    motivo_descarte:     '',
    ...overrides,
  };
}

describe('validateAgente1Result', () => {
  it('flips Sí→No when descripción tiene verbo pasado completivo "inauguró"', () => {
    const input = baseSi({
      descripcion_resumen: 'Grupo UMA inauguró en noviembre de 2024 una planta de ensamblaje en Pereira.',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('No');
    expect(out.evaluacion_temporal).toBe('🔴 Descarte');
    expect(out.motivo_descarte).toMatch(/inaugurada|operando/i);
  });

  it('flips Sí→No con fecha vieja sin fase futura', () => {
    const input = baseSi({
      fecha_senal:         '15/11/2024',
      descripcion_resumen: 'Grupo UMA construyó una planta de ensamblaje en Pereira.',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('No');
    expect(out.evaluacion_temporal).toBe('🔴 Descarte');
    expect(out.motivo_descarte).toMatch(/recencia/i);
  });

  it('mantiene Sí cuando hay frase de fase futura aunque la fecha sea vieja', () => {
    const input = baseSi({
      fecha_senal:         '15/11/2024',
      descripcion_resumen: 'Grupo UMA inauguró planta en 2024 y planea invertir CAPEX 2027 en una fase 2.',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('Sí');
  });

  it('flips Sí→No cuando empresa no aparece en descripción', () => {
    const input = baseSi({
      descripcion_resumen: 'El sector logístico colombiano invertirá USD 100M en infraestructura.',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('No');
    expect(out.motivo_descarte).toMatch(/no mencionada/i);
  });

  it('flips Sí→No cuando URL contiene año viejo y no hay fase futura', () => {
    const input = baseSi({
      fuente_link:         'https://example.com/2023/06/uma',
      descripcion_resumen: 'Grupo UMA construyó una planta en 2023 con tecnología avanzada.',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('No');
  });

  it('mantiene Sí con fecha reciente, fase válida y empresa mencionada → 🟢 Válido', () => {
    const input = baseSi({
      total_criterios: 4,
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('Sí');
    expect(out.evaluacion_temporal).toBe('🟢 Válido');
  });

  it('marca como 🟡 Ambiguo cuando pasa filtros pero total_criterios < 3', () => {
    const input = baseSi({ total_criterios: 2 });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('Sí');
    expect(out.evaluacion_temporal).toBe('🟡 Ambiguo');
  });

  it('respeta entradas con radar_activo="No" sin re-evaluar', () => {
    const input = baseSi({
      radar_activo: 'No',
      motivo_descarte: 'Sin fuentes específicas',
    });
    const out = validateAgente1Result(input, TODAY);
    expect(out.radar_activo).toBe('No');
    expect(out.motivo_descarte).toBe('Sin fuentes específicas');
  });

  it('no muta el input original (pure function)', () => {
    const input = baseSi({
      descripcion_resumen: 'Grupo UMA inauguró planta.',
    });
    const snapshot = JSON.stringify(input);
    validateAgente1Result(input, TODAY);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  // ── Regla R4 con tokens — fix de "Grupo UMA (Colombia)" ────────────────────
  describe('R4 token-based empresa matching', () => {
    it('mantiene Sí cuando empresa con paréntesis matchea por token raíz', () => {
      // Caso real: empresa_evaluada="Grupo UMA (Colombia)" + descripción "Grupo UMA Colombia anunció..."
      const input = baseSi({
        empresa_evaluada:    'Grupo UMA (Colombia)',
        descripcion_resumen: 'Grupo UMA Colombia ha anunciado una inversión en un nuevo centro logístico autónomo de repuestos en La Tebaida, Quindío. CAPEX 2026.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('Sí');
    });

    it('mantiene Sí cuando empresa multi-palabra matchea por al menos un token', () => {
      const input = baseSi({
        empresa_evaluada:    'DHL Supply Chain Colombia',
        descripcion_resumen: 'DHL Supply Chain anunció inversión de USD 500M en LATAM con planes de CAPEX para 2026 en Colombia.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('Sí');
    });

    it('flips a No cuando NINGÚN token significativo de la empresa aparece', () => {
      const input = baseSi({
        empresa_evaluada:    'Aerocali S.A.',
        descripcion_resumen: 'El sector aeroportuario colombiano invertirá USD 100M en infraestructura general para 2026 con planes de CAPEX.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('No');
      expect(out.motivo_descarte).toMatch(/no mencionada/i);
    });

    it('ignora stopwords como "Grupo" — solo cuenta tokens reales', () => {
      // "Grupo UMA" → token significativo es "uma"; si descripción solo dice "Grupo" no matchea
      const input = baseSi({
        empresa_evaluada:    'Grupo UMA',
        descripcion_resumen: 'El grupo empresarial colombiano anunció inversiones futuras en CAPEX 2026 sin nombrar marcas.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('No');
    });

    it('ignora país como stopword: "(Colombia)" no cuenta como mención', () => {
      const input = baseSi({
        empresa_evaluada:    'Grupo UMA (Colombia)',
        descripcion_resumen: 'En Colombia, el sector industrial planea invertir USD 100M en CAPEX 2026.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('No');
    });

    it('soporta empresas con nombres ultra-cortos (3H, K&M)', () => {
      const input = baseSi({
        empresa_evaluada:    '3H',
        descripcion_resumen: '3H anunció una inversión en una nueva planta de cartón corrugado en México con CAPEX 2026.',
      });
      const out = validateAgente1Result(input, TODAY);
      expect(out.radar_activo).toBe('Sí');
    });
  });
});
