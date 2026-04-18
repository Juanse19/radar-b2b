import { describe, it, expect } from 'vitest';
import type { RadarV2Result, CompanyScanState } from '@/lib/radar-v2/types';

describe('RadarV2 types', () => {
  it('RadarV2Result has correct shape for active signal', () => {
    const r: RadarV2Result = {
      empresa_evaluada:    'FedEx Express',
      radar_activo:        'Sí',
      linea_negocio:       'Intralogística',
      tipo_senal:          'CAPEX Confirmado',
      pais:                'Brasil',
      empresa_o_proyecto:  'Hub São Paulo 2027',
      descripcion_resumen: 'FedEx anuncia expansión.',
      criterios_cumplidos: ['Inversión confirmada', 'Expansión física'],
      total_criterios:     2,
      ventana_compra:      '6-12 Meses',
      monto_inversion:     'USD 50 millones',
      fuente_link:         'https://newsroom.fedex.com/hub-sao-paulo',
      fuente_nombre:       'Web Corporativa / Operador (Peso 4)',
      fecha_senal:         '10/04/2026',
      evaluacion_temporal: '🟢 Válido',
      observaciones:       null,
      motivo_descarte:     '',
    };
    expect(r.radar_activo).toBe('Sí');
    expect(r.total_criterios).toBe(2);
  });

  it('CompanyScanState tracks status lifecycle', () => {
    const state: CompanyScanState = {
      company: { id: 1, name: 'DHL', country: 'Colombia' },
      status:  'scanning',
    };
    expect(state.status).toBe('scanning');
    expect(state.result).toBeUndefined();
  });
});
