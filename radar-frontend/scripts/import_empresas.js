/**
 * import_empresas.js
 *
 * Lee BASE DE DATOS FINAL DE LINEA.xlsx y carga las empresas en SQLite.
 *
 * Estructura del Excel:
 *   Fila 1: nombres de sección (EMPRESA FOCO, SEGMENTACIÓN, etc.)
 *   Fila 2: pesos de cada sección
 *   Fila 3: encabezados reales de columna (COMPANY NAME, PAÍS, etc.)
 *   Fila 4+: datos de empresas
 *
 * Uso:
 *   node scripts/import_empresas.js
 *   node scripts/import_empresas.js --dry-run   (solo muestra, no inserta)
 *   node scripts/import_empresas.js --clear      (borra existentes antes)
 *   node scripts/import_empresas.js --sheet "Nombre" (usar hoja específica)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path  = require('path');
const XLSX  = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EXCEL_PATH   = path.join(__dirname, '../../BASE DE DATOS FINAL DE LINEA.xlsx');
const DRY_RUN      = process.argv.includes('--dry-run');
const CLEAR        = process.argv.includes('--clear');
const SHEET_ARG    = (() => {
  const i = process.argv.indexOf('--sheet');
  return i !== -1 ? process.argv[i + 1] : null;
})();

// ── Normalización de claves ──────────────────────────────────────────────────
function normKey(k) {
  return String(k)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

// ── Mapeo de columna normalizada → campo DB ──────────────────────────────────
const COL_MAP = {
  COMPANYNAME:        'company_name',
  EMPRESA:            'company_name',
  EMPRESAFOCO:        'company_name',   // "EMPRESA FOCO (1)"
  PAIS:               'pais',
  COUNTRY:            'pais',
  CIUDAD:             'ciudad',
  CITY:               'ciudad',
  // "ESTADO, PROVINCIA O DEPARTAMENTO" → usado como ciudad cuando CIUDAD tiene URLs
  ESTADOPROVINCIAODEPARTAMENTO: 'estado',
  ESTADOPROVINCIADEPARTAMENTO:  'estado',
  DOMINIO:            'company_domain',
  DOMAIN:             'company_domain',
  WEBSITE:            'company_domain',
  WEB:                'company_domain',
  LINEADENEGOCIO:     'linea_negocio',
  LINEANEGOCIO:       'linea_negocio',
  LINEA:              'linea_negocio',
  CALIFICACIONCUALITATIVA: 'prioridad',  // score 0-25
  SCORETOTAL:         'prioridad_alt',   // si tiene valor numérico
  TIER:               'tier',
  CUENTASTRATEGICA:   'cuenta_estrategica',
};

// ── Normalización de línea de negocio ────────────────────────────────────────
function normLinea(raw) {
  if (!raw) return null;
  const n = normKey(raw);
  // "MATEC | LÍNEA BHS", "BHS", etc.
  if (n.includes('BHS'))                          return 'BHS';
  // "MATEC | LÍNEA CARTÓN", "LÍNEA CARTÓN CORRUGADO", etc.
  if (n.includes('CART') || n.includes('CORRUGAD')) return 'Cartón';
  // "MATEC | LÍNEA LOGÍSTICA", "INTRALOGISTICA", "INTRA", etc.
  if (n.includes('LOGIST') || n.includes('INTRA') || n.includes('CEDI'))
    return 'Intralogística';
  return raw.trim();
}

// ── Normalización de tier ────────────────────────────────────────────────────
function normTier(raw) {
  if (!raw) return 'Tier B';
  const n = normKey(raw);
  if (n.startsWith('TIERA') || n === 'A')  return 'Tier A';
  if (n.startsWith('TIERB') || n === 'B')  return 'Tier B';
  if (n.startsWith('TIERC') || n === 'C')  return 'Tier C';
  return 'Tier B'; // fallback
}

async function processSheet(sheetName, ws) {
  // Usar header: 1 para obtener array de arrays
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Detectar fila de encabezados: la que contenga exactamente "COMPANY NAME" o "EMPRESA"
  // (no "EMPRESA FOCO" ni variantes compuestas)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i];
    const hasCompanyCol = row.some(cell => {
      const n = normKey(String(cell));
      return n === 'COMPANYNAME' || n === 'EMPRESA' || n === 'NOMBREEMPRESA';
    });
    if (hasCompanyCol) { headerRowIdx = i; break; }
  }

  if (headerRowIdx === -1) {
    console.log(`  [${sheetName}] No se encontró fila de encabezados. Saltando.`);
    return [];
  }

  const headers = allRows[headerRowIdx];
  console.log(`  [${sheetName}] Encabezados en fila ${headerRowIdx + 1}, ${headers.length} columnas`);

  // Construir mapa: índice columna → campo DB
  const colToField = {};
  headers.forEach((col, idx) => {
    if (!col) return;
    const n = normKey(String(col));
    const field = COL_MAP[n];
    if (field) colToField[idx] = field;
  });

  console.log(`  [${sheetName}] Columnas mapeadas:`, Object.entries(colToField).map(([i, f]) => `${headers[i]}→${f}`).join(', '));

  // Parsear filas de datos
  const empresas = [];
  const errores  = [];

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row    = allRows[i];
    const mapped = {};

    for (const [idxStr, field] of Object.entries(colToField)) {
      const val = row[idxStr];
      if (val !== '' && val !== null && val !== undefined) {
        mapped[field] = val;
      }
    }

    const company_name = String(mapped.company_name || '').trim();
    if (!company_name) continue; // fila vacía, skip silencioso

    const linea_negocio = normLinea(mapped.linea_negocio);
    if (!linea_negocio) {
      errores.push(`Fila ${i + 1}: "${company_name}" sin línea de negocio reconocida (valor: "${mapped.linea_negocio || ''}")`);
      // Aún así intentamos importar como 'Intralogística' si el sheet name da pista
      if (!sheetName.toLowerCase().includes('bhs') && !sheetName.toLowerCase().includes('cart')) {
        // Por defecto, dejar sin linea y reportar error
      }
      continue;
    }

    // Prioridad: preferir CALIFICACIÓN CUALITATIVA numérica, luego 0
    let prioridad = 0;
    if (mapped.prioridad !== undefined) {
      const p = typeof mapped.prioridad === 'number'
        ? mapped.prioridad
        : parseInt(String(mapped.prioridad), 10);
      if (!isNaN(p)) prioridad = p;
    }
    // Si prioridad_alt tiene valor, combinar (Score_Total)
    if (prioridad === 0 && mapped.prioridad_alt !== undefined) {
      const pa = typeof mapped.prioridad_alt === 'number'
        ? mapped.prioridad_alt
        : parseInt(String(mapped.prioridad_alt), 10);
      if (!isNaN(pa)) prioridad = pa;
    }

    // Dominio: descartar si no parece URL/dominio válido
    let company_domain = null;
    if (mapped.company_domain) {
      const d = String(mapped.company_domain).trim();
      if (d && !d.includes(' ') && (d.includes('.') || d.startsWith('http'))) {
        company_domain = d;
      }
    }

    // Ciudad: descartar si parece URL (datos incorrectos en Excel)
    let ciudad = null;
    const rawCiudad = mapped.ciudad ? String(mapped.ciudad).trim() : null;
    if (rawCiudad && !rawCiudad.startsWith('http') && !rawCiudad.includes('://')) {
      ciudad = rawCiudad;
    } else if (mapped.estado) {
      // Fallback: usar ESTADO/PROVINCIA como ciudad
      ciudad = String(mapped.estado).trim() || null;
    }

    empresas.push({
      company_name,
      company_domain,
      pais:   mapped.pais ? String(mapped.pais).trim() : null,
      ciudad,
      linea_negocio,
      linea_raw:      mapped.linea_negocio ? String(mapped.linea_negocio).trim() : null,
      tier:           normTier(mapped.tier),
      prioridad,
      status:         'pending',
    });
  }

  if (errores.length) {
    console.log(`  [${sheetName}] Filas con error: ${errores.length}`);
    errores.slice(0, 5).forEach(e => console.log(`    ⚠ ${e}`));
  }

  return empresas;
}

async function main() {
  console.log(`\nLeyendo: ${EXCEL_PATH}`);

  let wb;
  try {
    wb = XLSX.readFile(EXCEL_PATH);
  } catch (e) {
    console.error(`\nERROR: No se pudo abrir el archivo Excel: ${e.message}`);
    process.exit(1);
  }

  const sheetNames = SHEET_ARG ? [SHEET_ARG] : wb.SheetNames;
  console.log(`Hojas a procesar: ${sheetNames.join(', ')}`);

  // Procesar cada hoja
  const allEmpresas = [];
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) { console.log(`  Hoja "${name}" no encontrada, saltando.`); continue; }
    const empresas = await processSheet(name, ws);
    console.log(`  [${name}] Empresas válidas: ${empresas.length}`);
    allEmpresas.push(...empresas);
  }

  // Resumen por línea
  const byLinea = {};
  for (const e of allEmpresas) {
    byLinea[e.linea_negocio] = (byLinea[e.linea_negocio] || 0) + 1;
  }

  // Distribución de prioridades
  const conPrioridad = allEmpresas.filter(e => e.prioridad > 0).length;

  console.log('\n=== RESUMEN ===');
  console.log(`Total válidas: ${allEmpresas.length}`);
  console.log(`Con prioridad > 0: ${conPrioridad}`);
  console.log('Por línea:');
  for (const [linea, count] of Object.entries(byLinea)) {
    console.log(`  ${linea}: ${count}`);
  }

  if (allEmpresas.length === 0) {
    console.error('\nNo se encontraron empresas para importar.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Sin --dry-run para insertar.');
    console.log('\nPrimeras 5 empresas que se insertarían:');
    allEmpresas.slice(0, 5).forEach(e =>
      console.log(`  ${e.company_name} | ${e.linea_negocio} | ${e.pais || '-'} | prioridad:${e.prioridad} | tier:${e.tier}`)
    );
    return;
  }

  // ── Insertar en SQLite ─────────────────────────────────────────────────────
  if (CLEAR) {
    console.log('\nBorrando empresas existentes...');
    const deleted = await prisma.empresa.deleteMany({});
    console.log(`  Borradas: ${deleted.count}`);
  }

  console.log('\nInsertando en SQLite...');
  let inserted = 0;
  let skipped  = 0;
  for (const e of allEmpresas) {
    try {
      await prisma.empresa.create({ data: e });
      inserted++;
    } catch {
      skipped++;
    }
  }

  console.log(`\n✅ Insertadas: ${inserted} | Omitidas (duplicadas o error): ${skipped}`);

  // Conteo final en DB
  console.log('\nConteo en base de datos:');
  const counts = await prisma.empresa.groupBy({
    by:    ['linea_negocio'],
    where: { status: 'pending' },
    _count: { linea_negocio: true },
  });
  for (const r of counts) {
    console.log(`  ${r.linea_negocio}: ${r._count.linea_negocio}`);
  }
}

main()
  .catch(err => {
    console.error('\nERROR:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
