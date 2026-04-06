/**
 * prisma/seed.js
 * Importa empresas.csv al SQLite.
 * Uso: node prisma/seed.js [ruta_csv]
 */

const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const CSV_PATH = process.argv[2] || path.join(__dirname, '../../Downloads/empresas.csv');

const LINEA_MAP = {
  'bhs':               'BHS',
  'carton corrugado':  'Cartón',
  'cartón corrugado':  'Cartón',
  'intralogistica':    'Intralogística',
  'intralogística':    'Intralogística',
};

function mapLinea(raw) {
  if (!raw) return null;
  return LINEA_MAP[raw.trim().toLowerCase()] || raw.trim();
}

function splitLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function clean(s) {
  if (!s) return null;
  const t = s.trim().replace(/^\uFEFF/, '');
  return t || null;
}

async function main() {
  console.log(`\nLeyendo: ${CSV_PATH}`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error('Archivo no encontrado:', CSV_PATH);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines   = content.split(/\r?\n/);
  const header  = splitLine(lines[0]).map(h => clean(h) || '');

  const colIdx = {
    nombre:  header.findIndex(h => h.toLowerCase().includes('company_name') || h.toLowerCase().includes('nombre')),
    dominio: header.findIndex(h => h.toLowerCase().includes('domain')),
    url:     header.findIndex(h => h.toLowerCase().includes('company_url')),
    pais:    header.findIndex(h => h.toLowerCase() === 'pais' || h.toLowerCase() === 'país'),
    ciudad:  header.findIndex(h => h.toLowerCase() === 'ciudad'),
    linea:   header.findIndex(h => h.toLowerCase().includes('linea_detectada') || h.toLowerCase().includes('linea')),
    linea_raw: header.findIndex(h => h.toLowerCase() === 'linea_raw'),
  };

  console.log('Columnas:', JSON.stringify(colIdx));

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);

    const nombre = clean(cols[colIdx.nombre]);
    const lineaRaw = clean(cols[colIdx.linea]);
    const linea = lineaRaw ? mapLinea(lineaRaw) : null;

    if (!nombre || !linea) continue;

    records.push({
      company_name:   nombre,
      company_domain: colIdx.dominio >= 0 ? clean(cols[colIdx.dominio]) : null,
      company_url:    colIdx.url >= 0 ? clean(cols[colIdx.url]) : null,
      pais:           colIdx.pais >= 0 ? clean(cols[colIdx.pais]) : null,
      ciudad:         colIdx.ciudad >= 0 ? clean(cols[colIdx.ciudad]) : null,
      linea_negocio:  linea,
      linea_raw:      lineaRaw,
      tier:           'Tier B',
      status:         'pending',
    });
  }

  // Distribución
  const dist = {};
  records.forEach(r => { dist[r.linea_negocio] = (dist[r.linea_negocio] || 0) + 1; });
  console.log('\nDistribución:');
  Object.entries(dist).forEach(([l, n]) => console.log(`  ${l.padEnd(20)} ${n}`));
  console.log(`  Total: ${records.length}`);

  // Limpiar tabla y reinsertar
  console.log('\nLimpiando tabla empresas...');
  await prisma.empresa.deleteMany({});

  // Insertar en batches
  console.log('Insertando...');
  const BATCH = 100;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await prisma.empresa.createMany({ data: batch });
    process.stdout.write(`  ${Math.min(i + BATCH, records.length)}/${records.length}\r`);
  }

  console.log(`\n✅ Importadas ${records.length} empresas a SQLite.`);

  // Verificar conteos
  const counts = await prisma.empresa.groupBy({
    by: ['linea_negocio'],
    _count: { linea_negocio: true },
  });
  console.log('\nVerificación:');
  counts.forEach(c => console.log(`  ${c.linea_negocio.padEnd(20)} ${c._count.linea_negocio}`));
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
