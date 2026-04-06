/**
 * Tests para la lógica de rotación por línea de negocio
 * Refleja el código en Code in JavaScript1 del workflow N8N
 */

// Replica la lógica de rotación del workflow
function getLineaDelDia(dayOfWeek: number): string | null {
  const lineaPorDia: Record<number, string | null> = {
    0: null,              // Domingo: Tier A todas
    1: 'BHS',            // Lunes
    2: 'Cartón',         // Martes
    3: 'Intralogística', // Miércoles
    4: 'BHS',            // Jueves
    5: 'Cartón',         // Viernes
    6: 'Intralogística'  // Sábado
  };
  return lineaPorDia[dayOfWeek];
}

interface Empresa {
  nombre: string;
  linea_negocio: string;
  tier: string;
}

function aplicarRotacion(empresas: Empresa[], dayOfWeek: number, batchSize: number): Empresa[] {
  const lineaHoy = getLineaDelDia(dayOfWeek);

  const tierOrder = (e: Empresa): number => {
    const t = e.tier.toUpperCase().replace(/\s/g, '');
    if (t === 'TIERA') return 0;
    if (t === 'TIERB-ALTA') return 1;
    if (t === 'TIERB') return 2;
    if (t === 'TIERC') return 3;
    return 99;
  };

  let seleccionados = [...empresas].sort((a, b) => tierOrder(a) - tierOrder(b));

  if (lineaHoy === null) {
    // Domingo: solo Tier A
    seleccionados = seleccionados.filter(e => e.tier.toUpperCase().replace(/\s/g,'') === 'TIERA');
  } else {
    const candidatos = seleccionados.filter(e => {
      const linea = e.linea_negocio.toLowerCase();
      const target = lineaHoy.toLowerCase();
      if (lineaHoy === 'Intralogística') {
        return linea.includes('intralog') || linea.includes('solumat') || linea === 'intralogistica';
      }
      // Normalizar ambos lados para comparar sin acentos
      const lineaNorm = linea.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const targetNorm = target.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return lineaNorm.includes(targetNorm);
    });

    // Fallback si no hay empresas de esa línea
    if (candidatos.length > 0) seleccionados = candidatos;
  }

  return seleccionados.slice(0, batchSize);
}

// Test data
const EMPRESAS_TEST: Empresa[] = [
  { nombre: 'VINCI Airports', linea_negocio: 'BHS', tier: 'Tier A' },
  { nombre: 'CCR Aeroportos', linea_negocio: 'BHS', tier: 'Tier B-Alta' },
  { nombre: 'Smurfit Kappa', linea_negocio: 'Cartón', tier: 'Tier A' },
  { nombre: 'Grupo Éxito', linea_negocio: 'Intralogística', tier: 'Tier A' },
  { nombre: 'Aena Brasil', linea_negocio: 'BHS', tier: 'Tier A' },
  { nombre: 'Falabella', linea_negocio: 'Intralogística', tier: 'Tier B-Alta' },
];

describe('Rotación por línea de negocio', () => {
  describe('getLineaDelDia()', () => {
    it('Lunes (1) → BHS', () => {
      expect(getLineaDelDia(1)).toBe('BHS');
    });
    it('Jueves (4) → BHS', () => {
      expect(getLineaDelDia(4)).toBe('BHS');
    });
    it('Martes (2) → Cartón', () => {
      expect(getLineaDelDia(2)).toBe('Cartón');
    });
    it('Viernes (5) → Cartón', () => {
      expect(getLineaDelDia(5)).toBe('Cartón');
    });
    it('Miércoles (3) → Intralogística', () => {
      expect(getLineaDelDia(3)).toBe('Intralogística');
    });
    it('Sábado (6) → Intralogística', () => {
      expect(getLineaDelDia(6)).toBe('Intralogística');
    });
    it('Domingo (0) → null (Tier A todas)', () => {
      expect(getLineaDelDia(0)).toBeNull();
    });
  });

  describe('aplicarRotacion()', () => {
    it('Lunes: solo empresas BHS', () => {
      const result = aplicarRotacion(EMPRESAS_TEST, 1, 10);
      expect(result.every(e => e.linea_negocio === 'BHS')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('Martes: solo empresas Cartón', () => {
      const result = aplicarRotacion(EMPRESAS_TEST, 2, 10);
      expect(result.every(e => e.linea_negocio === 'Cartón')).toBe(true);
    });

    it('Miércoles: solo empresas Intralogística', () => {
      const result = aplicarRotacion(EMPRESAS_TEST, 3, 10);
      expect(result.every(e =>
        e.linea_negocio.toLowerCase().includes('intralog') ||
        e.linea_negocio.toLowerCase().includes('solumat')
      )).toBe(true);
    });

    it('Domingo: solo Tier A (todas las líneas)', () => {
      const result = aplicarRotacion(EMPRESAS_TEST, 0, 10);
      expect(result.every(e => e.tier === 'Tier A')).toBe(true);
      // Debe incluir BHS y Cartón e Intralogística Tier A
      const lineas = new Set(result.map(e => e.linea_negocio));
      expect(lineas.size).toBeGreaterThan(1);
    });

    it('Respeta el batch_size', () => {
      const muchasEmpresas: Empresa[] = Array.from({ length: 100 }, (_, i) => ({
        nombre: `Empresa ${i}`, linea_negocio: 'BHS', tier: 'Tier A'
      }));
      const result = aplicarRotacion(muchasEmpresas, 1, 5);
      expect(result.length).toBe(5);
    });

    it('FALLBACK: si no hay empresas de la línea, usa todas por tier', () => {
      const soloBHS: Empresa[] = [
        { nombre: 'Aero A', linea_negocio: 'BHS', tier: 'Tier A' },
        { nombre: 'Aero B', linea_negocio: 'BHS', tier: 'Tier B-Alta' },
      ];
      // Martes = Cartón, pero no hay Cartón → fallback a todas
      const result = aplicarRotacion(soloBHS, 2, 10);
      expect(result.length).toBe(2); // retorna todas (fallback)
      expect(result[0].linea_negocio).toBe('BHS'); // con lo que hay
    });

    it('Ordena por tier: Tier A primero', () => {
      const result = aplicarRotacion(EMPRESAS_TEST, 1, 10); // BHS day
      const tierAFirst = result[0].tier === 'Tier A';
      expect(tierAFirst).toBe(true);
    });
  });
});
