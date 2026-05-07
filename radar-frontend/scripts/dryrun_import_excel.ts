/**
 * scripts/dryrun_import_excel.ts
 *
 * Paso A — Dry-run de importación de contactos desde los Excel de
 * C:\Users\Juan\Downloads\contactosApolloSublinea
 *
 * NO escribe en BD. Solo:
 *   1. Lee cada archivo + hoja relevante
 *   2. Detecta header row automáticamente
 *   3. Mapea columnas → roles (email, linkedin_url, first_name, etc.)
 *   4. Filtra por criterio: email + linkedin_url presentes
 *   5. Match empresa contra matec_radar.empresas.company_name
 *   6. Dedup en 4 capas: apollo_id, email, linkedin_url, name+empresa
 *   7. Detecta dups contra matec_radar.contactos en producción
 *   8. Genera reporte JSON + resumen humano
 *
 * Output:
 *   - tmp/import_excel_dryrun_report.json (lista completa)
 *   - tmp/import_excel_dryrun_unmatched_empresas.csv
 *   - stdout: resumen ejecutivo
 *
 * Uso: npx tsx scripts/dryrun_import_excel.ts
 */
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const FOLDER = 'C:/Users/Juan/Downloads/contactosApolloSublinea';
const OUTPUT_DIR = resolve(process.cwd(), 'tmp');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Map de archivo → sub-línea
// ---------------------------------------------------------------------------
const FILE_TO_SUBLINEA: Record<string, string | null> = {
  'AEROPUERTOS_Prospectos_MASTER.xlsx':       'aeropuertos',
  'AEROPUERTOS_Prospectos_MASTER_v2.xlsx':    'aeropuertos',
  'Contratistas_Aeroportuarios_MASTER.xlsx':  'aeropuertos',
  'CARTON_PAPEL_Prospectos_F1F2_v2.xlsx':     'carton_corrugado',
  'FINAL_LINEA_Prospectos_MASTER (1).xlsx':   'final_linea',
  'INTRALOGISTICA_Prospectos_MASTER.xlsx':    null, // se infiere por empresa o queda como 'logistica'
  'MOTOS_Prospectos_MASTER.xlsx':             'ensambladoras_motos',
  'RADAR_Matec_Final_Abril2026 1.xlsx':       null, // SKIP
  'SOLUMAT_Prospectos_MASTER.xlsx':           'solumat',
  'SOLUMAT_Prospectos_MASTER_F2.xlsx':        'solumat',
};

const FILES_TO_SKIP = new Set(['RADAR_Matec_Final_Abril2026 1.xlsx']);

// Hojas que NO son contactos (skip)
const SKIP_SHEET_RX = /^(sin contactos|empresas sin|resumen|leyenda|kpi)/i;

// ---------------------------------------------------------------------------
// Header detection + column role mapping
// ---------------------------------------------------------------------------
const HEADER_KEYWORDS = ['email','correo','first name','nombre','last name','apellido','title','cargo','company','empresa','linkedin','phone','telefono','apollo','pais','country','tier'];

function detectColumn(name: unknown): string | null {
  const n = String(name ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!n) return null;
  if (n === 'email' || n === 'e-mail' || n === 'correo' || n === 'mail') return 'email';
  if (n.includes('email') && (n.includes('estado') || n.includes('status') || n.includes('verificado'))) return 'email_status';
  if (n === 'first name' || n === 'first_name' || n === 'nombre' || n === 'first' || n === 'nombres') return 'first_name';
  if (n === 'last name'  || n === 'last_name'  || n === 'apellido' || n === 'last' || n === 'apellidos') return 'last_name';
  if (n === 'full name'  || n === 'full_name'  || n === 'nombre completo' || n === 'name' || n === 'fullname') return 'full_name';
  if (n === 'title' || n === 'cargo' || n === 'puesto' || n === 'job title' || n === 'job_title' || n === 'position') return 'title';
  if (n === 'seniority' || n === 'nivel' || n === 'jerarquia' || n === 'jerarquía') return 'seniority';
  if (n.includes('linkedin')) return 'linkedin_url';
  if (n === 'phone' || n === 'telefono' || n === 'teléfono' || n === 'tel directo' || n === 'tel_directo') return 'phone';
  if (n.includes('mobile') || n.includes('movil') || n.includes('móvil') || n.includes('celular')) return 'phone_mobile';
  if (n.includes('work') && (n.includes('phone') || n.includes('telefono'))) return 'phone_work';
  if (n.includes('phone') || n.includes('telefono')) return 'phone';
  if (n === 'company' || n === 'empresa' || n === 'organization' || n === 'company name' || n === 'organization_name') return 'empresa';
  if (n === 'company domain' || n === 'company_domain' || n === 'domain' || n === 'dominio' || n === 'website') return 'company_domain';
  if (n === 'apollo id' || n === 'apollo_id' || n === 'person id' || n === 'id apollo' || n === 'person_id' || n === 'persona_id') return 'apollo_id';
  if (n === 'country' || n === 'pais' || n === 'país') return 'country';
  if (n === 'city' || n === 'ciudad') return 'city';
  if (n === 'state' || n === 'departamento' || n === 'estado' || n === 'state region') return 'state';
  if (n === 'tier' || n === 'tier_actual' || n === 'tier actual' || n === 'tier_calculado') return 'tier';
  return null;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] ?? [];
    let hits = 0;
    for (const cell of row) {
      const c = String(cell ?? '').trim().toLowerCase();
      if (!c) continue;
      if (HEADER_KEYWORDS.some(k => c.includes(k))) hits++;
    }
    if (hits >= 3) return i;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface RawContact {
  source_file:   string;
  source_sheet:  string;
  row_index:     number;
  empresa_excel: string;
  empresa_match_id?: number | null;
  empresa_match_name?: string | null;
  empresa_match_method?: 'exact' | 'lower' | 'fuzzy' | 'none';
  sublinea:      string | null;
  apollo_id:     string | null;
  first_name:    string;
  last_name:     string;
  full_name:     string;
  title:         string;
  seniority:     string | null;
  email:         string | null;
  email_lower:   string | null;
  email_status:  string | null;
  linkedin_url:  string | null;
  phone_mobile:  string | null;
  phone_work:    string | null;
  country:       string | null;
  city:          string | null;
  state:         string | null;
  tier:          string | null;
  // Decisión final
  status:        'insert' | 'dup_batch' | 'dup_db' | 'no_empresa' | 'no_email_or_li' | 'invalid';
  status_reason?: string;
  dedup_key:     string;
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
async function pgQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/pg/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`pgQuery: HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

interface EmpresaInDB {
  id:           number;
  company_name: string;
  company_name_norm: string | null;
}

async function loadEmpresasMap(): Promise<{
  byName:     Map<string, EmpresaInDB[]>;     // lower exact
  list:       EmpresaInDB[];
}> {
  const rows = await pgQuery<EmpresaInDB>(`
    SELECT id, company_name, company_name_norm
    FROM matec_radar.empresas
  `);
  const byName = new Map<string, EmpresaInDB[]>();
  for (const r of rows) {
    if (!r.company_name) continue;
    const key = r.company_name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }
  return { byName, list: rows };
}

// Stopwords / tokens irrelevantes para el matching de nombres
const STOP_TOKENS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'e', 'del', 'al',
  'sa', 'sas', 'sab', 'cv', 'sl', 'inc', 'llc', 'ltd', 'corp', 'co', 'cia', 'sl',
  'colombia', 'mexico', 'méxico', 'brasil', 'brazil', 'argentina', 'chile', 'peru', 'perú',
  'ecuador', 'panama', 'panamá', 'centroamérica', 'centroamerica', 'latam',
  'group', 'grupo', 'company', 'compañía', 'corporación', 'corporation',
]);

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Saca acrónimos entre paréntesis: "Nombre Largo (ABC)" → ["abc"] */
function extractAcronyms(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\(([A-Z]{2,8})\)/g)) {
    out.push(m[1].toLowerCase());
  }
  return out;
}

/** Tokens significativos del nombre (>= 3 chars, no stopword, no número solo) */
function meaningfulTokens(s: string): Set<string> {
  const norm = normalizeName(s).replace(/[().,\/]/g, ' ').replace(/\s+/g, ' ');
  const out = new Set<string>();
  for (const tok of norm.split(' ')) {
    if (tok.length < 3) continue;
    if (STOP_TOKENS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    out.add(tok);
  }
  return out;
}

function matchEmpresa(
  excelName: string,
  empresas: { byName: Map<string, EmpresaInDB[]>; list: EmpresaInDB[] },
): { id: number | null; name: string | null; method: 'exact' | 'lower' | 'fuzzy' | 'none' } {
  if (!excelName) return { id: null, name: null, method: 'none' };

  // 1. Exact lower
  const lower = excelName.trim().toLowerCase();
  if (empresas.byName.has(lower)) {
    const m = empresas.byName.get(lower)![0];
    return { id: m.id, name: m.company_name, method: 'exact' };
  }

  // 2. Normalized exacto
  const norm = normalizeName(excelName).replace(/[().,]/g, '').replace(/\s+/g, ' ').trim();
  for (const e of empresas.list) {
    const en = normalizeName(e.company_name).replace(/[().,]/g, '').replace(/\s+/g, ' ').trim();
    if (en === norm) {
      return { id: e.id, name: e.company_name, method: 'lower' };
    }
  }

  // 3. Acronym match: si Excel o DB tiene "(XYZ)" y matchea con la otra parte
  const excelAcronyms = extractAcronyms(excelName);
  const excelTokens   = meaningfulTokens(excelName);
  const excelHead     = excelTokens.size === 0 ? '' : [...excelTokens][0];

  if (excelTokens.size >= 1) {
    let best: EmpresaInDB | null = null;
    let bestScore = 0;

    for (const e of empresas.list) {
      const dbAcronyms = extractAcronyms(e.company_name);
      const dbTokens   = meaningfulTokens(e.company_name);
      if (dbTokens.size === 0) continue;

      // Score por intersección de tokens significativos
      const inter = new Set([...excelTokens].filter(t => dbTokens.has(t)));
      const minSize = Math.min(excelTokens.size, dbTokens.size);
      const overlap = inter.size / minSize;

      // Score por acrónimos compartidos
      const acroMatch =
        excelAcronyms.some(a => dbAcronyms.includes(a)) ||
        excelAcronyms.some(a => dbTokens.has(a)) ||
        dbAcronyms.some(a => excelTokens.has(a));

      // Threshold:
      // - Si comparten acrónimo + ≥1 token → match
      // - Si overlap ≥ 0.6 (60% de tokens compartidos) Y al menos 2 tokens en común → match
      // - Si nombre Excel cabe enteramente en DB (Excel ⊂ DB tokens) → match
      const excelInDb = [...excelTokens].every(t => dbTokens.has(t));

      let score = 0;
      if (acroMatch && inter.size >= 1) score = 100 + inter.size * 5;
      else if (excelInDb && excelTokens.size >= 1) score = 80 + excelTokens.size * 5;
      else if (overlap >= 0.6 && inter.size >= 2) score = 60 + Math.round(overlap * 30);
      else if (inter.size >= 3) score = 50 + inter.size * 3;

      // Penalty: si el nombre DB tiene tokens que NO están en Excel y son países distintos al de Excel,
      // bajar score (evita matchear "Walmart México" cuando Excel dice "Walmart Argentina")
      if (score > 0) {
        const excelCountries = ['mexico','colombia','brasil','argentina','chile','peru','ecuador','panama','venezuela'].filter(c => excelName.toLowerCase().includes(c));
        const dbCountries    = ['mexico','colombia','brasil','argentina','chile','peru','ecuador','panama','venezuela'].filter(c => e.company_name.toLowerCase().includes(c));
        if (excelCountries.length > 0 && dbCountries.length > 0) {
          const sameCountry = excelCountries.some(c => dbCountries.includes(c));
          if (!sameCountry) score -= 40;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    if (best && bestScore >= 50) {
      return { id: best.id, name: best.company_name, method: 'fuzzy' };
    }
  }

  void excelHead; // unused but kept for potential future use
  return { id: null, name: null, method: 'none' };
}

// ---------------------------------------------------------------------------
// Excel reading
// ---------------------------------------------------------------------------
function readContactsFromSheet(
  ws: XLSX.WorkSheet,
  fileName: string,
  sheetName: string,
  sublineaDefault: string | null,
): RawContact[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });
  if (raw.length === 0) return [];
  const headerIdx = findHeaderRow(raw);
  const headers = (raw[headerIdx] ?? []).map(c => String(c ?? '').trim());
  const data = raw.slice(headerIdx + 1).filter(r => r && r.some(c => c !== null && c !== ''));

  const roleToIdx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const role = detectColumn(h);
    if (role && !(role in roleToIdx)) roleToIdx[role] = i;
  });

  const get = (row: unknown[], role: string): string => {
    const idx = roleToIdx[role];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const out: RawContact[] = [];
  data.forEach((row, i) => {
    const email = get(row, 'email').toLowerCase();
    const li = get(row, 'linkedin_url');
    const apolloId = get(row, 'apollo_id');
    const firstName = get(row, 'first_name');
    const lastName  = get(row, 'last_name');
    const fullName  = get(row, 'full_name') || `${firstName} ${lastName}`.trim();
    const empresa   = get(row, 'empresa');

    out.push({
      source_file: fileName,
      source_sheet: sheetName,
      row_index: headerIdx + 2 + i,
      empresa_excel: empresa,
      sublinea: sublineaDefault,
      apollo_id: apolloId || null,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      title: get(row, 'title'),
      seniority: get(row, 'seniority') || null,
      email: email || null,
      email_lower: email || null,
      email_status: get(row, 'email_status') || null,
      linkedin_url: li || null,
      phone_mobile: get(row, 'phone_mobile') || get(row, 'phone') || null,
      phone_work: get(row, 'phone_work') || null,
      country: get(row, 'country') || null,
      city: get(row, 'city') || null,
      state: get(row, 'state') || null,
      tier: get(row, 'tier') || null,
      status: 'insert',
      dedup_key: '',
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Dedup keys
// ---------------------------------------------------------------------------
function buildDedupKey(c: RawContact): string {
  if (c.apollo_id)    return `apollo:${c.apollo_id}`;
  if (c.email_lower)  return `email:${c.email_lower}`;
  if (c.linkedin_url) return `li:${c.linkedin_url.toLowerCase()}`;
  return `name+emp:${c.empresa_match_id ?? c.empresa_excel}::${normalizeName(c.full_name)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log('PASO A — DRY-RUN DE IMPORTACIÓN (no escribe en BD)');
  console.log('='.repeat(80));

  const files = readdirSync(FOLDER)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .filter(f => !FILES_TO_SKIP.has(f))
    .map(f => resolve(FOLDER, f));

  console.log(`\nProcesando ${files.length} archivos…\n`);

  // 1. Cargar empresas en memoria
  console.log('1) Cargando empresas de matec_radar.empresas…');
  const empresasMap = await loadEmpresasMap();
  console.log(`   ${empresasMap.list.length} empresas en BD\n`);

  // 2. Leer todos los Excel
  console.log('2) Leyendo Excels y extrayendo contactos…');
  const allContacts: RawContact[] = [];
  for (const path of files) {
    const fileName = basename(path);
    const sublinea = FILE_TO_SUBLINEA[fileName] ?? null;
    const wb = XLSX.readFile(path, { cellDates: true });

    let fileContacts = 0;
    for (const sheetName of wb.SheetNames) {
      if (SKIP_SHEET_RX.test(sheetName)) continue;
      const ws = wb.Sheets[sheetName];
      const contacts = readContactsFromSheet(ws, fileName, sheetName, sublinea);
      allContacts.push(...contacts);
      fileContacts += contacts.length;
    }
    console.log(`   ${fileName}: ${fileContacts} filas`);
  }
  console.log(`   TOTAL filas leídas: ${allContacts.length}\n`);

  // 3. Match empresa
  console.log('3) Matchando empresas contra matec_radar.empresas.company_name…');
  let matchedExact = 0, matchedLower = 0, matchedFuzzy = 0, unmatched = 0;
  for (const c of allContacts) {
    const m = matchEmpresa(c.empresa_excel, empresasMap);
    c.empresa_match_id = m.id;
    c.empresa_match_name = m.name;
    c.empresa_match_method = m.method;
    if (m.method === 'exact') matchedExact++;
    else if (m.method === 'lower') matchedLower++;
    else if (m.method === 'fuzzy') matchedFuzzy++;
    else unmatched++;
  }
  console.log(`   match exact: ${matchedExact} · normalizado: ${matchedLower} · fuzzy: ${matchedFuzzy} · NO encontradas: ${unmatched}\n`);

  // 4. Filtro: criterio email + LinkedIn
  console.log('4) Aplicando criterio del usuario: email + LinkedIn presentes…');
  for (const c of allContacts) {
    if (!c.email_lower || !c.linkedin_url) {
      c.status = 'no_email_or_li';
      c.status_reason = !c.email_lower ? 'sin email' : 'sin LinkedIn';
    } else if (c.empresa_match_id == null) {
      c.status = 'no_empresa';
      c.status_reason = `Empresa "${c.empresa_excel}" no existe en BD`;
    }
    c.dedup_key = buildDedupKey(c);
  }

  // 5. Dedup intra-batch (entre todos los archivos)
  console.log('5) Detectando duplicados intra-batch (entre archivos)…');
  const seenKeys = new Map<string, RawContact>();
  for (const c of allContacts) {
    if (c.status !== 'insert') continue; // solo evaluar candidatos válidos
    const prev = seenKeys.get(c.dedup_key);
    if (prev) {
      c.status = 'dup_batch';
      c.status_reason = `dup de ${prev.source_file} → ${prev.source_sheet} fila ${prev.row_index}`;
    } else {
      seenKeys.set(c.dedup_key, c);
    }
  }
  const intraDups = allContacts.filter(c => c.status === 'dup_batch').length;
  console.log(`   ${intraDups} duplicados intra-batch\n`);

  // 6. Dedup contra DB
  console.log('6) Detectando duplicados contra matec_radar.contactos en producción…');
  const candidateKeys = [...seenKeys.values()];
  const emails = candidateKeys.filter(c => c.email_lower).map(c => c.email_lower!);
  const apolloIds = candidateKeys.filter(c => c.apollo_id).map(c => c.apollo_id!);

  const escape = (s: string) => `'${s.replace(/'/g, "''")}'`;

  const dbDupEmails = new Set<string>();
  if (emails.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < emails.length; i += 500) chunks.push(emails.slice(i, i + 500));
    for (const chunk of chunks) {
      const list = chunk.map(escape).join(',');
      const rows = await pgQuery<{ email: string }>(`
        SELECT LOWER(email) AS email
        FROM matec_radar.contactos
        WHERE LOWER(email) IN (${list}) AND email IS NOT NULL
      `);
      for (const r of rows) dbDupEmails.add(r.email);
    }
  }

  const dbDupApollo = new Set<string>();
  if (apolloIds.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < apolloIds.length; i += 500) chunks.push(apolloIds.slice(i, i + 500));
    for (const chunk of chunks) {
      const list = chunk.map(escape).join(',');
      const rows = await pgQuery<{ apollo_id: string }>(`
        SELECT apollo_id
        FROM matec_radar.contactos
        WHERE apollo_id IN (${list})
      `);
      for (const r of rows) dbDupApollo.add(r.apollo_id);
    }
  }

  let dbDups = 0;
  for (const c of candidateKeys) {
    if ((c.email_lower && dbDupEmails.has(c.email_lower)) ||
        (c.apollo_id && dbDupApollo.has(c.apollo_id))) {
      c.status = 'dup_db';
      c.status_reason = c.email_lower && dbDupEmails.has(c.email_lower) ? 'email ya existe en BD' : 'apollo_id ya existe en BD';
      dbDups++;
    }
  }
  console.log(`   ${dbDups} duplicados contra DB\n`);

  // 7. Resumen final
  const tally: Record<string, number> = {};
  for (const c of allContacts) tally[c.status] = (tally[c.status] ?? 0) + 1;

  console.log('='.repeat(80));
  console.log('RESUMEN');
  console.log('='.repeat(80));
  console.log(`  Total filas leídas:          ${allContacts.length}`);
  console.log(`  ⭐ INSERT (nuevos):           ${tally.insert ?? 0}`);
  console.log(`  ⊙ Duplicados intra-batch:    ${tally.dup_batch ?? 0}`);
  console.log(`  ⊙ Duplicados contra DB:      ${tally.dup_db ?? 0}`);
  console.log(`  ✗ Sin email o LinkedIn:      ${tally.no_email_or_li ?? 0}`);
  console.log(`  ✗ Empresa no encontrada:     ${tally.no_empresa ?? 0}`);
  console.log('');

  // Por archivo
  console.log('Por archivo:');
  const byFile: Record<string, Record<string, number>> = {};
  for (const c of allContacts) {
    if (!byFile[c.source_file]) byFile[c.source_file] = {};
    byFile[c.source_file][c.status] = (byFile[c.source_file][c.status] ?? 0) + 1;
  }
  for (const [file, counts] of Object.entries(byFile)) {
    console.log(`  ${file}`);
    for (const [status, n] of Object.entries(counts)) {
      console.log(`    ${status}: ${n}`);
    }
  }

  // Empresas no matcheadas (top 30)
  const unmatchedEmpresas = new Map<string, number>();
  for (const c of allContacts) {
    if (c.empresa_match_method === 'none' && c.empresa_excel) {
      unmatchedEmpresas.set(c.empresa_excel, (unmatchedEmpresas.get(c.empresa_excel) ?? 0) + 1);
    }
  }
  const sortedUnmatched = [...unmatchedEmpresas.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\nEmpresas NO encontradas en BD (top 30 de ${sortedUnmatched.length}):`);
  for (const [name, n] of sortedUnmatched.slice(0, 30)) {
    console.log(`  ${n.toString().padStart(4)}× "${name}"`);
  }

  // Persistir reporte
  const reportPath = resolve(OUTPUT_DIR, 'import_excel_dryrun_report.json');
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    summary: tally,
    byFile,
    unmatched_empresas: Object.fromEntries(sortedUnmatched),
    contacts: allContacts,
  }, null, 2));

  const csvPath = resolve(OUTPUT_DIR, 'import_excel_dryrun_unmatched_empresas.csv');
  const csvHeader = 'empresa_excel,occurrences,source_files\n';
  const csvLines = sortedUnmatched.map(([name, count]) => {
    const sources = [...new Set(allContacts.filter(c => c.empresa_excel === name).map(c => c.source_file))].join(';');
    return `"${name.replace(/"/g, '""')}",${count},"${sources}"`;
  });
  writeFileSync(csvPath, csvHeader + csvLines.join('\n'));

  console.log(`\nReportes generados:`);
  console.log(`  ${reportPath}  (${(statSync(reportPath).size / 1024).toFixed(0)} KB)`);
  console.log(`  ${csvPath}`);
  console.log('');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
