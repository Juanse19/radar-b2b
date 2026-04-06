/**
 * Tests para filtrado y normalización de empresas
 */

function normalizarLinea(lineaRaw: string, sectorRaw: string): string {
  const l = lineaRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const s = sectorRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (l.includes('aeropuerto') || l.includes('bhs') || l.includes('airport') || l.includes('aviation')) return 'BHS';
  if (l.includes('carton') || l.includes('papel') || l.includes('corrugado')) return 'Cartón';
  if (l.includes('intralogistic') || l.includes('logistic') || l.includes('cedi')) return 'Intralogística';
  if (s.includes('airlines') || s.includes('aviation') || s.includes('airport')) return 'BHS';
  if (s.includes('carton') || s.includes('papel') || s.includes('packaging')) return 'Cartón';
  if (s.includes('logistic') || s.includes('retail') || s.includes('ecommerce')) return 'Intralogística';
  return 'General';
}

function filtrarPorLinea(empresas: Array<{nombre: string; linea: string}>, lineaTarget: string): Array<{nombre: string; linea: string}> {
  if (lineaTarget === 'ALL') return empresas;
  return empresas.filter(e =>
    e.linea.toLowerCase().includes(lineaTarget.toLowerCase()) ||
    e.linea.toLowerCase().includes(lineaTarget.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

describe('Filtrado y normalización de empresas', () => {
  describe('normalizarLinea()', () => {
    it('"BHS" → BHS', () => {
      expect(normalizarLinea('BHS', '')).toBe('BHS');
    });
    it('"aeropuerto" → BHS', () => {
      expect(normalizarLinea('aeropuerto', '')).toBe('BHS');
    });
    it('"Cartón" (con tilde) → Cartón', () => {
      expect(normalizarLinea('Cartón', '')).toBe('Cartón');
    });
    it('"carton" (sin tilde) → Cartón', () => {
      expect(normalizarLinea('carton', '')).toBe('Cartón');
    });
    it('"intralogística" → Intralogística', () => {
      expect(normalizarLinea('intralogística', '')).toBe('Intralogística');
    });
    it('sector "Airlines/Aviation" → BHS', () => {
      expect(normalizarLinea('', 'Airlines/Aviation')).toBe('BHS');
    });
    it('sector "Retail" → Intralogística', () => {
      expect(normalizarLinea('', 'Retail')).toBe('Intralogística');
    });
    it('desconocido → General', () => {
      expect(normalizarLinea('minería', 'mining')).toBe('General');
    });
  });

  describe('filtrarPorLinea()', () => {
    const empresas = [
      { nombre: 'VINCI Airports', linea: 'BHS' },
      { nombre: 'Smurfit Kappa', linea: 'Cartón' },
      { nombre: 'Grupo Éxito', linea: 'Intralogística' },
    ];

    it('Filtrar BHS → solo aeropuertos', () => {
      const r = filtrarPorLinea(empresas, 'BHS');
      expect(r).toHaveLength(1);
      expect(r[0].nombre).toBe('VINCI Airports');
    });

    it('Filtrar ALL → todas', () => {
      const r = filtrarPorLinea(empresas, 'ALL');
      expect(r).toHaveLength(3);
    });

    it('Filtrar Intralogística → logística', () => {
      const r = filtrarPorLinea(empresas, 'Intralogística');
      expect(r).toHaveLength(1);
      expect(r[0].nombre).toBe('Grupo Éxito');
    });
  });
});
