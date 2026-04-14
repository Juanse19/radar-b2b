// lib/sheets-agente.ts
// Lee datos del Google Sheet de resultados del agente (CSV público, sin API key).
// Dos pestañas: "Clientes" (señales activas) y "Log Clientes" (todas las empresas).

import type { ClienteSheetRow, LogEmpresaRow } from './types';

const SHEET_ID = process.env.LOG_SHEET_ID || '1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo';

const CSV_CLIENTES = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1092152610`;
const CSV_LOG      = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1633519243`;

// ── CSV parser (RFC 4180 básico) ──────────────────────────────────────────────

/**
 * Parsea un CSV simple respetando campos entre comillas con comas internas.
 * Retorna array de filas, cada fila es array de strings.
 */
export function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // escaped quote
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    rows.push(fields);
  }

  return rows;
}

// ── Fetch con timeout ─────────────────────────────────────────────────────────

async function fetchCSV(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 minutos
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Clientes ──────────────────────────────────────────────────────────────────

/**
 * Lee la pestaña "Clientes" del sheet de resultados del agente.
 * Columnas esperadas (fila 1): Empresa, TIR, Score, Señal, Resumen Hallazgo,
 *   Monto Estimado, Horizonte, Fecha Noticia, URL Fuente, Fecha Escaneo
 * Retorna filas en orden descendente por Fecha Escaneo.
 */
export async function getClientesFromSheet(): Promise<ClienteSheetRow[]> {
  try {
    const raw = await fetchCSV(CSV_CLIENTES);
    const rows = parseCSV(raw);
    if (rows.length < 2) return getMockClientes();

    const [, ...dataRows] = rows; // skip header row

    const mapped: ClienteSheetRow[] = dataRows
      .filter(r => r[0]?.trim())
      .map(r => ({
        empresa:         (r[0] ?? '').trim(),
        tir:             (r[1] ?? '').trim(),
        score:           parseFloat(r[2] ?? '0') || 0,
        senal:           (r[3] ?? '').trim(),
        resumenHallazgo: (r[4] ?? '').trim(),
        montoEstimado:   (r[5] ?? '').trim(),
        horizonte:       (r[6] ?? '').trim(),
        fechaNoticia:    (r[7] ?? '').trim(),
        urlFuente:       (r[8] ?? '').trim(),
        fechaEscaneo:    (r[9] ?? '').trim(),
      }));

    // Orden descendente por fechaEscaneo (más reciente primero)
    return mapped.sort((a, b) => {
      const da = new Date(a.fechaEscaneo).getTime() || 0;
      const db = new Date(b.fechaEscaneo).getTime() || 0;
      return db - da;
    });
  } catch {
    console.warn('[sheets-agente] Error al leer pestaña Clientes — usando mock');
    return getMockClientes();
  }
}

// ── Log Clientes ──────────────────────────────────────────────────────────────

/**
 * Lee la pestaña "Log Clientes" del sheet de resultados del agente.
 * Columnas esperadas (fila 1): Empresa, Radar Activo, Motivo de Descarte,
 *   Fecha Noticia, URL Fuente, Fecha Escaneo
 * Retorna filas en orden descendente por Fecha Escaneo.
 */
export async function getLogEmpresasFromSheet(): Promise<LogEmpresaRow[]> {
  try {
    const raw = await fetchCSV(CSV_LOG);
    const rows = parseCSV(raw);
    if (rows.length < 2) return getMockLogEmpresas();

    const [, ...dataRows] = rows; // skip header row

    const mapped: LogEmpresaRow[] = dataRows
      .filter(r => r[0]?.trim())
      .map(r => ({
        empresa:        (r[0] ?? '').trim(),
        radarActivo:    (r[1] ?? '').trim(),
        motivoDescarte: (r[2] ?? '').trim(),
        fechaNoticia:   (r[3] ?? '').trim(),
        urlFuente:      (r[4] ?? '').trim(),
        fechaEscaneo:   (r[5] ?? '').trim(),
      }));

    // Orden descendente por fechaEscaneo
    return mapped.sort((a, b) => {
      const da = new Date(a.fechaEscaneo).getTime() || 0;
      const db = new Date(b.fechaEscaneo).getTime() || 0;
      return db - da;
    });
  } catch {
    console.warn('[sheets-agente] Error al leer pestaña Log — usando mock');
    return getMockLogEmpresas();
  }
}

// ── Mocks para desarrollo ─────────────────────────────────────────────────────

export function getMockClientes(): ClienteSheetRow[] {
  return [
    {
      empresa: 'Grupo Nutresa', tir: 'A', score: 88,
      senal: 'CAPEX Confirmado',
      resumenHallazgo: 'Grupo Nutresa anuncia expansión de planta de alimentos en Medellín con inversión de USD 40M para 2026.',
      montoEstimado: 'USD 40M', horizonte: '6-12 meses',
      fechaNoticia: '2026-04-10', urlFuente: 'https://portafolio.co/negocios/nutresa-expansion',
      fechaEscaneo: '2026-04-12',
    },
    {
      empresa: 'VINCI Airports Brasil', tir: 'A', score: 82,
      senal: 'Licitación',
      resumenHallazgo: 'VINCI lanza licitación para renovación del sistema BHS en Aeropuerto de Campinas.',
      montoEstimado: 'USD 45M', horizonte: '< 6 meses',
      fechaNoticia: '2026-04-08', urlFuente: 'https://bnamericas.com/vinci-bhs',
      fechaEscaneo: '2026-04-11',
    },
    {
      empresa: 'Smurfit Kappa Colombia', tir: 'B', score: 67,
      senal: 'Retrofit',
      resumenHallazgo: 'Smurfit Kappa modernizará línea corrugadora en planta Bogotá.',
      montoEstimado: 'USD 8M', horizonte: '12-18 meses',
      fechaNoticia: '2026-04-05', urlFuente: 'https://smurfitkappa.com/co/news',
      fechaEscaneo: '2026-04-10',
    },
  ];
}

export function getMockLogEmpresas(): LogEmpresaRow[] {
  return [
    {
      empresa: 'Grupo Nutresa', radarActivo: 'Sí',
      motivoDescarte: '',
      fechaNoticia: '2026-04-10', urlFuente: 'https://portafolio.co/nutresa',
      fechaEscaneo: '2026-04-12',
    },
    {
      empresa: 'Cementos Argos', radarActivo: 'No',
      motivoDescarte: 'Sin señal de inversión en fuentes consultadas.',
      fechaNoticia: '', urlFuente: '',
      fechaEscaneo: '2026-04-11',
    },
    {
      empresa: 'VINCI Airports Brasil', radarActivo: 'Sí',
      motivoDescarte: '',
      fechaNoticia: '2026-04-08', urlFuente: 'https://bnamericas.com/vinci-bhs',
      fechaEscaneo: '2026-04-11',
    },
    {
      empresa: 'Avianca Holdings', radarActivo: 'No',
      motivoDescarte: 'Empresa en proceso de reestructuración — prioridad baja.',
      fechaNoticia: '', urlFuente: '',
      fechaEscaneo: '2026-04-10',
    },
  ];
}
