// tests/unit/sheetsAgente.test.ts
// Tests unitarios para lib/sheets-agente.ts
// Cubre: parseCSV, sort por fechaEscaneo, mocks, TIR badge key extraction

import { parseCSV, getMockClientes, getMockLogEmpresas } from '../../lib/sheets-agente';

// ── parseCSV ──────────────────────────────────────────────────────────────────

describe('parseCSV()', () => {
  it('parsea una fila simple con valores sin comillas', () => {
    const raw = 'Empresa A,TIR A,95,CAPEX,Resumen,USD 10M,6m,2026-04-10,https://url.com,2026-04-12';
    const rows = parseCSV(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('Empresa A');
    expect(rows[0][2]).toBe('95');
  });

  it('parsea campos entre comillas con coma interna', () => {
    const raw = '"Empresa A, S.A.S.",TIR B,80,Licitación,"Resumen con, coma",USD 5M,12m,2026-04-01,https://url.com,2026-04-10';
    const rows = parseCSV(raw);
    expect(rows[0][0]).toBe('Empresa A, S.A.S.');
    expect(rows[0][4]).toBe('Resumen con, coma');
  });

  it('parsea comillas escapadas ("")', () => {
    const raw = '"Empresa ""Especial""",TIR A,90,CAPEX,Resumen,USD 1M,6m,2026-04-01,https://url.com,2026-04-11';
    const rows = parseCSV(raw);
    expect(rows[0][0]).toBe('Empresa "Especial"');
  });

  it('ignora líneas vacías', () => {
    const raw = 'Empresa A,TIR A,95,CAPEX,Resumen,USD 10M,6m,2026-04-10,https://url.com,2026-04-12\n\n\nEmpresa B,TIR B,70,Retrofit,Resumen,USD 2M,12m,2026-04-05,https://url.com,2026-04-11';
    const rows = parseCSV(raw);
    expect(rows).toHaveLength(2);
  });

  it('parsea múltiples filas con CRLF', () => {
    const raw = 'Empresa A,TIR A,95\r\nEmpresa B,TIR B,80';
    const rows = parseCSV(raw);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('Empresa B');
  });

  it('retorna array vacío para string vacío', () => {
    const rows = parseCSV('');
    expect(rows).toHaveLength(0);
  });

  it('retorna array vacío para sólo saltos de línea', () => {
    const rows = parseCSV('\n\n\n');
    expect(rows).toHaveLength(0);
  });

  it('parsea fila con campos vacíos', () => {
    const raw = 'Empresa A,,95,,Resumen,,,,https://url.com,';
    const rows = parseCSV(raw);
    expect(rows[0][1]).toBe('');
    expect(rows[0][3]).toBe('');
  });
});

// ── getMockClientes ───────────────────────────────────────────────────────────

describe('getMockClientes()', () => {
  it('retorna array no vacío', () => {
    const rows = getMockClientes();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('cada fila tiene los campos requeridos', () => {
    const rows = getMockClientes();
    for (const row of rows) {
      expect(typeof row.empresa).toBe('string');
      expect(row.empresa.length).toBeGreaterThan(0);
      expect(typeof row.score).toBe('number');
      expect(typeof row.senal).toBe('string');
      expect(typeof row.fechaEscaneo).toBe('string');
    }
  });

  it('score está en rango 0-100', () => {
    const rows = getMockClientes();
    for (const row of rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
    }
  });
});

// ── getMockLogEmpresas ────────────────────────────────────────────────────────

describe('getMockLogEmpresas()', () => {
  it('retorna array no vacío', () => {
    const rows = getMockLogEmpresas();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('cada fila tiene los campos requeridos', () => {
    const rows = getMockLogEmpresas();
    for (const row of rows) {
      expect(typeof row.empresa).toBe('string');
      expect(row.empresa.length).toBeGreaterThan(0);
      expect(typeof row.radarActivo).toBe('string');
      expect(typeof row.motivoDescarte).toBe('string');
      expect(typeof row.fechaEscaneo).toBe('string');
    }
  });

  it('radarActivo es "Sí" o "No"', () => {
    const rows = getMockLogEmpresas();
    for (const row of rows) {
      expect(['Sí', 'No']).toContain(row.radarActivo);
    }
  });

  it('empresas sin señal tienen motivoDescarte no vacío', () => {
    const rows = getMockLogEmpresas();
    const sinSenal = rows.filter(r => r.radarActivo === 'No');
    for (const row of sinSenal) {
      expect(row.motivoDescarte.length).toBeGreaterThan(0);
    }
  });
});

// ── Lógica de sort por fechaEscaneo ──────────────────────────────────────────

describe('Orden descendente por fechaEscaneo', () => {
  function sortByFecha<T extends { fechaEscaneo: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
      const da = new Date(a.fechaEscaneo).getTime() || 0;
      const db = new Date(b.fechaEscaneo).getTime() || 0;
      return db - da;
    });
  }

  it('el más reciente queda primero', () => {
    const rows = [
      { empresa: 'A', fechaEscaneo: '2026-04-01' },
      { empresa: 'B', fechaEscaneo: '2026-04-12' },
      { empresa: 'C', fechaEscaneo: '2026-04-05' },
    ];
    const sorted = sortByFecha(rows);
    expect(sorted[0].empresa).toBe('B');
    expect(sorted[2].empresa).toBe('A');
  });

  it('filas con fecha inválida van al final (getTime → 0)', () => {
    const rows = [
      { empresa: 'A', fechaEscaneo: '2026-04-10' },
      { empresa: 'B', fechaEscaneo: '' },
      { empresa: 'C', fechaEscaneo: '2026-04-05' },
    ];
    const sorted = sortByFecha(rows);
    expect(sorted[0].empresa).toBe('A');
    expect(sorted[sorted.length - 1].empresa).toBe('B');
  });

  it('fechas iguales mantienen orden relativo estable', () => {
    const rows = [
      { empresa: 'A', fechaEscaneo: '2026-04-10' },
      { empresa: 'B', fechaEscaneo: '2026-04-10' },
    ];
    const sorted = sortByFecha(rows);
    expect(sorted).toHaveLength(2);
  });
});

// ── TIR badge key extraction ──────────────────────────────────────────────────

describe('TIR badge — extracción de clave', () => {
  function extractTirKey(tir: string): string {
    return tir.toUpperCase().replace(/^TIR\s+/, '').trim();
  }

  it('"A" → "A"', () => expect(extractTirKey('A')).toBe('A'));
  it('"TIR A" → "A"', () => expect(extractTirKey('TIR A')).toBe('A'));
  it('"TIR B" → "B"', () => expect(extractTirKey('TIR B')).toBe('B'));
  it('"TIR C" → "C"', () => expect(extractTirKey('TIR C')).toBe('C'));
  it('"tir a" → "A"', () => expect(extractTirKey('tir a')).toBe('A'));
  it('string vacío → ""', () => expect(extractTirKey('')).toBe(''));
});
