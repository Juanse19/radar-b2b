import { describe, it, expect } from 'vitest';
import { parseAgente1Response } from '@/lib/comercial/schema';

const VALID_JSON = JSON.stringify({
  empresa_evaluada:    'DHL Supply Chain',
  radar_activo:        'Sí',
  linea_negocio:       'Intralogística',
  tipo_senal:          'Expansión / Nuevo Centro de Distribución',
  pais:                'Colombia',
  empresa_o_proyecto:  'CEDI Bogotá Sur 2026',
  descripcion_resumen: 'DHL Supply Chain anunció la construcción de un nuevo CEDI en Bogotá con inversión de USD 12 millones para automatizar operaciones de sorting y WMS en 2026.',
  criterios_cumplidos: ['Inversión confirmada', 'Expansión física', 'Proyecto específico'],
  total_criterios:     3,
  ventana_compra:      '0-6 Meses',
  monto_inversion:     'USD 12 millones',
  fuente_link:         'https://www.dhl.com/co-es/home/noticias/2026/cedi-bogota.html',
  fuente_nombre:       'Web Corporativa / Operador (Peso 4)',
  fecha_senal:         '15/03/2026',
  evaluacion_temporal: '🟢 Válido',
  observaciones:       null,
  motivo_descarte:     '',
});

describe('parseAgente1Response', () => {
  it('parses valid JSON correctly', () => {
    const result = parseAgente1Response(VALID_JSON);
    expect(result.empresa_evaluada).toBe('DHL Supply Chain');
    expect(result.radar_activo).toBe('Sí');
    expect(result.total_criterios).toBe(3);
    expect(result.criterios_cumplidos).toHaveLength(3);
    expect(result.monto_inversion).toBe('USD 12 millones');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + VALID_JSON + '\n```';
    const result = parseAgente1Response(wrapped);
    expect(result.empresa_evaluada).toBe('DHL Supply Chain');
  });

  it('extracts JSON embedded in prose', () => {
    const prose = 'Aquí está el resultado: ' + VALID_JSON + ' — fin.';
    const result = parseAgente1Response(prose);
    expect(result.radar_activo).toBe('Sí');
  });

  it('maps non-Sí radar_activo to No', () => {
    const noResult = JSON.stringify({ ...JSON.parse(VALID_JSON), radar_activo: 'No' });
    const result = parseAgente1Response(noResult);
    expect(result.radar_activo).toBe('No');
  });

  it('handles missing optional fields with defaults', () => {
    const minimal = JSON.stringify({
      empresa_evaluada: 'UPS',
      radar_activo:     'No',
      motivo_descarte:  'Hub inaugurado 2025; sin fases futuras.',
    });
    const result = parseAgente1Response(minimal);
    expect(result.empresa_evaluada).toBe('UPS');
    expect(result.radar_activo).toBe('No');
    expect(result.total_criterios).toBe(0);
    expect(result.criterios_cumplidos).toEqual([]);
    expect(result.monto_inversion).toBe('No reportado');
    expect(result.fuente_link).toBe('No disponible');
  });

  it('throws on missing empresa_evaluada', () => {
    const bad = JSON.stringify({ radar_activo: 'Sí' });
    expect(() => parseAgente1Response(bad)).toThrow('Missing field: empresa_evaluada');
  });

  it('throws when not a JSON object', () => {
    expect(() => parseAgente1Response('not json at all')).toThrow();
  });
});
