/**
 * scripts/seed_supabase.ts
 * Seeds matec_radar.empresas from empresas.csv via UPSERT.
 * Idempotent: running twice reports 0 inserted, N updated.
 *
 * Usage: npx tsx scripts/seed_supabase.ts [path/to/empresas.csv]
 *
 * Default CSV path: C:/Users/Juan/Documents/Agentic Workflows/clients/empresas.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const url    = process.env.SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.SUPABASE_DB_SCHEMA ?? 'public';

if (!url || !key || key === 'FILL_IN_SERVICE_ROLE_KEY') {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, key, {
  db:   { schema },
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_CSV = path.join(
  'C:', 'Users', 'Juan', 'Documents', 'Agentic Workflows', 'clients', 'empresas.csv',
);
const CSV_PATH = process.argv[2] || DEFAULT_CSV;

const LINEA_MAP: Record<string, string> = {
  'bhs':               'BHS',
  'carton corrugado':  'Cartón',
  'cartón corrugado':  'Cartón',
  'intralogistica':    'Intralogística',
  'intralogística':    'Intralogística',
};

function mapLinea(raw: string | null): string | null {
  if (!raw) return null;
  return LINEA_MAP[raw.trim().toLowerCase()] ?? raw.trim();
}

function splitLine(line: string): string[] {
  const result: string[] = [];
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

function clean(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim().replace(/^\uFEFF/, '');
  return t || null;
}

interface EmpresaRecord {
  company_name:   string;
  company_domain: string | null;
  company_url:    string | null;
  pais:           string | null;
  ciudad:         string | null;
  linea_negocio:  string;
  linea_raw:      string | null;
  tier:           string;
  status:         string;
}

async function main() {
  console.log(`\n🌱  Seeding matec_radar.empresas from CSV`);
  console.log(`    CSV: ${CSV_PATH}\n`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌  File not found: ${CSV_PATH}`);
    console.error('    Pass the path as argument: npx tsx scripts/seed_supabase.ts path/to/empresas.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines   = content.split(/\r?\n/);
  const header  = splitLine(lines[0]!).map(h => clean(h) ?? '');

  const colIdx = {
    nombre:    header.findIndex(h => h.toLowerCase().includes('company_name') || h.toLowerCase().includes('nombre')),
    dominio:   header.findIndex(h => h.toLowerCase().includes('domain')),
    url:       header.findIndex(h => h.toLowerCase().includes('company_url')),
    pais:      header.findIndex(h => h.toLowerCase() === 'pais' || h.toLowerCase() === 'país'),
    ciudad:    header.findIndex(h => h.toLowerCase() === 'ciudad'),
    linea:     header.findIndex(h => h.toLowerCase().includes('linea_detectada') || h.toLowerCase() === 'linea'),
    linea_raw: header.findIndex(h => h.toLowerCase() === 'linea_raw'),
  };

  // Parse records
  const records: EmpresaRecord[] = [];
  const dupCheck = new Set<string>();
  let duplicatesInCSV = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const cols = splitLine(line);

    const nombre    = clean(cols[colIdx.nombre]);
    const lineaRaw  = clean(colIdx.linea >= 0 ? cols[colIdx.linea] : null);
    const linea     = lineaRaw ? mapLinea(lineaRaw) : null;

    if (!nombre || !linea) continue;

    const key = `${nombre.toLowerCase()}|${linea.toLowerCase()}`;
    if (dupCheck.has(key)) {
      duplicatesInCSV++;
      continue;
    }
    dupCheck.add(key);

    records.push({
      company_name:   nombre,
      company_domain: colIdx.dominio  >= 0 ? clean(cols[colIdx.dominio])   : null,
      company_url:    colIdx.url      >= 0 ? clean(cols[colIdx.url])        : null,
      pais:           colIdx.pais     >= 0 ? clean(cols[colIdx.pais])       : null,
      ciudad:         colIdx.ciudad   >= 0 ? clean(cols[colIdx.ciudad])     : null,
      linea_negocio:  linea,
      linea_raw:      colIdx.linea_raw >= 0 ? clean(cols[colIdx.linea_raw]) : lineaRaw,
      tier:           'Tier B',
      status:         'pending',
    });
  }

  if (duplicatesInCSV > 0) {
    console.warn(`⚠️   Skipped ${duplicatesInCSV} duplicate (company_name, linea_negocio) pairs in CSV`);
  }

  // Distribution
  const dist: Record<string, number> = {};
  records.forEach(r => { dist[r.linea_negocio] = (dist[r.linea_negocio] ?? 0) + 1; });
  console.log('📊  CSV distribution:');
  Object.entries(dist).sort().forEach(([l, n]) => console.log(`    ${l.padEnd(20)} ${n}`));
  console.log(`    ${'Total'.padEnd(20)} ${records.length}\n`);

  // UPSERT in batches
  const BATCH = 100;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);

    const { error } = await db
      .from('empresas')
      .upsert(batch, { onConflict: 'company_name,linea_negocio' });

    if (error) {
      console.error(`❌  Batch ${i}–${i + BATCH}: ${error.message}`);
      process.exit(1);
    }

    process.stdout.write(`  ${Math.min(i + BATCH, records.length)}/${records.length}\r`);
  }

  // Get final count from DB for accurate reporting
  const { count } = await db.from('empresas').select('*', { count: 'exact', head: true });
  console.log('\n\n✅  Seed complete!');
  console.log(`    Rows in matec_radar.empresas: ${count ?? '?'}`);
  console.log(`    CSV records processed:        ${records.length}`);
  console.log('\n📊  Post-seed distribution (from Supabase):');

  const { data: distRows } = await db.from('empresas').select('linea_negocio').eq('status', 'pending');
  const supabaseDist: Record<string, number> = {};
  for (const r of (distRows ?? []) as { linea_negocio: string }[]) {
    supabaseDist[r.linea_negocio] = (supabaseDist[r.linea_negocio] ?? 0) + 1;
  }
  Object.entries(supabaseDist).sort().forEach(([l, n]) => console.log(`    ${l.padEnd(20)} ${n}`));
  console.log('');
}

main().catch(e => { console.error('❌  Unexpected error:', e); process.exit(1); });
