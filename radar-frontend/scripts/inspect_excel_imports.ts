/**
 * scripts/inspect_excel_imports.ts
 *
 * Lee TODOS los Excel de C:\Users\Juan\Downloads\contactosApolloSublinea
 * con detección automática de header row (los archivos de Matec tienen
 * filas-banner antes del header real).
 *
 * Uso: npx tsx scripts/inspect_excel_imports.ts
 */
import * as XLSX from 'xlsx';
import { readdirSync, statSync } from 'fs';
import { resolve, basename } from 'path';

const FOLDER = 'C:/Users/Juan/Downloads/contactosApolloSublinea';

const HEADER_KEYWORDS = [
  'email', 'correo', 'first name', 'nombre', 'last name', 'apellido',
  'title', 'cargo', 'puesto', 'company', 'empresa', 'linkedin',
  'phone', 'telefono', 'apollo', 'pais', 'country', 'tier',
];

/** Detecta el rol de una columna por su nombre */
function detectColumn(name: unknown): string | null {
  const n = String(name ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!n) return null;

  // Email
  if (n === 'email' || n === 'e-mail' || n === 'correo' || n === 'correo electronico' || n === 'mail') return 'email';
  if (n.includes('email') && (n.includes('estado') || n.includes('status') || n.includes('verificado'))) return 'email_status';

  // Nombre / apellido
  if (n === 'first name' || n === 'first_name' || n === 'nombre' || n === 'first' || n === 'nombres') return 'first_name';
  if (n === 'last name'  || n === 'last_name'  || n === 'apellido' || n === 'last' || n === 'apellidos') return 'last_name';
  if (n === 'full name'  || n === 'full_name'  || n === 'nombre completo' || n === 'name' || n === 'fullname') return 'full_name';

  // Cargo
  if (n === 'title' || n === 'cargo' || n === 'puesto' || n === 'job title' || n === 'job_title' || n === 'position') return 'title';
  if (n === 'seniority' || n === 'nivel' || n === 'jerarquia' || n === 'jerarquía') return 'seniority';

  // LinkedIn
  if (n.includes('linkedin')) return 'linkedin_url';

  // Teléfono
  if (n === 'phone' || n === 'telefono' || n === 'teléfono') return 'phone';
  if (n.includes('mobile') || n.includes('movil') || n.includes('móvil') || n.includes('celular')) return 'phone_mobile';
  if (n.includes('work') && (n.includes('phone') || n.includes('telefono'))) return 'phone_work';
  if (n.includes('phone') || n.includes('telefono')) return 'phone';

  // Empresa
  if (n === 'company' || n === 'empresa' || n === 'organization' || n === 'company name' || n === 'organization_name') return 'empresa';
  if (n === 'company domain' || n === 'company_domain' || n === 'domain' || n === 'dominio' || n === 'website') return 'company_domain';

  // Apollo
  if (n === 'apollo id' || n === 'apollo_id' || n === 'person id' || n === 'id apollo' || n === 'person_id') return 'apollo_id';

  // Ubicación
  if (n === 'country' || n === 'pais' || n === 'país') return 'country';
  if (n === 'city' || n === 'ciudad') return 'city';
  if (n === 'state' || n === 'departamento' || n === 'estado') return 'state';

  // Tier
  if (n === 'tier' || n === 'tier_actual' || n === 'tier actual' || n === 'tier_calculado') return 'tier';

  return null;
}

/**
 * Detecta el header row buscando la primera fila que contenga >= 3 keywords conocidos.
 * Devuelve el índice 0-based de la fila de headers.
 */
function findHeaderRow(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
    const row = rawRows[i] ?? [];
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

interface SheetReport {
  sheet:           string;
  headerRowIdx:    number;
  rows:            number;
  columns:         string[];
  detected:        Record<string, string>;
  unmapped:        string[];
  withEmail:       number;
  withLinkedin:    number;
  withEmailAndLinkedin: number;
  withPhone:       number;
  uniqueEmpresas:  number;
  empresasSample:  string[];
  sample?:         Record<string, unknown>;
}

interface FileReport {
  file:    string;
  size_kb: number;
  sheets:  SheetReport[];
}

function inspectSheet(ws: XLSX.WorkSheet, name: string): SheetReport {
  // Leer todo como array-of-arrays para detectar header row
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });
  if (raw.length === 0) {
    return {
      sheet: name, headerRowIdx: 0, rows: 0, columns: [], detected: {}, unmapped: [],
      withEmail: 0, withLinkedin: 0, withEmailAndLinkedin: 0, withPhone: 0,
      uniqueEmpresas: 0, empresasSample: [],
    };
  }

  const headerIdx = findHeaderRow(raw);
  const headers = (raw[headerIdx] ?? []).map(c => String(c ?? '').trim());
  const dataRows = raw.slice(headerIdx + 1).filter(r => r && r.some(c => c !== null && c !== ''));

  // Detect roles
  const detected: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const h of headers) {
    if (!h) continue;
    const role = detectColumn(h);
    if (role) detected[h] = role;
    else      unmapped.push(h);
  }

  // Reverse map role → column index
  const roleToIdx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const role = detected[h];
    if (role && !(role in roleToIdx)) roleToIdx[role] = i;
  });

  const get = (row: unknown[], role: string): string => {
    const idx = roleToIdx[role];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  let withEmail = 0, withLi = 0, withBoth = 0, withPhone = 0;
  const empresas = new Set<string>();
  for (const row of dataRows) {
    const email = get(row, 'email');
    const li    = get(row, 'linkedin_url');
    const phone = get(row, 'phone') || get(row, 'phone_mobile') || get(row, 'phone_work');
    const emp   = get(row, 'empresa');
    if (email) withEmail++;
    if (li.includes('linkedin')) withLi++;
    if (email && li.includes('linkedin')) withBoth++;
    if (phone) withPhone++;
    if (emp) empresas.add(emp);
  }

  // Sample row: build object header → value
  const sampleRow = dataRows[0] ?? [];
  const sample: Record<string, unknown> = {};
  headers.forEach((h, i) => { if (h) sample[h] = sampleRow[i]; });

  return {
    sheet: name,
    headerRowIdx: headerIdx,
    rows: dataRows.length,
    columns: headers,
    detected,
    unmapped,
    withEmail,
    withLinkedin: withLi,
    withEmailAndLinkedin: withBoth,
    withPhone,
    uniqueEmpresas: empresas.size,
    empresasSample: [...empresas].slice(0, 5),
    sample,
  };
}

function inspectFile(path: string): FileReport {
  const wb = XLSX.readFile(path, { cellDates: true });
  const sizeKb = Math.round(statSync(path).size / 1024);
  const sheets = wb.SheetNames.map(n => inspectSheet(wb.Sheets[n], n));
  return { file: basename(path), size_kb: sizeKb, sheets };
}

(async () => {
  const files = readdirSync(FOLDER)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .map(f => resolve(FOLDER, f));

  console.log(`\n${'='.repeat(80)}`);
  console.log(`INSPECCIÓN DE EXCELS — ${files.length} archivos`);
  console.log('='.repeat(80));

  const reports: FileReport[] = [];
  for (const path of files) {
    try { reports.push(inspectFile(path)); }
    catch (e) { console.error(`ERROR ${basename(path)}:`, (e as Error).message); }
  }

  for (const r of reports) {
    console.log(`\n📄 ${r.file}  (${r.size_kb} KB)`);
    for (const s of r.sheets) {
      const isMaster = /^prospect|^email|^contact/i.test(s.sheet) && s.rows > 5;
      const marker  = isMaster ? '⭐' : '  ';
      console.log(`  ${marker} "${s.sheet}" — header en fila ${s.headerRowIdx + 1}, ${s.rows} filas datos`);
      if (s.rows === 0) continue;
      if (Object.keys(s.detected).length > 0) {
        const compact = Object.entries(s.detected)
          .map(([h, r]) => `${r}=«${h.slice(0, 25)}»`)
          .join('  ');
        console.log(`     mapeo: ${compact}`);
      }
      if (s.unmapped.length) {
        console.log(`     sin rol (${s.unmapped.length}): ${s.unmapped.slice(0, 5).join(', ')}${s.unmapped.length > 5 ? '…' : ''}`);
      }
      console.log(`     email=${s.withEmail}/${s.rows}  LI=${s.withLinkedin}  email+LI=${s.withEmailAndLinkedin}  tel=${s.withPhone}  empresas=${s.uniqueEmpresas}`);
      if (isMaster && s.empresasSample.length) {
        console.log(`     muestra empresas: ${s.empresasSample.join(' · ')}`);
      }
    }
  }

  let totalRows = 0, totalEmail = 0, totalLi = 0, totalBoth = 0, totalPhone = 0;
  for (const r of reports) for (const s of r.sheets) {
    totalRows += s.rows; totalEmail += s.withEmail; totalLi += s.withLinkedin;
    totalBoth += s.withEmailAndLinkedin; totalPhone += s.withPhone;
  }
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TOTAL: ${totalRows} filas · ${totalEmail} con email · ${totalLi} con LI · ${totalBoth} email+LI ⭐ · ${totalPhone} con tel`);
  console.log('='.repeat(80));
})().catch(e => { console.error(e); process.exit(1); });
