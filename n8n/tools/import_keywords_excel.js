/**
 * import_keywords_excel.js
 *
 * Importa keywords desde PalabrasClave_PorLineaNegocio.xlsx a Supabase.
 *
 * Prerequisito: npm install xlsx (en la carpeta n8n/tools o globalmente)
 *   cd "C:\Users\Juan\Documents\Agentic Workflows\clients\n8n\tools"
 *   npm install xlsx
 *
 * Uso: node import_keywords_excel.js [--dry-run]
 *
 * El archivo Excel tiene una hoja por sub-línea (o columnas que indican la sub-línea).
 * Estructura esperada (detectada automáticamente):
 *   Columna A: Palabra clave
 *   Columna B: Tipo (senal | producto | sector | exclusion) — opcional, default: senal
 *   Columna C: Peso (1-5) — opcional, default: 1
 *   Columna D: Idioma (es | en | pt) — opcional, default: es
 *
 * Si el Excel tiene hojas separadas por sub-línea, el nombre de la hoja se usa para
 * determinar la sub-línea. Si tiene una sola hoja con columna "sub_linea", se usa esa.
 */

const path  = require('path');
const https = require('https');
const fs    = require('fs');

const EXCEL_PATH   = path.join(__dirname, '../../docs/PalabrasClave_PorLineaNegocio.xlsx');
const SUPABASE_URL = 'https://supabase.valparaiso.cafe';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzU2NzI2NzcsImV4cCI6MTkzMzM1MjY3N30.EcqvysQnH7ZrGAz2OJJnUQVYYS1qsRlEhnb9xjbqFuQ';
const DRY_RUN      = process.argv.includes('--dry-run');

// ── Mapa de nombres de hoja → código de sub-línea ────────────────────────────
const SHEET_TO_SUBLINEA = {
  // Variantes en español
  'aeropuertos':           'aeropuertos',
  'bhs':                   'aeropuertos',
  'bhs aeropuertos':       'aeropuertos',
  'cargo':                 'cargo_uld',
  'cargo uld':             'cargo_uld',
  'carga':                 'cargo_uld',
  'carton':                'carton_corrugado',
  'cartón':                'carton_corrugado',
  'carton corrugado':      'carton_corrugado',
  'cartón corrugado':      'carton_corrugado',
  'papel':                 'carton_corrugado',
  'corrugado':             'carton_corrugado',
  'final linea':           'final_linea',
  'final de linea':        'final_linea',
  'final de línea':        'final_linea',
  'intralogistica':        'final_linea',
  'intralogística':        'final_linea',
  'motos':                 'ensambladoras_motos',
  'ensambladoras':         'ensambladoras_motos',
  'ensambladoras motos':   'ensambladoras_motos',
  'solumat':               'solumat',
  'plasticos':             'solumat',
  'plásticos':             'solumat',
  'materiales':            'solumat',
};

function normalizeSheetName(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveSubLinea(sheetName) {
  const norm = normalizeSheetName(sheetName);
  return SHEET_TO_SUBLINEA[norm] || null;
}

// ── Validar tipo y peso ───────────────────────────────────────────────────────
function validateTipo(t) {
  const valid = ['senal', 'producto', 'sector', 'exclusion', 'señal'];
  const norm = (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm === 'señal' || norm === 'senal') return 'senal';
  return valid.includes(norm) ? norm : 'senal';
}

function validatePeso(p) {
  const n = parseInt(p);
  if (isNaN(n)) return 1;
  return Math.max(-5, Math.min(5, n));
}

// ── HTTP helper para Supabase pg/query ────────────────────────────────────────
function supabaseQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql, params: [] });
    const url  = new URL(`${SUPABASE_URL}/pg/query`);
    const req  = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Obtener IDs de sub-líneas desde Supabase ──────────────────────────────────
async function fetchSubLineaIds() {
  const res = await supabaseQuery(
    'SELECT id, codigo FROM matec_radar.sub_lineas_negocio ORDER BY id'
  );
  if (res.status !== 200) {
    throw new Error(`No se pudo consultar sub_lineas_negocio: ${res.status} ${res.body}`);
  }
  const data = JSON.parse(res.body);
  const rows  = data.rows || data || [];
  const map   = {};
  for (const r of rows) {
    const id = r.id || r[0];
    const codigo = r.codigo || r[1];
    map[codigo] = id;
  }
  return map;
}

// ── Parsear Excel ─────────────────────────────────────────────────────────────
function parseExcel() {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('❌ Módulo "xlsx" no encontrado.');
    console.error('   Ejecuta: cd "C:\\Users\\Juan\\Documents\\Agentic Workflows\\clients\\n8n\\tools" && npm install xlsx');
    process.exit(1);
  }

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Archivo no encontrado: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  console.log(`📂 Archivo leído: ${path.basename(EXCEL_PATH)}`);
  console.log(`   Hojas: ${workbook.SheetNames.join(', ')}`);

  const keywords = []; // Array de { sub_linea_codigo, palabra, tipo, peso, idioma }

  for (const sheetName of workbook.SheetNames) {
    const subLinea = resolveSubLinea(sheetName);
    const sheet    = workbook.Sheets[sheetName];
    const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length === 0) {
      console.log(`  ⚠ Hoja "${sheetName}": vacía`);
      continue;
    }

    // Detectar si la primera fila es encabezado
    const firstRow = rows[0].map(c => String(c).toLowerCase().trim());
    const hasHeader = firstRow.some(c =>
      ['palabra', 'keyword', 'tipo', 'type', 'peso', 'weight'].includes(c)
    );

    const dataRows = hasHeader ? rows.slice(1) : rows;
    let colPalabra = 0, colTipo = 1, colPeso = 2, colIdioma = 3, colSubLinea = -1;

    if (hasHeader) {
      firstRow.forEach((c, i) => {
        if (['palabra', 'keyword', 'termino', 'term'].includes(c)) colPalabra = i;
        if (['tipo', 'type'].includes(c)) colTipo = i;
        if (['peso', 'weight'].includes(c)) colPeso = i;
        if (['idioma', 'language', 'lang'].includes(c)) colIdioma = i;
        if (['sub_linea', 'sublinea', 'linea'].includes(c)) colSubLinea = i;
      });
    }

    let count = 0;
    for (const row of dataRows) {
      const palabra = String(row[colPalabra] || '').trim();
      if (!palabra || palabra.length < 2) continue;

      const tipo   = validateTipo(row[colTipo]);
      const peso   = validatePeso(row[colPeso] || 1);
      const idioma = String(row[colIdioma] || 'es').trim().substring(0, 2).toLowerCase() || 'es';

      // Determinar sub-línea
      let sl = subLinea;
      if (!sl && colSubLinea >= 0) {
        sl = resolveSubLinea(String(row[colSubLinea] || ''));
      }

      if (!sl) {
        // Si la hoja no tiene nombre reconocible y no hay columna, intentar por nombre de hoja
        console.log(`  ⚠ "${sheetName}" → sub-línea no reconocida (saltando "${palabra}")`);
        continue;
      }

      keywords.push({ sub_linea_codigo: sl, palabra, tipo, peso, idioma });
      count++;
    }

    console.log(`  ✔ Hoja "${sheetName}" → sub-línea "${subLinea || 'múltiple'}" → ${count} keywords`);
  }

  return keywords;
}

// ── Insertar en Supabase ──────────────────────────────────────────────────────
async function insertKeywords(keywords, subLineaIds) {
  let inserted = 0, updated = 0, skipped = 0;

  // Procesar en lotes de 50
  const batchSize = 50;
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const validBatch = batch.filter(k => subLineaIds[k.sub_linea_codigo]);

    if (validBatch.length === 0) {
      skipped += batch.length;
      continue;
    }

    const esc = s => "'" + String(s || '').replace(/'/g, "''") + "'";

    const values = validBatch.map(k => {
      const slId = subLineaIds[k.sub_linea_codigo];
      return `(${slId}, ${esc(k.palabra)}, ${esc(k.idioma)}, ${esc(k.tipo)}, ${k.peso}, TRUE)`;
    }).join(',\n  ');

    const sql = `
INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
VALUES
  ${values}
ON CONFLICT (sub_linea_id, palabra, idioma, tipo)
DO UPDATE SET
  peso   = EXCLUDED.peso,
  activo = TRUE;`;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Batch ${Math.floor(i/batchSize)+1}: ${validBatch.length} rows`);
      inserted += validBatch.length;
    } else {
      const res = await supabaseQuery(sql);
      if (res.status === 200) {
        inserted += validBatch.length;
      } else {
        console.error(`  ✗ Batch error: ${res.status} ${res.body.substring(0, 200)}`);
        skipped += validBatch.length;
      }
    }
  }

  return { inserted, updated, skipped };
}

// ── Verificación final ────────────────────────────────────────────────────────
async function verifyCount() {
  const res = await supabaseQuery(
    'SELECT COUNT(*) as total FROM matec_radar.palabras_clave_por_linea WHERE activo = TRUE'
  );
  if (res.status !== 200) return null;
  const data = JSON.parse(res.body);
  const rows = data.rows || data || [];
  return parseInt(rows[0]?.total || rows[0]?.[0] || 0);
}

// ── IDs conocidos de sub-líneas (del seed 20260408_003_seed_catalogos.sql) ────
const KNOWN_SUBLINEA_IDS = {
  aeropuertos:         1,
  cargo_uld:           2,
  carton_corrugado:    3,
  final_linea:         4,
  ensambladoras_motos: 5,
  solumat:             6,
};

// ── Generar SQL para ejecutar manualmente en Supabase Dashboard ───────────────
function generateSql(keywords, subLineaIds) {
  const esc = s => "'" + String(s || '').replace(/'/g, "''") + "'";
  const validKw = keywords.filter(k => subLineaIds[k.sub_linea_codigo]);
  const values  = validKw.map(k =>
    `  (${subLineaIds[k.sub_linea_codigo]}, ${esc(k.palabra)}, ${esc(k.idioma)}, ${esc(k.tipo)}, ${k.peso}, TRUE)`
  ).join(',\n');

  return `-- ============================================================
-- Keywords importadas desde PalabrasClave_PorLineaNegocio.xlsx
-- Generado: ${new Date().toISOString()}  |  Total: ${validKw.length}
-- Ejecutar en: https://supabase.valparaiso.cafe → SQL Editor
-- ============================================================

INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
VALUES
${values}
ON CONFLICT (sub_linea_id, palabra, idioma, tipo)
DO UPDATE SET peso = EXCLUDED.peso, activo = TRUE;

-- Verificación
SELECT sl.codigo, COUNT(*) as total
FROM matec_radar.palabras_clave_por_linea p
JOIN matec_radar.sub_lineas_negocio sl ON p.sub_linea_id = sl.id
WHERE p.activo = TRUE
GROUP BY sl.codigo ORDER BY sl.codigo;
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const GENERATE_SQL = process.argv.includes('--sql') || DRY_RUN;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Import Keywords Excel → Supabase (Sprint F2)                 ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Modo: ${GENERATE_SQL ? 'GENERAR SQL (manual)' : 'PRODUCCIÓN'}`);
  console.log(`Excel: ${EXCEL_PATH}`);
  console.log('');

  // IDs de sub-líneas — usar conocidos si no se puede consultar Supabase
  let subLineaIds = { ...KNOWN_SUBLINEA_IDS };
  if (!GENERATE_SQL) {
    try {
      console.log('Consultando sub-líneas en Supabase...');
      const fetched = await fetchSubLineaIds();
      if (Object.keys(fetched).length > 0) {
        subLineaIds = fetched;
        console.log(`  IDs: ${Object.entries(subLineaIds).map(([k,v])=>`${k}=${v}`).join(', ')}`);
      }
    } catch (e) {
      console.log(`  ⚠ Supabase no accesible (${e.message}). Usando IDs del seed.`);
    }
  } else {
    console.log(`  Usando IDs del seed: ${Object.entries(subLineaIds).map(([k,v])=>`${k}=${v}`).join(', ')}`);
  }

  console.log('');

  // 2. Parsear Excel
  console.log('Parseando Excel...');
  const keywords = parseExcel();
  console.log(`\nTotal keywords parseadas: ${keywords.length}`);

  if (keywords.length === 0) {
    console.error('❌ No se encontraron keywords. Verificar estructura del Excel.');
    process.exit(1);
  }

  // Resumen por sub-línea
  const bySubLinea = {};
  for (const k of keywords) {
    bySubLinea[k.sub_linea_codigo] = (bySubLinea[k.sub_linea_codigo] || 0) + 1;
  }
  console.log('\nPor sub-línea:');
  for (const [sl, cnt] of Object.entries(bySubLinea)) {
    const slId = subLineaIds[sl] || '❌ NO MAPEADO';
    console.log(`  ${sl} (id=${slId}): ${cnt} keywords`);
  }

  const sinId = keywords.filter(k => !subLineaIds[k.sub_linea_codigo]);
  if (sinId.length > 0) {
    console.log(`\n⚠ ${sinId.length} keywords con sub-línea no mapeada (se omitirán)`);
  }

  console.log('');

  // 3. Generar SQL o insertar
  if (GENERATE_SQL) {
    const sql   = generateSql(keywords, subLineaIds);
    const sqlPath = path.join(__dirname, 'keywords_import.sql');
    fs.writeFileSync(sqlPath, sql, 'utf-8');
    console.log(`✅ SQL generado: ${sqlPath}`);
    console.log('');
    console.log('INSTRUCCIONES:');
    console.log('  1. Ir a https://supabase.valparaiso.cafe → SQL Editor (o Table Editor)');
    console.log('  2. Pegar el contenido del archivo keywords_import.sql');
    console.log('  3. Ejecutar y verificar el COUNT por sub-línea al final');
    return;
  }

  console.log('Insertando en Supabase...');
  const { inserted, skipped } = await insertKeywords(keywords, subLineaIds);

  console.log('');
  console.log(`  Insertadas/actualizadas: ${inserted}`);
  console.log(`  Omitidas (sin ID):       ${skipped}`);

  // 4. Verificar count
  try {
    const total = await verifyCount();
    console.log(`  Total activas en DB:     ${total}`);
    if (total < 30) {
      console.log('  ⚠ ADVERTENCIA: Menos de 30 keywords activas. Verificar seed.');
    } else {
      console.log('  ✔ Keywords verificadas correctamente.');
    }
  } catch {}

  console.log('');
  console.log('✅ Importación completada');
  console.log('');
  console.log('PRÓXIMOS PASOS:');
  console.log('  1. Probar WF02 con DHL Express / Colombia / Intralogística');
  console.log('  2. Verificar en n8n que "HTTP: Fetch Keywords Supabase" devuelve datos');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
