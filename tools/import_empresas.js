/**
 * import_empresas.js
 *
 * Importa el CSV de empresas (~500 filas) a la tabla radar.empresas en Supabase.
 *
 * Uso:
 *   node import_empresas.js <ruta_al_csv>
 *
 * Ejemplo:
 *   node import_empresas.js "C:\Users\Juan\Downloads\empresas.csv"
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL       = https://supabase.valparaiso.cafe
 *   SUPABASE_ANON_KEY  = eyJhbGci...
 *
 * O pasar directamente en el script más abajo.
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://supabase.valparaiso.cafe';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIyMDAwMDAwMDB9.vmRZjbfVld0zl_n0g50Rvy7RMgsOa_h2lJQ9OcmZFU4';

const BATCH_SIZE = 50;  // rows per upsert call

// ── Mapeo de líneas ──────────────────────────────────────────────────────────
const LINEA_MAP = {
  'bhs':                  'BHS',
  'carton corrugado':     'Cartón',
  'cartón corrugado':     'Cartón',
  'carton':               'Cartón',
  'cartón':               'Cartón',
  'intralogistica':       'Intralogística',
  'intralogística':       'Intralogística',
  'intralogistics':       'Intralogística',
  'solumat':              'Solumat',
};

function mapLinea(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return LINEA_MAP[key] || raw.trim();
}

// ── Fix encoding UTF-8 BOM / Latin-1 → UTF-8 ────────────────────────────────
function fixEncoding(str) {
  // Si el string tiene secuencias latin-1 mal interpretadas (Ã© = é, etc.)
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

function cleanStr(s) {
  if (!s) return null;
  const cleaned = s.trim().replace(/^\uFEFF/, ''); // quita BOM
  if (!cleaned) return null;
  return cleaned;
}

// ── Parser CSV simple (soporta comillas y comas dentro de campos) ─────────────
function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  const header = splitCSVLine(lines[0]).map(h => cleanStr(h) || '');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? cleanStr(values[idx]) : null;
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Detectar columnas del CSV ─────────────────────────────────────────────────
function detectColumns(headers) {
  const find = (...candidates) => {
    for (const c of candidates) {
      const h = headers.find(h => h.toLowerCase().includes(c.toLowerCase()));
      if (h) return h;
    }
    return null;
  };
  return {
    nombre:  find('company name', 'company_name', 'nombre', 'empresa', 'razon social', 'name'),
    dominio: find('domain', 'dominio', 'company_domain', 'website', 'url'),
    url:     find('company_url', 'url', 'website', 'web'),
    pais:    find('country', 'pais', 'país', 'country_code'),
    ciudad:  find('city', 'ciudad', 'location'),
    linea:   find('linea', 'línea', 'linea_detectada', 'line', 'business_line', 'segmento'),
    tier:    find('tier', 'nivel'),
  };
}

// ── Transformar fila CSV → registro DB ───────────────────────────────────────
function rowToRecord(row, cols) {
  const nombre = cleanStr(row[cols.nombre]);
  if (!nombre) return null;

  const lineaRaw = cleanStr(row[cols.linea]);
  const linea    = lineaRaw ? mapLinea(lineaRaw) : null;
  if (!linea) return null;  // descarta filas sin línea válida

  return {
    company_name:   nombre,
    company_domain: cols.dominio ? cleanStr(row[cols.dominio]) : null,
    company_url:    cols.url     ? cleanStr(row[cols.url])     : null,
    pais:           cols.pais    ? cleanStr(row[cols.pais])    : null,
    ciudad:         cols.ciudad  ? cleanStr(row[cols.ciudad])  : null,
    linea_negocio:  linea,
    linea_raw:      lineaRaw,
    tier:           (cols.tier && cleanStr(row[cols.tier])) || 'Tier B',
    status:         'pending',
  };
}

// ── Upsert batch a Supabase ──────────────────────────────────────────────────
async function upsertBatch(records) {
  const url = `${SUPABASE_URL}/rest/v1/empresas`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'apikey':           SUPABASE_ANON_KEY,
      'Authorization':   `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Profile': 'radar',
      'Prefer':          'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(records),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text.substring(0, 300)}`);
  }

  return await res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: node import_empresas.js <ruta_al_csv>');
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`Archivo no encontrado: ${absPath}`);
    process.exit(1);
  }

  console.log(`\nLeyendo CSV: ${absPath}`);
  const rawContent = fs.readFileSync(absPath);

  // Intentar detectar encoding
  let content;
  const hasBOM = rawContent[0] === 0xEF && rawContent[1] === 0xBB && rawContent[2] === 0xBF;
  if (hasBOM) {
    console.log('Detectado BOM UTF-8 — leyendo como UTF-8');
    content = rawContent.toString('utf8').replace(/^\uFEFF/, '');
  } else {
    // Probar UTF-8, si falla usar latin1
    try {
      content = rawContent.toString('utf8');
      // Validar que no haya secuencias rotas comunes
      if (content.includes('Ã©') || content.includes('Ã³') || content.includes('Ã±')) {
        throw new Error('encoding_issue');
      }
    } catch {
      console.log('Encoding issue detectado — usando Latin-1 → UTF-8');
      content = rawContent.toString('latin1');
    }
  }

  const rows = parseCSV(content);
  console.log(`Filas en CSV: ${rows.length}`);

  if (rows.length === 0) {
    console.error('CSV vacío o sin filas válidas.');
    process.exit(1);
  }

  const headers = Object.keys(rows[0]);
  console.log(`Columnas detectadas: ${headers.join(', ')}`);

  const cols = detectColumns(headers);
  console.log('\nMapeo de columnas:');
  Object.entries(cols).forEach(([key, val]) => {
    console.log(`  ${key.padEnd(10)} → ${val || '(no detectado)'}`);
  });

  if (!cols.nombre) {
    console.error('\nNo se detectó la columna de nombre de empresa. Verifica el CSV.');
    process.exit(1);
  }
  if (!cols.linea) {
    console.error('\nNo se detectó la columna de línea de negocio. Verifica el CSV.');
    process.exit(1);
  }

  // Transformar
  const records = rows
    .map(row => rowToRecord(row, cols))
    .filter(Boolean);

  console.log(`\nRegistros válidos: ${records.length} (descartados: ${rows.length - records.length})`);

  // Mostrar distribución por línea
  const dist = {};
  records.forEach(r => {
    dist[r.linea_negocio] = (dist[r.linea_negocio] || 0) + 1;
  });
  console.log('\nDistribución por línea:');
  Object.entries(dist).forEach(([l, n]) => console.log(`  ${l.padEnd(20)} ${n}`));

  // Upsert en batches
  console.log(`\nImportando en lotes de ${BATCH_SIZE}...`);
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)} (${batch.length} filas)... `);
    try {
      await upsertBatch(batch);
      process.stdout.write('OK\n');
      inserted += batch.length;
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
    }
  }

  console.log(`\nImportación completada: ${inserted}/${records.length} registros.`);
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
