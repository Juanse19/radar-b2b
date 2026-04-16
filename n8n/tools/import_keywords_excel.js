/**
 * import_keywords_excel.js — Sprint F2.1
 *
 * Importa keywords desde PalabrasClave_PorLineaNegocio.xlsx a Supabase.
 * Tabla destino: matec_radar.palabras_clave_por_linea
 *   Columnas: palabra (TEXT), tipo (TEXT), peso (INTEGER), sub_linea_id (INTEGER), activo (BOOLEAN)
 *
 * Prerequisito: npm install xlsx (en la carpeta n8n/tools o globalmente)
 *   cd "C:\Users\Juan\Documents\Agentic Workflows\clients\n8n\tools"
 *   npm install xlsx
 *
 * Uso:
 *   node import_keywords_excel.js           → inserta en Supabase (producción)
 *   node import_keywords_excel.js --dry-run → simula sin insertar
 *   node import_keywords_excel.js --sql     → genera keywords_import.sql para ejecutar manualmente
 *
 * Estructura esperada del Excel (por hoja):
 *   Columna A: Palabra clave  (requerida)
 *   Columna B: Tipo           (opcional — default: 'general')
 *   Columna C: Peso           (opcional — default: 1)
 *
 * Nombres de hoja reconocidos → código de sub-línea:
 *   BHS             → bhs
 *   Intralogística  → intralogistica
 *   Cartón          → carton_papel
 *   Final de Línea  → final_linea
 *   Motos           → motos
 *   Solumat         → solumat
 *   Cargo           → cargo
 */

const path  = require('path');
const https = require('https');
const fs    = require('fs');

const EXCEL_PATH   = path.join(__dirname, '../../docs/PalabrasClave_PorLineaNegocio.xlsx');
const SUPABASE_URL = 'https://supabase.valparaiso.cafe';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzU2NzI2NzcsImV4cCI6MTkzMzM1MjY3N30.EcqvysQnH7ZrGAz2OJJnUQVYYS1qsRlEhnb9xjbqFuQ';
const DRY_RUN      = process.argv.includes('--dry-run');

// ── Mapa de nombres de hoja → código de sub-línea ────────────────────────────
// Spec F2.1: mapeo exacto de nombres de hoja a códigos en sub_lineas_negocio.codigo
const SHEET_TO_SUBLINEA = {
  // Primarios (nombres exactos del Excel)
  'bhs':                   'bhs',
  'intralogistica':        'intralogistica',
  'intralogística':        'intralogistica',
  'carton':                'carton_papel',
  'cartón':                'carton_papel',
  'final de linea':        'final_linea',
  'final de línea':        'final_linea',
  'motos':                 'motos',
  'solumat':               'solumat',
  'cargo':                 'cargo',
  // Variantes adicionales
  'aeropuertos':           'bhs',
  'bhs aeropuertos':       'bhs',
  'cargo uld':             'cargo',
  'carga':                 'cargo',
  'carton corrugado':      'carton_papel',
  'cartón corrugado':      'carton_papel',
  'papel':                 'carton_papel',
  'corrugado':             'carton_papel',
  'final linea':           'final_linea',
  'ensambladoras':         'motos',
  'ensambladoras motos':   'motos',
  'motos ensambladoras':   'motos',
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
  if (!t || String(t).trim() === '') return 'general';
  const valid = ['general', 'senal', 'señal', 'producto', 'sector', 'exclusion'];
  const norm = String(t).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm === 'señal' || norm === 'senal') return 'senal';
  return valid.includes(norm) ? norm : 'general';
}

function validatePeso(p) {
  const n = parseInt(p);
  if (isNaN(n)) return 1;
  return Math.max(-5, Math.min(5, n));
}

// ── HTTP helper genérico ──────────────────────────────────────────────────────
function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── GET Supabase REST API ─────────────────────────────────────────────────────
function supabaseGet(table, params) {
  const qs = params ? '?' + params : '';
  // Use db-schema header so PostgREST targets matec_radar schema
  return httpRequest({
    hostname: new URL(SUPABASE_URL).hostname,
    path:     `/rest/v1/${table}${qs}`,
    method:   'GET',
    headers: {
      'apikey':         SERVICE_KEY,
      'Authorization':  `Bearer ${SERVICE_KEY}`,
      'Accept-Profile': 'matec_radar',
    },
  });
}

// ── POST Supabase REST API ────────────────────────────────────────────────────
function supabasePost(table, rows) {
  const body = JSON.stringify(rows);
  return httpRequest({
    hostname: new URL(SUPABASE_URL).hostname,
    path:     `/rest/v1/${table}`,
    method:   'POST',
    headers: {
      'apikey':          SERVICE_KEY,
      'Authorization':   `Bearer ${SERVICE_KEY}`,
      'Content-Type':    'application/json',
      'Content-Length':  Buffer.byteLength(body),
      'Content-Profile': 'matec_radar',
      'Prefer':          'resolution=merge-duplicates',
    },
  }, body);
}

// ── Obtener IDs de sub-líneas desde Supabase ──────────────────────────────────
async function fetchSubLineaIds() {
  const res = await supabaseGet('sub_lineas_negocio', 'select=id,codigo');
  if (res.status !== 200) {
    throw new Error(`No se pudo consultar sub_lineas_negocio: ${res.status} ${res.body}`);
  }
  const rows = JSON.parse(res.body);
  const map  = {};
  for (const r of rows) {
    map[r.codigo] = r.id;
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

  // Array de { sub_linea_codigo, palabra, tipo, peso }
  // (sin idioma — la tabla matec_radar.palabras_clave_por_linea no tiene esa columna)
  const keywords = [];

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
    // Columnas por defecto: A=palabra, B=tipo, C=peso
    let colPalabra = 0, colTipo = 1, colPeso = 2, colSubLinea = -1;

    if (hasHeader) {
      firstRow.forEach((c, i) => {
        if (['palabra', 'keyword', 'termino', 'term'].includes(c)) colPalabra = i;
        if (['tipo', 'type'].includes(c)) colTipo = i;
        if (['peso', 'weight'].includes(c)) colPeso = i;
        if (['sub_linea', 'sublinea', 'linea'].includes(c)) colSubLinea = i;
      });
    }

    let count = 0;
    for (const row of dataRows) {
      const palabra = String(row[colPalabra] || '').trim();
      if (!palabra || palabra.length < 2) continue;

      const tipo = validateTipo(row[colTipo]);
      const peso = validatePeso(row[colPeso]);

      // Determinar sub-línea
      let sl = subLinea;
      if (!sl && colSubLinea >= 0) {
        sl = resolveSubLinea(String(row[colSubLinea] || ''));
      }

      if (!sl) {
        console.log(`  ⚠ "${sheetName}" → sub-línea no reconocida (saltando "${palabra}")`);
        continue;
      }

      keywords.push({ sub_linea_codigo: sl, palabra, tipo, peso });
      count++;
    }

    console.log(`  ✔ Hoja "${sheetName}" → sub-línea "${subLinea || '?'}" → ${count} keywords`);
  }

  return keywords;
}

// ── Insertar en Supabase vía REST API ────────────────────────────────────────
// Usa POST /rest/v1/palabras_clave_por_linea con Prefer: resolution=merge-duplicates
async function insertKeywords(keywords, subLineaIds) {
  let inserted = 0, skipped = 0;

  // Procesar en lotes de 100 (REST API es más eficiente que raw SQL)
  const batchSize = 100;
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch     = keywords.slice(i, i + batchSize);
    const validRows = batch
      .filter(k => subLineaIds[k.sub_linea_codigo])
      .map(k => ({
        sub_linea_id: subLineaIds[k.sub_linea_codigo],
        palabra:      k.palabra,
        tipo:         k.tipo,
        peso:         k.peso,
        activo:       true,
      }));

    if (validRows.length === 0) {
      skipped += batch.length;
      continue;
    }

    const batchNum = Math.floor(i / batchSize) + 1;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Batch ${batchNum}: ${validRows.length} rows`);
      if (validRows.length > 0) {
        console.log(`    Ejemplo: ${JSON.stringify(validRows[0])}`);
      }
      inserted += validRows.length;
    } else {
      const res = await supabasePost('palabras_clave_por_linea', validRows);
      // 201 Created o 200 OK → éxito
      if (res.status === 200 || res.status === 201) {
        inserted += validRows.length;
        process.stdout.write('.');
      } else {
        console.error(`\n  ✗ Batch ${batchNum} error: HTTP ${res.status}`);
        console.error(`    ${res.body.substring(0, 300)}`);
        skipped += validRows.length;
      }
    }
  }

  if (!DRY_RUN && inserted > 0) process.stdout.write('\n');
  return { inserted, skipped };
}

// ── Verificación final por sub-línea ─────────────────────────────────────────
async function verifyCountBySubLinea() {
  // GET keywords activas con sub_linea_id
  const res = await supabaseGet(
    'palabras_clave_por_linea',
    'select=sub_linea_id&activo=eq.true'
  );
  if (res.status !== 200) return null;
  const rows = JSON.parse(res.body);
  // Agrupar por sub_linea_id
  const counts = {};
  for (const r of rows) {
    const id = r.sub_linea_id;
    counts[id] = (counts[id] || 0) + 1;
  }
  return { total: rows.length, byId: counts };
}

// ── IDs conocidos de sub-líneas (fallback si Supabase no responde) ────────────
// Códigos alineados con CLAUDE.md y spec F2.1
const KNOWN_SUBLINEA_IDS = {
  bhs:           1,
  cargo:         2,
  carton_papel:  3,
  final_linea:   4,
  motos:         5,
  solumat:       6,
  intralogistica: 7,
};

// ── Generar SQL para ejecutar manualmente en Supabase Dashboard ───────────────
// Tabla: matec_radar.palabras_clave_por_linea (sin columna idioma)
function generateSql(keywords, subLineaIds) {
  const esc = s => "'" + String(s || '').replace(/'/g, "''") + "'";
  const validKw = keywords.filter(k => subLineaIds[k.sub_linea_codigo]);
  const values  = validKw.map(k =>
    `  (${subLineaIds[k.sub_linea_codigo]}, ${esc(k.palabra)}, ${esc(k.tipo)}, ${k.peso}, TRUE)`
  ).join(',\n');

  return `-- ============================================================
-- Sprint F2.1 — Keywords importadas desde PalabrasClave_PorLineaNegocio.xlsx
-- Generado: ${new Date().toISOString()}  |  Total: ${validKw.length}
-- Ejecutar en: https://supabase.valparaiso.cafe → SQL Editor
-- ============================================================

INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, tipo, peso, activo)
VALUES
${values}
ON CONFLICT (sub_linea_id, palabra)
DO UPDATE SET tipo = EXCLUDED.tipo, peso = EXCLUDED.peso, activo = TRUE;

-- Verificación: count por sub-línea
SELECT sl.codigo, COUNT(*) as total
FROM matec_radar.palabras_clave_por_linea p
JOIN matec_radar.sub_lineas_negocio sl ON p.sub_linea_id = sl.id
WHERE p.activo = TRUE
GROUP BY sl.codigo ORDER BY sl.codigo;
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const GENERATE_SQL = process.argv.includes('--sql');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Import Keywords Excel → Supabase (Sprint F2.1)               ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin insertar)' : GENERATE_SQL ? 'GENERAR SQL (manual)' : 'PRODUCCIÓN'}`);
  console.log(`Excel: ${EXCEL_PATH}`);
  console.log('');

  // 1. Obtener IDs de sub-líneas — GET /rest/v1/sub_lineas_negocio
  let subLineaIds = { ...KNOWN_SUBLINEA_IDS };
  console.log('Consultando sub-líneas en Supabase...');
  try {
    const fetched = await fetchSubLineaIds();
    if (Object.keys(fetched).length > 0) {
      subLineaIds = fetched;
      console.log(`  IDs obtenidos: ${Object.entries(subLineaIds).map(([k,v])=>`${k}=${v}`).join(', ')}`);
    } else {
      console.log(`  ⚠ Respuesta vacía. Usando IDs del seed.`);
    }
  } catch (e) {
    console.log(`  ⚠ Supabase no accesible (${e.message}). Usando IDs del seed.`);
    console.log(`  Seed IDs: ${Object.entries(subLineaIds).map(([k,v])=>`${k}=${v}`).join(', ')}`);
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
    const sql     = generateSql(keywords, subLineaIds);
    const sqlPath = path.join(__dirname, 'keywords_import.sql');
    fs.writeFileSync(sqlPath, sql, 'utf-8');
    console.log(`✅ SQL generado: ${sqlPath}`);
    console.log('');
    console.log('INSTRUCCIONES:');
    console.log('  1. Ir a https://supabase.valparaiso.cafe → SQL Editor');
    console.log('  2. Pegar el contenido del archivo keywords_import.sql');
    console.log('  3. Ejecutar y verificar el COUNT por sub-línea al final');
    return;
  }

  console.log('Insertando en Supabase (POST /rest/v1/palabras_clave_por_linea)...');
  const { inserted, skipped } = await insertKeywords(keywords, subLineaIds);

  console.log('');
  console.log(`  Insertadas/actualizadas: ${inserted}`);
  console.log(`  Omitidas (sin ID):       ${skipped}`);

  // 4. Verificar count por sub-línea
  if (!DRY_RUN) {
    try {
      const verify = await verifyCountBySubLinea();
      if (verify) {
        console.log(`\n  Total activas en DB: ${verify.total}`);
        console.log('  Por sub-línea:');
        for (const [id, cnt] of Object.entries(verify.byId)) {
          const codigo = Object.entries(subLineaIds).find(([,v]) => v == id)?.[0] || `id=${id}`;
          console.log(`    ${codigo}: ${cnt} keywords`);
        }
        if (verify.total < 30) {
          console.log('  ⚠ ADVERTENCIA: Menos de 30 keywords activas. Verificar seed.');
        } else {
          console.log('  ✔ Keywords verificadas correctamente.');
        }
      }
    } catch (e) {
      console.log(`  ⚠ No se pudo verificar count: ${e.message}`);
    }
  }

  console.log('');
  console.log('✅ Importación completada (Sprint F2.1)');
  console.log('');
  console.log('PRÓXIMOS PASOS:');
  console.log('  1. Probar WF02 con DHL Express / Colombia / Intralogística');
  console.log('  2. Verificar en n8n que "HTTP: Fetch Keywords Supabase" devuelve datos');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
