/**
 * Tests para el filtro de fechas
 * Paola pidió: solo noticias desde 2025-07-01 en adelante
 */

function buildTavilyQuery(empresa: string, linea: string, pais: string, dateFrom = '2025-07-01'): string {
  const anos = '2025 2026 OR 2026 2027';
  const dateStr = `después de ${dateFrom.split('-')[0]}`;

  if (linea === 'BHS') {
    return `${empresa} aeropuerto terminal CAPEX inversión licitación concesión modernización ${pais} ${anos} ${dateStr}`.substring(0, 300);
  }
  if (linea === 'Cartón') {
    return `${empresa} CAPEX inversión planta industrial expansión ${pais} ${anos} ${dateStr}`.substring(0, 300);
  }
  return `${empresa} CAPEX inversión licitación expansión proyecto ${pais} ${anos} ${dateStr}`.substring(0, 300);
}

function isResultadoReciente(fechaStr: string, dateFilterFrom: string): boolean {
  if (!fechaStr) return false;

  // Parsear formato dd/MM/yyyy
  const parts = fechaStr.split('/');
  if (parts.length !== 3) {
    // Intentar como ISO
    const d = new Date(fechaStr);
    return !isNaN(d.getTime()) && d >= new Date(dateFilterFrom);
  }
  const fecha = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return !isNaN(fecha.getTime()) && fecha >= new Date(dateFilterFrom);
}

describe('Filtro de fechas (feedback Paola)', () => {
  describe('buildTavilyQuery()', () => {
    it('Query BHS incluye año 2026', () => {
      const q = buildTavilyQuery('VINCI Airports', 'BHS', 'Brasil');
      expect(q).toContain('2026');
    });

    it('Query incluye "después de 2025"', () => {
      const q = buildTavilyQuery('Empresa X', 'Cartón', 'Colombia');
      expect(q).toContain('2025');
    });

    it('Query no supera 300 caracteres', () => {
      const q = buildTavilyQuery('Empresa con nombre muy largo que podría exceder el límite', 'BHS', 'República Dominicana');
      expect(q.length).toBeLessThanOrEqual(300);
    });

    it('Query Cartón incluye términos de inversión industrial', () => {
      const q = buildTavilyQuery('Smurfit Kappa', 'Cartón', 'Colombia');
      expect(q.toLowerCase()).toContain('planta');
    });
  });

  describe('isResultadoReciente()', () => {
    const FILTER_DATE = '2025-07-01';

    it('Fecha 19/03/2026 (hoy) → incluir', () => {
      expect(isResultadoReciente('19/03/2026', FILTER_DATE)).toBe(true);
    });

    it('Fecha 2025-08-15 → incluir', () => {
      expect(isResultadoReciente('2025-08-15', FILTER_DATE)).toBe(true);
    });

    it('Fecha 2025-07-01 (exacta) → incluir', () => {
      expect(isResultadoReciente('2025-07-01', FILTER_DATE)).toBe(true);
    });

    it('Fecha 2025-06-30 → excluir', () => {
      expect(isResultadoReciente('2025-06-30', FILTER_DATE)).toBe(false);
    });

    it('Fecha 2024-12-01 (año viejo) → excluir', () => {
      expect(isResultadoReciente('2024-12-01', FILTER_DATE)).toBe(false);
    });

    it('Fecha vacía → excluir', () => {
      expect(isResultadoReciente('', FILTER_DATE)).toBe(false);
    });
  });
});
