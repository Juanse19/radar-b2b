// lib/sheets.ts
import type { ResultadoRadar, Empresa } from './types';

const SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || '';
const BASE_DE_DATOS_ID = process.env.BASE_DE_DATOS_SHEET_ID || '13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818';

// Lee el sheet usando la Sheets API v4 con API key pública (read-only)
// Para escritura se necesita OAuth — lectura funciona con API key si el sheet es público
// Si el sheet no es público, retorna datos mock para desarrollo

async function fetchSheetRange(sheetId: string, range: string): Promise<string[][]> {
  if (!SHEETS_API_KEY) {
    console.warn('GOOGLE_SHEETS_API_KEY no configurada — retornando datos mock');
    return [];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${SHEETS_API_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 min
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return data.values || [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export async function getResults(options?: {
  linea?: string;
  soloActivos?: boolean;
  limit?: number;
}): Promise<ResultadoRadar[]> {
  // Lee desde la fila 3 (fila 1=sección headers, fila 2=column headers, fila 3+=datos)
  const values = await fetchSheetRange(BASE_DE_DATOS_ID, 'Base de Datos!A2:Z500');

  if (values.length === 0) {
    // Retornar datos mock para desarrollo
    return getMockResults();
  }

  const headers = values[0];
  const rows = values.slice(1);

  const getCol = (row: string[], name: string): string => {
    const idx = headers.findIndex(h => h?.trim().toLowerCase() === name.toLowerCase());
    return idx >= 0 ? (row[idx] || '') : '';
  };

  let results: ResultadoRadar[] = rows
    .filter(row => row.some(cell => cell?.trim()))
    .map(row => ({
      empresa: getCol(row, 'COMPANY NAME'),
      pais: getCol(row, 'PAÍS'),
      linea: getCol(row, 'LÍNEA DE NEGOCIO') as ResultadoRadar['linea'],
      tier: getCol(row, 'TIER') as ResultadoRadar['tier'],
      radarActivo: (getCol(row, 'RADAR ACTIVO SI/NO') as 'Sí' | 'No') || 'No',
      tipoSenal: getCol(row, 'TIPO DE SEÑAL DE INVERSIÓN'),
      descripcion: getCol(row, 'DESCRIPCIÓN DE SEÑAL (RESUMEN)'),
      fuente: getCol(row, 'FUENTE DE LA SEÑAL'),
      fuenteUrl: getCol(row, 'FUENTE DE SEÑAL INFORMATIVO'),
      scoreRadar: Number(getCol(row, 'SCORE RADAR')) || 0,
      fechaEscaneo: getCol(row, 'Fecha Escaneo'),
      ventanaCompra: getCol(row, 'VENTANA DE COMPRA'),
      prioridadComercial: getCol(row, 'PRIORIDAD COMERCIAL'),
      motivoDescarte: getCol(row, 'MOTIVO DESCARTE'),
    }))
    .filter(r => r.empresa);

  if (options?.soloActivos) {
    results = results.filter(r => r.radarActivo === 'Sí');
  }

  if (options?.linea && options.linea !== 'ALL') {
    results = results.filter(r =>
      r.linea.toLowerCase().includes(options.linea!.toLowerCase())
    );
  }

  results.sort((a, b) => b.scoreRadar - a.scoreRadar);

  return results.slice(0, options?.limit ?? 200);
}

export async function getAllCompanies(): Promise<Empresa[]> {
  const values = await fetchSheetRange(BASE_DE_DATOS_ID, 'Base de Datos!A2:F300');

  if (values.length === 0) return getMockCompanies();

  const headers = values[0];
  const rows = values.slice(1);

  const getCol = (row: string[], name: string): string => {
    const idx = headers.findIndex(h => h?.trim().toLowerCase() === name.toLowerCase());
    return idx >= 0 ? (row[idx] || '') : '';
  };

  return rows
    .filter(row => row.some(cell => cell?.trim()))
    .map((row, i) => ({
      id: String(i + 1),
      nombre: getCol(row, 'COMPANY NAME'),
      pais: getCol(row, 'PAÍS'),
      linea: getCol(row, 'LÍNEA DE NEGOCIO') as Empresa['linea'],
      tier: getCol(row, 'TIER') as Empresa['tier'],
      dominio: getCol(row, 'DOMINIO'),
    }))
    .filter(c => c.nombre);
}

// Datos mock para desarrollo (cuando no hay API key o el sheet no es accesible)
function getMockResults(): ResultadoRadar[] {
  return [
    {
      empresa: 'VINCI Airports Brasil', pais: 'Brasil', linea: 'BHS', tier: 'Tier A',
      radarActivo: 'Sí', tipoSenal: 'Licitación Activa', scoreRadar: 85,
      descripcion: 'VINCI Airports lanza licitación para modernización del sistema BHS en Aeropuerto de Campinas GRU — inversión estimada USD 45M para 2026.',
      fuente: 'BNAmericas', fuenteUrl: 'https://www.bnamericas.com/...',
      fechaEscaneo: '19/03/2026', ventanaCompra: '6-12 Meses', prioridadComercial: '🔴 ALTA',
    },
    {
      empresa: 'Smurfit Kappa Colombia', pais: 'Colombia', linea: 'Cartón', tier: 'Tier A',
      radarActivo: 'Sí', tipoSenal: 'Expansión CAPEX', scoreRadar: 72,
      descripcion: 'Smurfit Kappa anuncia inversión de USD 30M para nueva línea corrugadora en planta Medellín.',
      fuente: 'Portafolio', fuenteUrl: 'https://portafolio.co/...',
      fechaEscaneo: '19/03/2026', ventanaCompra: '6-12 Meses', prioridadComercial: '🟡 MEDIA',
    },
    {
      empresa: 'CCR Aeroportos', pais: 'Brasil', linea: 'BHS', tier: 'Tier B-Alta',
      radarActivo: 'No', tipoSenal: 'Sin Señal', scoreRadar: 0,
      descripcion: '⚫ Sin señal de inversión detectada en fuentes consultadas.',
      fuente: '', fuenteUrl: '',
      fechaEscaneo: '19/03/2026', ventanaCompra: '> 12 Meses', prioridadComercial: '⚪ SIN PRIORIDAD',
      motivoDescarte: 'Sin información de inversión futura detectada.',
    },
  ];
}

function getMockCompanies(): Empresa[] {
  return [
    { id: '1', nombre: 'VINCI Airports Brasil', pais: 'Brasil', linea: 'BHS', tier: 'Tier A' },
    { id: '2', nombre: 'CCR Aeroportos', pais: 'Brasil', linea: 'BHS', tier: 'Tier B-Alta' },
    { id: '3', nombre: 'Smurfit Kappa Colombia', pais: 'Colombia', linea: 'Cartón', tier: 'Tier A' },
    { id: '4', nombre: 'Grupo Éxito', pais: 'Colombia', linea: 'Intralogística', tier: 'Tier A' },
    { id: '5', nombre: 'Aena Brasil', pais: 'Brasil', linea: 'BHS', tier: 'Tier A' },
  ];
}
