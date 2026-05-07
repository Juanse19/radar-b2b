/**
 * scripts/apply_import_excel.ts
 *
 * Paso C — APLICA la importación. Lee tmp/import_excel_dryrun_report.json
 * (generado por dryrun_import_excel.ts) y ejecuta INSERTs en
 * matec_radar.contactos.
 *
 * Idempotente:
 *   - ON CONFLICT (apollo_id) DO NOTHING para contactos con apollo_id
 *   - ON CONFLICT (contactos_email_empresa_uk) DO NOTHING para los demás
 *   - Audit trail: notas LIKE '[IMPORT-EXCEL-2026-05-07] ...'
 *   - Rollback completo: DELETE FROM matec_radar.contactos
 *                       WHERE notas LIKE '[IMPORT-EXCEL-2026-05-07]%'
 *
 * Uso:
 *   npx tsx scripts/apply_import_excel.ts --confirm   # aplica
 *   npx tsx scripts/apply_import_excel.ts             # solo lista qué se aplicaría
 */
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REPORT_PATH = resolve(process.cwd(), 'tmp/import_excel_dryrun_report.json');
const IMPORT_TAG  = '[IMPORT-EXCEL-2026-05-07]';

const isConfirmed = process.argv.includes('--confirm');

// ---------------------------------------------------------------------------
// Tipos del reporte (subset del que genera dryrun_import_excel.ts)
// ---------------------------------------------------------------------------
interface RawContact {
  source_file:        string;
  source_sheet:       string;
  row_index:          number;
  empresa_excel:      string;
  empresa_match_id?:  number | null;
  empresa_match_name?: string | null;
  empresa_match_method?: string;
  sublinea:           string | null;
  apollo_id:          string | null;
  first_name:         string;
  last_name:          string;
  full_name:          string;
  title:              string;
  seniority:          string | null;
  email:              string | null;
  email_lower:        string | null;
  email_status:       string | null;
  linkedin_url:       string | null;
  phone_mobile:       string | null;
  phone_work:         string | null;
  country:            string | null;
  city:               string | null;
  state:              string | null;
  tier:               string | null;
  status:             string;
  status_reason?:     string;
}

interface DryRunReport {
  contacts: RawContact[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const COUNTRY_MAP: Record<string, string> = {
  'mexico': 'MX', 'méxico': 'MX', 'mx': 'MX',
  'colombia': 'CO', 'co': 'CO',
  'brasil': 'BR', 'brazil': 'BR', 'br': 'BR',
  'argentina': 'AR', 'ar': 'AR',
  'chile': 'CL', 'cl': 'CL',
  'perú': 'PE', 'peru': 'PE', 'pe': 'PE',
  'ecuador': 'EC', 'ec': 'EC',
  'uruguay': 'UY', 'uy': 'UY',
  'paraguay': 'PY', 'py': 'PY',
  'bolivia': 'BO', 'bo': 'BO',
  'venezuela': 'VE', 've': 'VE',
  'costa rica': 'CR', 'cr': 'CR',
  'panamá': 'PA', 'panama': 'PA', 'pa': 'PA',
  'guatemala': 'GT', 'gt': 'GT',
  'el salvador': 'SV', 'sv': 'SV',
  'honduras': 'HN', 'hn': 'HN',
  'nicaragua': 'NI', 'ni': 'NI',
  'república dominicana': 'DO', 'republica dominicana': 'DO', 'dominican republic': 'DO', 'do': 'DO',
  'jamaica': 'JM', 'jm': 'JM',
  'bahamas': 'BS', 'bs': 'BS',
  'estados unidos': 'US', 'united states': 'US', 'usa': 'US', 'us': 'US',
  'canadá': 'CA', 'canada': 'CA', 'ca': 'CA',
  'españa': 'ES', 'spain': 'ES', 'es': 'ES',
};

function mapCountry(c: string | null): string | null {
  if (!c) return null;
  const k = c.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return COUNTRY_MAP[k] ?? COUNTRY_MAP[c.trim().toLowerCase()] ?? 'Otro';
}

function mapSeniority(rawSeniority: string | null, title: string): string {
  const s = (rawSeniority ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('c-level') || s.includes('c level') || s === 'c_suite' || s.includes('c-suite')) return 'c_suite';
  if (s === 'vp' || s.includes('vice')) return 'director';
  if (s === 'director' || s === 'dir') return 'director';
  if (s === 'gerente' || s === 'manager' || s === 'ger') return 'manager';
  if (s === 'jefe' || s === 'coordinator' || s === 'coordinador' || s === 'supervisor') return 'manager';
  if (s === 'analista' || s === 'analyst' || s === 'specialist') return 'contributor';
  // Fallback: derivar del title con classifyLevel pattern
  const t = title.toLowerCase();
  if (/\b(ceo|coo|cfo|cto|cio|chief|presidente|founder|owner)\b/.test(t)) return 'c_suite';
  if (/\b(director|directora|vp|vice)\b/.test(t)) return 'director';
  if (/\b(gerente|manager|head of)\b/.test(t)) return 'manager';
  if (/\b(jefe|coordinador|supervisor|lead)\b/.test(t)) return 'manager';
  return 'contributor';
}

function mapNivelJerarquico(seniority: string, rawSeniority: string | null, title: string): string {
  // Si Excel ya lo trae literal C-LEVEL / DIRECTOR / GERENTE / JEFE / ANALISTA, usarlo
  const r = (rawSeniority ?? '').trim().toUpperCase();
  if (['C-LEVEL', 'C LEVEL', 'CLEVEL'].includes(r)) return 'C-LEVEL';
  if (['DIRECTOR', 'DIRECTORA', 'DIR', 'VP', 'VICE PRESIDENT'].includes(r)) return 'DIRECTOR';
  if (['GERENTE', 'MANAGER', 'GER'].includes(r)) return 'GERENTE';
  if (['JEFE', 'COORDINADOR', 'COORDINATOR', 'SUPERVISOR', 'LEAD'].includes(r)) return 'JEFE';
  if (['ANALISTA', 'ANALYST', 'SPECIALIST'].includes(r)) return 'ANALISTA';

  // Else: derivar del title
  const t = title.toLowerCase();
  if (/\bvice president\b|\bvp\b/.test(t)) return 'DIRECTOR';
  if (/\b(ceo|coo|cfo|cto|cio|chief\s+\w+\s+officer|presidente|president|founder|fundador|owner|gerente general|director general|managing director|country manager)\b/.test(t)) return 'C-LEVEL';
  if (/\b(director|directora)\b/.test(t)) return 'DIRECTOR';
  if (/\b(gerente|manager|head of|plant manager)\b/.test(t)) return 'GERENTE';
  if (/\b(jefe|coordinador|coordinator|supervisor|lead|encargado)\b/.test(t)) return 'JEFE';

  // Fallback genérico desde seniority normalizado
  if (seniority === 'c_suite')   return 'C-LEVEL';
  if (seniority === 'director')  return 'DIRECTOR';
  if (seniority === 'manager')   return 'GERENTE';
  return 'ANALISTA';
}

function mapEmailStatus(rawStatus: string | null, sheetName: string): string {
  const s = (rawStatus ?? '').trim().toLowerCase();
  if (s === 'verified' || s === 'verificado' || s === 'verified ✓' || s === 'sí' || s === 'si' || s === 'yes' || s === 'true') return 'verified';
  if (s === 'extrapolated' || s === 'inferido') return 'extrapolated';
  if (s === 'probable') return 'probable';
  // Si la hoja se llama "Emails Verificados", asumir verified
  if (/emails?.*verific/i.test(sheetName)) return 'verified';
  return 'probable';
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
function escSql(v: string | null | undefined): string {
  if (v == null) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function pgQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/pg/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`pgQuery HTTP ${r.status}: ${text.slice(0, 600)}`);
  }
  return r.json();
}

// ---------------------------------------------------------------------------
// Build SQL row literal
// ---------------------------------------------------------------------------
function buildInsertValues(c: RawContact): { sql: string; key: string } {
  const empresaId = c.empresa_match_id!;
  const seniority = mapSeniority(c.seniority, c.title);
  const nivel     = mapNivelJerarquico(seniority, c.seniority, c.title);
  const country   = mapCountry(c.country);
  const emailSt   = mapEmailStatus(c.email_status, c.source_sheet);

  // Construir notas con audit trail
  const notas = `${IMPORT_TAG} ${c.source_file} → ${c.source_sheet} fila ${c.row_index}`;

  const phoneMobile = c.phone_mobile || null;
  const phoneWork   = c.phone_work || null;
  const corpPhone   = null;

  const apolloIdSafe = c.apollo_id || null;

  // Apollo ID UNIQUE: si está, usamos ese
  // Si no, dependemos del unique compuesto (empresa_id, lower(email)) que ya existe
  const sql = `(
    ${empresaId},                                                            -- empresa_id
    NULL,                                                                     -- prospeccion_id
    ${escSql(c.first_name || null)},                                         -- first_name
    ${escSql(c.last_name || null)},                                          -- last_name
    ${escSql(c.title || null)},                                              -- title
    ${escSql(seniority)},                                                    -- seniority
    NULL,                                                                     -- departamento
    ${escSql(c.email_lower || c.email || null)},                             -- email
    ${escSql(emailSt)},                                                      -- email_status
    NULL,                                                                     -- email_confidence
    ${escSql(phoneWork)},                                                    -- phone_work_direct
    ${escSql(phoneMobile)},                                                  -- phone_mobile
    ${escSql(corpPhone)},                                                    -- corporate_phone
    ${escSql(c.linkedin_url || null)},                                       -- linkedin_url
    ${escSql(c.city || null)},                                               -- city
    ${escSql(c.state || null)},                                              -- state
    ${country ? `${escSql(country)}::matec_radar.pais_iso_enum` : 'NULL'},   -- country
    ${escSql(apolloIdSafe)},                                                 -- apollo_id
    NULL,                                                                     -- apollo_person_raw
    NULL,                                                                     -- hubspot_id
    'pendiente',                                                              -- hubspot_status
    NULL,                                                                     -- hubspot_synced_at
    ${escSql(notas)},                                                        -- notas
    NOW(),                                                                    -- created_at
    NOW(),                                                                    -- updated_at
    ${phoneMobile ? 'TRUE' : 'FALSE'},                                       -- phone_unlocked
    ${phoneMobile ? 'NOW()' : 'NULL'},                                       -- phone_unlocked_at
    TRUE,                                                                     -- fase2_done
    ${escSql(nivel)},                                                        -- nivel_jerarquico
    NULL,                                                                     -- prospector_session_id
    FALSE                                                                     -- es_principal
  )`;

  const key = c.apollo_id ? `apollo:${c.apollo_id}` : `email:${empresaId}:${(c.email_lower || c.email || '').toLowerCase()}`;
  return { sql, key };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PASO C — APPLY ${isConfirmed ? '(MODO CONFIRMADO)' : '(modo preview — agregue --confirm para escribir)'}`);
  console.log('='.repeat(80));

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes');
    process.exit(1);
  }

  // 1. Leer reporte dry-run
  let report: DryRunReport;
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8')) as DryRunReport;
  } catch (e) {
    console.error('No pude leer el reporte dry-run:', (e as Error).message);
    console.error('Corra primero: npx tsx scripts/dryrun_import_excel.ts');
    process.exit(1);
  }

  const candidates = report.contacts.filter(c => c.status === 'insert' && c.empresa_match_id != null);
  console.log(`\nCandidatos a INSERTAR: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nada que importar.');
    return;
  }

  // 2. Si no está --confirm, mostrar muestra y salir
  if (!isConfirmed) {
    console.log('\nMuestra (primeros 5):');
    for (const c of candidates.slice(0, 5)) {
      console.log(`  ${c.full_name}  <${c.email}>  → empresa #${c.empresa_match_id} ${c.empresa_match_name}  · ${c.source_file} → ${c.source_sheet}`);
    }
    console.log(`\nPara escribir en BD ejecuta de nuevo con: --confirm`);
    return;
  }

  // 3. Apply en batches de 50
  console.log('\nEjecutando INSERTs en batches de 50…');
  const COLS = `(
    empresa_id, prospeccion_id, first_name, last_name, title, seniority, departamento,
    email, email_status, email_confidence, phone_work_direct, phone_mobile, corporate_phone,
    linkedin_url, city, state, country, apollo_id, apollo_person_raw,
    hubspot_id, hubspot_status, hubspot_synced_at, notas, created_at, updated_at,
    phone_unlocked, phone_unlocked_at, fase2_done, nivel_jerarquico,
    prospector_session_id, es_principal
  )`;

  const batchSize = 50;
  let inserted = 0;
  let conflictApollo = 0;
  let conflictEmail = 0;
  let errors = 0;
  const errorDetails: Array<{ row: RawContact; error: string }> = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    // Estrategia: insertar uno por uno con ON CONFLICT DO NOTHING para
    // poder distinguir cuántos fueron por apollo_id vs email_uk.
    // Es más seguro que batch INSERT con multi-VALUES porque DB rechazaría
    // todo el batch si una fila viola constraint.

    for (const c of batch) {
      const { sql: values } = buildInsertValues(c);

      // Primero intentamos con ON CONFLICT DO NOTHING contra ambos uniques.
      // Postgres ON CONFLICT solo soporta UN unique constraint a la vez,
      // así que hacemos try-catch escalando.
      const insertSql = `
        INSERT INTO matec_radar.contactos ${COLS}
        VALUES ${values}
        ON CONFLICT (apollo_id) DO NOTHING
        RETURNING id
      `;

      try {
        const result = await pgQuery<{ id: number }>(insertSql);
        if (result.length === 0) {
          conflictApollo++;
        } else {
          inserted++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Si falló por contactos_email_empresa_uk, es un dup por email — OK
        if (msg.includes('contactos_email_empresa_uk') || msg.includes('duplicate key value')) {
          conflictEmail++;
          // Intentar de nuevo sin apollo_id (por si hay conflicto distinto)
          continue;
        }
        errors++;
        if (errorDetails.length < 10) errorDetails.push({ row: c, error: msg.slice(0, 300) });
      }
    }

    process.stdout.write(`\r  ${Math.min(i + batchSize, candidates.length)}/${candidates.length}  · OK=${inserted} · skipApollo=${conflictApollo} · skipEmail=${conflictEmail} · err=${errors}`);
  }
  console.log('\n');

  // 4. Reporte final
  console.log('='.repeat(80));
  console.log('RESULTADO');
  console.log('='.repeat(80));
  console.log(`  Insertados:                        ${inserted}`);
  console.log(`  Skip por apollo_id duplicado:      ${conflictApollo}`);
  console.log(`  Skip por email+empresa duplicado:  ${conflictEmail}`);
  console.log(`  Errores:                           ${errors}`);
  console.log('');

  if (errorDetails.length > 0) {
    console.log('Primeros errores:');
    for (const e of errorDetails) {
      console.log(`  · ${e.row.full_name} <${e.row.email}> @ empresa #${e.row.empresa_match_id}`);
      console.log(`    ${e.error}`);
    }
  }

  // 5. Verificación: contar contactos importados
  const verify = await pgQuery<{ n: number }>(`
    SELECT COUNT(*) AS n FROM matec_radar.contactos
    WHERE notas LIKE '${IMPORT_TAG}%'
  `);
  console.log(`\nVerificación en DB:  ${verify[0]?.n ?? 0} contactos con notas ${IMPORT_TAG}`);
  console.log(`\nPara rollback:  DELETE FROM matec_radar.contactos WHERE notas LIKE '${IMPORT_TAG}%'`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
