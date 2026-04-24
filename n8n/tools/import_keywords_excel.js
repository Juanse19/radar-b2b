/**
 * import_keywords_excel.js — Sprint F2.1
 *
 * Importa keywords desde PalabrasClave_PorLineaNegocio.xlsx a Supabase.
 * Tabla destino: matec_radar.palabras_clave_por_linea
 *   Columnas: sub_linea_id, palabra, idioma, tipo, peso, activo
 *
 * Prerequisito: npm install xlsx (en la carpeta n8n/tools)
 *   cd "C:\Users\Juan\Documents\Agentic Workflows\clients\n8n\tools"
 *   npm install xlsx
 *
 * Uso:
 *   node import_keywords_excel.js           → inserta en Supabase (producción)
 *   node import_keywords_excel.js --dry-run → simula sin insertar
 *   node import_keywords_excel.js --sql     → genera keywords_import.sql para ejecutar manualmente
 *
 * Estructura del Excel (por hoja):
 *   Fila 0:   Título (saltar)
 *   Fila 1-3: Subtítulos / vacías (saltar)
 *   Fila 4:   Encabezados: CATEGORÍA | PALABRA CLAVE / FRASE | IDIOMA | PLATAFORMA
 *   Fila 5+:  Datos (col 0=cat, col 1=keyword, col 2=idioma, col 3=plataforma)
 *
 * Hojas reconocidas:
 *   BHS_AEROPUERTOS → aeropuertos (id 1)
 *   BHS_CARGO       → cargo_uld   (id 2)
 *   CARTON_PAPEL    → carton_corrugado (id 3)
 *   INTRA_FINAL     → final_linea (id 4)
 *   INTRA_MOTOS     → ensambladoras_motos (id 5)
 *   INTRA_SOLUMAT   → solumat     (id 6)
 */

const path  = require('path');
const https = require('https');
const fs    = require('fs');

// ── Configuración ─────────────────────────────────────────────────────────────
const EXCEL_PATH = path.join(
  __dirname,
  '../../docs/documentación/Documentacion/PalabrasClave_PorLineaNegocio.xlsx',
);
const SUPABASE_URL  = 'https://supabase.valparaiso.cafe';
// Production service_role key (iat: 1700000000)
const SERVICE_KEY   =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjIwMDAwMDAwMH0' +
  '.vBDC2y9ofT_-tvJxNdtRtFilgmkFN-ktiSl2AHiZZ3o';
const DRY_RUN       = process.argv.includes('--dry-run');
const GENERATE_SQL  = process.argv.includes('--sql');

// ── Mapa hoja → código sub-línea ──────────────────────────────────────────────
// Claves en minúsculas sin tildes para comparación case-insensitive
const SHEET_MAP = {
  'bhs_aeropuertos':    'aeropuertos',
  'bhs_cargo':          'cargo_uld',
  'carton_papel':       'carton_corrugado',
  'intra_final':        'final_linea',
  'intra_motos':        'ensambladoras_motos',
  'intra_solumat':      'solumat',
};

// ── Mapa CATEGORÍA → tipo + peso ─────────────────────────────────────────────
// Peso escala 1–5 según relevancia de señal para el Radar
const CATEGORIA_MAP = [
  { match: ['capex', 'inversion', 'inversion y capex', 'inversion/capex'],       tipo: 'capex',      peso: 5 },
  { match: ['proyectos', 'contratos', 'proyectos y contratos', 'licitacion'],     tipo: 'licitacion', peso: 4 },
  { match: ['expansion', 'crecimiento', 'expansion y crecimiento'],               tipo: 'expansion',  peso: 4 },
  { match: ['tecnologia', 'automatizacion', 'tecnologia y automatizacion'],        tipo: 'tecnologia', peso: 3 },
  { match: ['por pais', 'region', 'por pais / region', 'mercado'],                tipo: 'mercado',    peso: 2 },
  { match: ['boolean', 'guia', 'uso'],                                             tipo: null,         peso: 0 }, // skip
  { match: [],                                                                      tipo: 'general',    peso: 2 }, // default
];

function normStr(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_ /]/g, ''); // keep underscores for sheet matching
}

function categoriaTipoYPeso(cat) {
  const norm = normStr(cat);
  for (const entry of CATEGORIA_MAP) {
    if (entry.match.length === 0) return { tipo: entry.tipo, peso: entry.peso }; // default
    if (entry.match.some(m => norm.includes(m))) return { tipo: entry.tipo, peso: entry.peso };
  }
  return { tipo: 'general', peso: 2 };
}

function normLang(idioma) {
  const s = normStr(idioma);
  if (s === 'en' || s.startsWith('en')) return 'en';
  return 'es'; // default español
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
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

function supabaseGet(table, params) {
  return httpRequest({
    hostname: new URL(SUPABASE_URL).hostname,
    path:     `/rest/v1/${table}${params ? '?' + params : ''}`,
    method:   'GET',
    headers:  {
      'apikey':         SERVICE_KEY,
      'Authorization':  `Bearer ${SERVICE_KEY}`,
      'Accept-Profile': 'matec_radar',
    },
  });
}

function supabasePost(table, rows) {
  const body = JSON.stringify(rows);
  return httpRequest({
    hostname: new URL(SUPABASE_URL).hostname,
    path:     `/rest/v1/${table}`,
    method:   'POST',
    headers:  {
      'apikey':          SERVICE_KEY,
      'Authorization':   `Bearer ${SERVICE_KEY}`,
      'Content-Type':    'application/json',
      'Content-Length':  Buffer.byteLength(body),
      'Content-Profile': 'matec_radar',
      'Prefer':          'resolution=merge-duplicates,return=minimal',
    },
  }, body);
}

// ── Leer sub_linea IDs desde Supabase ────────────────────────────────────────
async function fetchSubLineaIds() {
  const res = await supabaseGet('sub_lineas_negocio', 'select=id,codigo');
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.body.substring(0, 200)}`);
  const rows = JSON.parse(res.body);
  const map = {};
  for (const r of rows) map[r.codigo] = r.id;
  return map;
}

// ── Parsear Excel ─────────────────────────────────────────────────────────────
function parseExcel() {
  let XLSX;
  try { XLSX = require('xlsx'); } catch {
    console.error('❌ Módulo "xlsx" no encontrado. Ejecuta: npm install xlsx');
    process.exit(1);
  }

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Archivo no encontrado: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  console.log(`📂 Leído: ${path.basename(EXCEL_PATH)}`);
  console.log(`   Hojas: ${wb.SheetNames.join(', ')}`);

  const SKIP_SHEETS = ['resumen', 'guia_uso_boolean', 'guia uso boolean', 'guia'];
  const keywords = [];

  for (const sheetName of wb.SheetNames) {
    const normName = normStr(sheetName).replace(/\s+/g, '_');
    if (SKIP_SHEETS.some(s => normName.includes(s))) {
      console.log(`  ⏩ Hoja "${sheetName}": saltada (resumen/guía)`);
      continue;
    }

    const subLineaCodigo = SHEET_MAP[normName];
    if (!subLineaCodigo) {
      console.log(`  ⚠ Hoja "${sheetName}" (norm: "${normName}"): no mapeada, saltada`);
      continue;
    }

    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Encontrar índice de fila de encabezados (buscar "CATEGORÍA" o "PALABRA")
    let headerIdx = rows.findIndex(r =>
      r.some(c => normStr(c).includes('categoria') || normStr(c).includes('palabra clave'))
    );
    if (headerIdx < 0) headerIdx = 0; // fallback: primera fila

    const dataRows = rows.slice(headerIdx + 1);

    // Detectar columnas desde encabezado
    const header = rows[headerIdx].map(c => normStr(c));
    const colCat  = header.findIndex(c => c.includes('categoria')) ?? 0;
    const colKw   = header.findIndex(c => c.includes('palabra') || c.includes('frase') || c.includes('keyword')) ?? 1;
    const colLang = header.findIndex(c => c === 'idioma' || c === 'language' || c === 'lang') ?? 2;

    const cidxCat  = colCat  >= 0 ? colCat  : 0;
    const cidxKw   = colKw   >= 0 ? colKw   : 1;
    const cidxLang = colLang >= 0 ? colLang : 2;

    let count = 0;
    let lastCat = '';

    for (const row of dataRows) {
      // Skip empty rows
      const kw = String(row[cidxKw] || '').trim();
      if (!kw || kw.length < 2) continue;

      // Categoría puede estar vacía (subcategoría hereda de la anterior)
      const rawCat = String(row[cidxCat] || '').trim();
      if (rawCat) lastCat = rawCat;

      const { tipo, peso } = categoriaTipoYPeso(lastCat);
      if (tipo === null) continue; // skip boolean/guía rows

      const idioma = normLang(row[cidxLang]);

      keywords.push({
        sub_linea_codigo: subLineaCodigo,
        palabra:          kw,
        idioma,
        tipo,
        peso,
      });
      count++;
    }

    console.log(`  ✔ "${sheetName}" → ${subLineaCodigo} → ${count} keywords`);
  }

  return keywords;
}

// ── Insertar en Supabase vía REST ─────────────────────────────────────────────
async function insertKeywords(keywords, subLineaIds) {
  let inserted = 0, errors = 0;
  const BATCH = 100;

  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch = keywords.slice(i, i + BATCH);
    const rows  = batch
      .filter(k => subLineaIds[k.sub_linea_codigo])
      .map(k => ({
        sub_linea_id: subLineaIds[k.sub_linea_codigo],
        palabra:      k.palabra,
        idioma:       k.idioma,
        tipo:         k.tipo,
        peso:         k.peso,
        activo:       true,
      }));

    if (rows.length === 0) continue;

    const res = await supabasePost('palabras_clave_por_linea', rows);
    if (res.status === 200 || res.status === 201) {
      inserted += rows.length;
      process.stdout.write('.');
    } else {
      console.error(`\n  ✗ Batch ${Math.floor(i/BATCH)+1} error: HTTP ${res.status}`);
      console.error(`    ${res.body.substring(0, 300)}`);
      errors += rows.length;
    }
  }
  if (inserted > 0) process.stdout.write('\n');
  return { inserted, errors };
}

// ── Generar SQL manual ────────────────────────────────────────────────────────
function generateSql(keywords, subLineaIds) {
  const esc = s => "'" + String(s || '').replace(/'/g, "''") + "'";
  const valid = keywords.filter(k => subLineaIds[k.sub_linea_codigo]);
  const vals  = valid.map(k =>
    `  (${subLineaIds[k.sub_linea_codigo]}, ${esc(k.palabra)}, ${esc(k.idioma)}, ${esc(k.tipo)}, ${k.peso}, TRUE)`
  ).join(',\n');

  return `-- ============================================================
-- Sprint F2.1 — Keywords desde PalabrasClave_PorLineaNegocio.xlsx
-- Generado: ${new Date().toISOString()}  |  Total: ${valid.length}
-- Ejecutar en: https://supabase.valparaiso.cafe → SQL Editor
-- ============================================================

INSERT INTO matec_radar.palabras_clave_por_linea
  (sub_linea_id, palabra, idioma, tipo, peso, activo)
VALUES
${vals}
ON CONFLICT (sub_linea_id, palabra)
DO UPDATE SET idioma = EXCLUDED.idioma, tipo = EXCLUDED.tipo, peso = EXCLUDED.peso, activo = TRUE;

-- Verificación
SELECT sl.codigo, sl.nombre, COUNT(*) AS total
FROM matec_radar.palabras_clave_por_linea p
JOIN matec_radar.sub_lineas_negocio sl ON p.sub_linea_id = sl.id
WHERE p.activo = TRUE
GROUP BY sl.id, sl.codigo, sl.nombre ORDER BY sl.id;
`;
}

// ── Verificar count final ─────────────────────────────────────────────────────
async function verifyFinal() {
  const res = await supabaseGet('palabras_clave_por_linea', 'select=sub_linea_id&activo=eq.true');
  if (res.status !== 200) return null;
  const rows = JSON.parse(res.body);
  const by = {};
  for (const r of rows) by[r.sub_linea_id] = (by[r.sub_linea_id] || 0) + 1;
  return { total: rows.length, byId: by };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Import Keywords → Supabase (Sprint F2.1)                      ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : GENERATE_SQL ? 'GENERAR SQL' : 'PRODUCCIÓN'}`);
  console.log(`Excel: ${EXCEL_PATH}`);
  console.log('');

  // 1. Obtener IDs de sub-líneas
  let subLineaIds = {};
  console.log('Consultando sub_lineas en Supabase...');
  try {
    subLineaIds = await fetchSubLineaIds();
    console.log(`  OK: ${Object.entries(subLineaIds).map(([k,v])=>`${k}=${v}`).join(', ')}`);
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
    process.exit(1);
  }
  console.log('');

  // 2. Parsear Excel
  console.log('Parseando Excel...');
  const keywords = parseExcel();
  console.log(`\nTotal keywords extraídas: ${keywords.length}`);

  if (keywords.length === 0) {
    console.error('❌ Sin keywords. Verificar estructura del Excel.');
    process.exit(1);
  }

  // Resumen
  const bySL = {};
  for (const k of keywords) bySL[k.sub_linea_codigo] = (bySL[k.sub_linea_codigo] || 0) + 1;
  console.log('\nPor sub-línea:');
  for (const [sl, cnt] of Object.entries(bySL)) {
    console.log(`  ${sl} (id=${subLineaIds[sl] ?? '❌ NO MAPEADO'}): ${cnt}`);
  }

  const sinId = keywords.filter(k => !subLineaIds[k.sub_linea_codigo]);
  if (sinId.length) console.log(`\n⚠ ${sinId.length} keywords sin ID mapeado (se omitirán)`);

  console.log('');

  // 3. SQL o insertar
  if (GENERATE_SQL) {
    const sql     = generateSql(keywords, subLineaIds);
    const sqlPath = path.join(__dirname, 'keywords_import.sql');
    fs.writeFileSync(sqlPath, sql, 'utf-8');
    console.log(`✅ SQL generado: ${sqlPath}`);
    console.log(`   ${keywords.filter(k=>subLineaIds[k.sub_linea_codigo]).length} keywords en el archivo`);
    return;
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] No se insertará nada. Ejemplo de primer registro:');
    const ex = keywords.find(k => subLineaIds[k.sub_linea_codigo]);
    if (ex) {
      console.log(`  { sub_linea_id: ${subLineaIds[ex.sub_linea_codigo]}, palabra: "${ex.palabra}", idioma: "${ex.idioma}", tipo: "${ex.tipo}", peso: ${ex.peso} }`);
    }
    console.log(`\n✅ DRY RUN OK — ${keywords.length} keywords listas para insertar`);
    return;
  }

  console.log('Insertando en Supabase...');
  const { inserted, errors } = await insertKeywords(keywords, subLineaIds);
  console.log(`\n  Insertadas/actualizadas: ${inserted}`);
  if (errors) console.log(`  Con error: ${errors}`);

  // 4. Verificar
  try {
    const v = await verifyFinal();
    if (v) {
      console.log(`\n  Total activas en DB: ${v.total}`);
      for (const [id, cnt] of Object.entries(v.byId)) {
        const codigo = Object.entries(subLineaIds).find(([,v2]) => v2 == id)?.[0] ?? `id=${id}`;
        console.log(`    ${codigo}: ${cnt}`);
      }
      console.log(v.total >= 50 ? '  ✔ ≥50 keywords ✅' : `  ⚠ Solo ${v.total} keywords activas`);
    }
  } catch { /* swallow */ }

  console.log('');
  console.log('✅ Importación completada (Sprint F2.1)');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
