/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * fix_persist_nodes.js
 *
 * Replaces the DO $$ block SQL in the "Code: Build Supabase Persist" nodes
 * of WF01, WF02, and WF03 with the correct CTE approach that handles the
 * partial unique index: empresas_name_norm_uk WHERE owner_id IS NULL.
 *
 * Run: node tools/fix_persist_nodes.js
 * Requires: N8N_HOST and N8N_API_KEY in .env.local
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Load env
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) acc[k.trim()] = v.join('=').trim();
    return acc;
  }, {});

const N8N_HOST = env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_KEY  = env.N8N_API_KEY;
const SUPA_URL = env.SUPABASE_URL || 'https://supabase.valparaiso.cafe';
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!N8N_KEY) { console.error('Missing N8N_API_KEY in .env.local'); process.exit(1); }

// ─── N8N API helper ──────────────────────────────────────────────────────────

function n8nReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const u = new URL(N8N_HOST + path);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── CTE JavaScript code for each workflow's Code node ───────────────────────
// These run INSIDE n8n (no require, uses $input, returns array).

const WF01_CODE = `
// WF01: Persist empresa + calificacion to Supabase (CTE approach)
// Handles partial unique index: empresas_name_norm_uk WHERE owner_id IS NULL
const d = $input.item.json;

const esc = v =>
  (v === null || v === undefined || v === '')
    ? 'NULL'
    : "'" + String(v).replace(/'/g, "''") + "'";

const num = v => {
  const n = parseFloat(v);
  return (v === null || v === undefined || v === '' || isNaN(n)) ? 'NULL' : n;
};

const empresa    = (d.empresa || d.company_name || '').replace(/'/g, "''");
const dominio    = d.company_domain || d.dominio || null;
const paisNombre = d.pais || null;

const scoreCal   = Number(d.score_calificacion || d.score_total || 0);
const tier       = d.tier || d.tier_calculado || 'ARCHIVO';
const seg        = d.segmentacion || {};
const razon      = d.razonamiento_agente || null;
const anioObj    = seg.anio_objetivo || d.anio_objetivo || null;
const ticketRaw  = seg.ticket_estimado || d.ticket_estimado || null;
const modelo     = d.modelo_llm || 'gpt-4.1-mini';

// WF01 tier string → tier_enum ('A'/'B'/'C'/'D'/'sin_calificar')
const TIER_MAP = { 'ORO': 'A', 'MONITOREO': 'B', 'ARCHIVO': 'C' };
const tierEnum = TIER_MAP[tier] || 'C';

// Score sub-dimensions from segmentacion
const scoreImpacto    = num(seg.score_impacto    || null);
const scoreMulti      = num(seg.score_multiplanta || null);
const scoreRecurr     = num(seg.score_recurrencia || null);
const scoreRef        = num(seg.score_referente   || null);
const scoreAnio       = num(seg.score_anio        || null);
const scoreTicket     = num(seg.score_ticket      || null);
const scorePrio       = num(seg.score_prioridad   || null);

const anioNum  = anioObj ? parseInt(anioObj, 10) : null;
const anioSql  = (!anioNum || isNaN(anioNum)) ? 'NULL' : anioNum;

const sql = [
  'WITH emp_upsert AS (',
  '  INSERT INTO matec_radar.empresas (company_name, company_domain, pais_nombre)',
  '  VALUES (' + esc(empresa) + ', ' + esc(dominio) + ', ' + esc(paisNombre) + ')',
  '  ON CONFLICT (company_name_norm) WHERE owner_id IS NULL',
  '  DO UPDATE SET',
  '    company_domain = COALESCE(EXCLUDED.company_domain, matec_radar.empresas.company_domain),',
  '    pais_nombre    = COALESCE(EXCLUDED.pais_nombre,    matec_radar.empresas.pais_nombre),',
  '    updated_at     = NOW()',
  '  RETURNING id',
  '),',
  'cal_insert AS (',
  '  INSERT INTO matec_radar.calificaciones',
  '    (empresa_id, score_total, tier_calculado,',
  '     score_impacto, score_multiplanta, score_recurrencia,',
  '     score_referente, score_anio, score_ticket, score_prioridad,',
  '     razonamiento_agente, anio_objetivo, rango_ticket,',
  '     prompt_version, modelo_llm)',
  '  SELECT id,',
  '    ' + num(scoreCal) + ', ' + "'" + tierEnum + "'::matec_radar.tier_enum,",
  '    ' + scoreImpacto + ', ' + scoreMulti + ', ' + scoreRecurr + ',',
  '    ' + scoreRef + ', ' + scoreAnio + ', ' + scoreTicket + ', ' + scorePrio + ',',
  '    ' + esc(razon) + ', ' + anioSql + ', ' + esc(ticketRaw) + ',',
  "    'wf01-v1.0', 'gpt-4.1-mini'",
  '  FROM emp_upsert',
  '  RETURNING id',
  ')',
  "SELECT 'ok' AS result"
].join('\\n');

return [{ json: { ...d, _supabase_sql: sql } }];
`.trim();

const WF02_CODE = `
// WF02: Persist empresa + radar_scan to Supabase (CTE approach)
// Handles partial unique index: empresas_name_norm_uk WHERE owner_id IS NULL
const d = $input.item.json;

const esc = v =>
  (v === null || v === undefined || v === '')
    ? 'NULL'
    : "'" + String(v).replace(/'/g, "''") + "'";

const num = v => {
  const n = parseFloat(v);
  return (v === null || v === undefined || v === '' || isNaN(n)) ? 'NULL' : n;
};

const empresa         = (d.empresa || d.company_name || '').replace(/'/g, "''");
const dominio         = d.company_domain || null;
const paisNombre      = d.pais || null;

const scoreRadar      = num(d.score_radar || d.score_radar_calculado || 0);
const composite       = num(d.composite_score || null);
const tier            = d.tier || d.tier_compuesto || 'ARCHIVO';
const radarActivo     = (d.radar_activo === true || d.radar_activo === 'true') ? 'TRUE' : 'FALSE';
const tipoSenal       = d.tipo_senal || null;
const descripSenal    = d.descripcion_senal || d.senal_detectada || null;
const fechaSenal      = d.fecha_senal || null;
const razon           = d.razonamiento_agente || null;
const tavilyQueries   = num(d.tavily_queries || null);

// Criteria scores
const critFuente      = num(d.criterio_fuente    || d.score_fuente    || null);
const critCapex       = num(d.criterio_capex     || d.score_capex     || null);
const critHorizonte   = num(d.criterio_horizonte || d.score_horizonte || null);
const critMonto       = num(d.criterio_monto     || d.score_monto     || null);
const critMulti       = num(d.criterio_multi_fuentes || d.score_multi_fuentes || null);

// WF02 tier → tier_enum
const TIER_MAP = { 'ORO': 'A', 'MONITOREO': 'B', 'ARCHIVO': 'C' };
const tierEnum = TIER_MAP[tier] || 'C';

// Ventana compra mapping
const ventanaRaw = d.ventana_compra || 'desconocida';
const VENTANA_MAP = {
  '0-6m': '0_6m', '6-12m': '6_12m', '12-18m': '12_18m',
  '18-24m': '18_24m', 'mas_24m': 'mas_24m', 'desconocida': 'desconocida'
};
const ventana = VENTANA_MAP[ventanaRaw] || 'desconocida';

const sql = [
  'WITH emp_upsert AS (',
  '  INSERT INTO matec_radar.empresas (company_name, company_domain, pais_nombre)',
  '  VALUES (' + esc(empresa) + ', ' + esc(dominio) + ', ' + esc(paisNombre) + ')',
  '  ON CONFLICT (company_name_norm) WHERE owner_id IS NULL',
  '  DO UPDATE SET',
  '    company_domain          = COALESCE(EXCLUDED.company_domain, matec_radar.empresas.company_domain),',
  '    pais_nombre             = COALESCE(EXCLUDED.pais_nombre,    matec_radar.empresas.pais_nombre),',
  '    score_radar_ultimo      = ' + num(scoreRadar) + ',',
  '    composite_score_ultimo  = ' + num(composite)  + ',',
  '    updated_at              = NOW()',
  '  RETURNING id',
  '),',
  'scan_insert AS (',
  '  INSERT INTO matec_radar.radar_scans',
  '    (empresa_id, score_radar, composite_score, tier_compuesto,',
  '     radar_activo, ventana_compra,',
  '     tipo_senal, descripcion_senal, fecha_senal,',
  '     criterio_fuente, criterio_capex, criterio_horizonte, criterio_monto, criterio_multi_fuentes,',
  '     razonamiento_agente, tavily_queries, prompt_version, modelo_llm)',
  '  SELECT id,',
  '    ' + num(scoreRadar) + ', ' + num(composite) + ", '" + tierEnum + "'::matec_radar.tier_enum,",
  '    ' + radarActivo + ", '" + ventana + "'::matec_radar.ventana_compra_enum,",
  '    ' + esc(tipoSenal) + ', ' + esc(descripSenal) + ', ' + esc(fechaSenal) + ',',
  '    ' + critFuente + ', ' + critCapex + ', ' + critHorizonte + ', ' + critMonto + ', ' + critMulti + ',',
  '    ' + esc(razon) + ', ' + tavilyQueries + ", 'wf02-v1.0', 'gpt-4o'",
  '  FROM emp_upsert',
  '  RETURNING id',
  ')',
  "SELECT 'ok' AS result"
].join('\\n');

return [{ json: { ...d, _supabase_sql: sql } }];
`.trim();

const WF03_CODE = `
// WF03: Persist empresa + prospeccion + contactos to Supabase (CTE approach)
// Handles partial unique index: empresas_name_norm_uk WHERE owner_id IS NULL
const d = $input.item.json;

const esc = v =>
  (v === null || v === undefined || v === '')
    ? 'NULL'
    : "'" + String(v).replace(/'/g, "''") + "'";

const num = v => {
  const n = parseFloat(v);
  return (v === null || v === undefined || v === '' || isNaN(n)) ? 'NULL' : n;
};

const empresa    = (d.empresa || d.company_name || '').replace(/'/g, "''");
const dominio    = d.company_domain || null;
const paisNombre = d.pais || null;
const contacts   = d.contactos || d.contacts || [];

// Prospeccion fields
const jobTitles  = d.job_titles_usados || [];
const paises     = d.paises || (paisNombre ? [paisNombre] : []);
const maxContacts = num(d.max_contacts || contacts.length || 0);
const found       = contacts.length;

const jobTitlesLit  = 'ARRAY[' + jobTitles.map(t => esc(t)).join(',') + ']::text[]';
const paisesLit     = 'ARRAY[' + paises.map(p => esc(p)).join(',') + ']::text[]';

// Build INSERT rows for contacts (max 10 for safety)
const contactRows = contacts.slice(0, 10).map(c => {
  const apolloId  = c.apollo_id || c.id || null;
  const firstName = c.first_name || null;
  const lastName  = c.last_name || null;
  const title     = c.title || c.cargo || null;
  const email     = c.email || null;
  const emailStat = c.email_status || null;
  const linkedin  = c.linkedin_url || null;
  const phone     = c.phone_numbers && c.phone_numbers[0] && c.phone_numbers[0].sanitized_number
                    ? c.phone_numbers[0].sanitized_number : (c.corporate_phone || null);
  return '(' + [esc(apolloId), esc(firstName), esc(lastName), esc(title), esc(email), esc(emailStat), esc(linkedin), esc(phone)].join(', ') + ')';
}).join(',\\n    ');

const hasContacts = contacts.length > 0;

// CTE: upsert empresa → insert prospeccion → insert contacts (if any)
const parts = [
  'WITH emp_upsert AS (',
  '  INSERT INTO matec_radar.empresas (company_name, company_domain, pais_nombre)',
  '  VALUES (' + esc(empresa) + ', ' + esc(dominio) + ', ' + esc(paisNombre) + ')',
  '  ON CONFLICT (company_name_norm) WHERE owner_id IS NULL',
  '  DO UPDATE SET',
  '    company_domain = COALESCE(EXCLUDED.company_domain, matec_radar.empresas.company_domain),',
  '    updated_at     = NOW()',
  '  RETURNING id',
  '),',
  'prosp_insert AS (',
  '  INSERT INTO matec_radar.prospecciones',
  '    (empresa_id, estado, job_titles_usados, paises_buscados, max_contacts, contactos_encontrados)',
  "  SELECT id, 'encontrado'::matec_radar.estado_prospeccion_enum,",
  '    ' + jobTitlesLit + ', ' + paisesLit + ', ' + maxContacts + ', ' + found,
  '  FROM emp_upsert',
  '  RETURNING id AS prosp_id, empresa_id',
  ')',
];

if (hasContacts) {
  parts.push(
    ', contacts_insert AS (',
    '  INSERT INTO matec_radar.contactos',
    '    (empresa_id, apollo_id, first_name, last_name, title, email, email_status, linkedin_url, phone_work_direct, hubspot_status)',
    '  SELECT p.empresa_id,',
    '    v.apollo_id, v.first_name, v.last_name, v.title, v.email, v.email_status, v.linkedin_url, v.phone,',
    "    'pendiente'::matec_radar.hubspot_status_enum",
    '  FROM prosp_insert p',
    '  CROSS JOIN (VALUES',
    '    ' + contactRows,
    '  ) AS v(apollo_id, first_name, last_name, title, email, email_status, linkedin_url, phone)',
    '  ON CONFLICT (apollo_id) WHERE apollo_id IS NOT NULL',
    '  DO UPDATE SET',
    '    title          = COALESCE(EXCLUDED.title, matec_radar.contactos.title),',
    '    email          = COALESCE(EXCLUDED.email, matec_radar.contactos.email),',
    '    updated_at     = NOW()',
    '  RETURNING id',
    ')'
  );
}

parts.push("SELECT 'ok' AS result");

const sql = parts.join('\\n');

return [{ json: { ...d, _supabase_sql: sql } }];
`.trim();

// ─── Workflow patch targets ──────────────────────────────────────────────────

const WORKFLOWS = [
  {
    id:       'jDtdafuyYt8TXISl',
    name:     'WF01',
    nodeName: 'Code: Build Supabase Persist (WF01)',
    code:     WF01_CODE,
  },
  {
    id:       'fko0zXYYl5X4PtHz',
    name:     'WF02',
    nodeName: 'Code: Build Supabase Persist (WF02)',
    code:     WF02_CODE,
  },
  {
    id:       'RLUDpi3O5Rb6WEYJ',
    name:     'WF03',
    nodeName: 'Code: Build Supabase Persist (WF03)',
    code:     WF03_CODE,
  },
];

// ─── Also ensure HTTP nodes have correct Supabase key in JSON body expression ─

async function patchWorkflow(wf) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Patching ${wf.name} (${wf.id})...`);

  // 1. Fetch current workflow
  const { status, data: workflow } = await n8nReq('GET', `/api/v1/workflows/${wf.id}`);
  if (status !== 200) {
    console.error(`  ✗ GET failed (HTTP ${status}):`, JSON.stringify(workflow).slice(0, 200));
    return false;
  }
  console.log(`  ✓ Fetched: "${workflow.name}" (${workflow.nodes.length} nodes)`);

  // 2. Find target Code node
  const codeNode = workflow.nodes.find(n => n.name === wf.nodeName);
  if (!codeNode) {
    // List all node names to help diagnose
    const codeNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.code');
    console.warn(`  ⚠ Node "${wf.nodeName}" not found.`);
    console.warn(`    Code nodes present: ${codeNodes.map(n => n.name).join(', ') || 'none'}`);
    return false;
  }

  const oldCode = codeNode.parameters && codeNode.parameters.jsCode
    ? codeNode.parameters.jsCode.slice(0, 80)
    : '(none)';
  console.log(`  ✓ Found node: "${codeNode.name}"`);
  console.log(`    Old code preview: ${oldCode.replace(/\n/g, ' ')}...`);

  // 3. Replace jsCode
  codeNode.parameters = {
    ...codeNode.parameters,
    jsCode: wf.code,
  };

  // 4. Also patch the matching HTTP node to ensure correct SUPABASE_SERVICE_ROLE_KEY
  const httpNode = workflow.nodes.find(n => n.name.startsWith('HTTP: Supabase Persist'));
  if (httpNode) {
    // Ensure headers include service role key
    const existingHeaders = (httpNode.parameters.headerParameters && httpNode.parameters.headerParameters.parameters) || [];
    const hasApiKey   = existingHeaders.some(h => h.name === 'apikey');
    const hasAuthHdr  = existingHeaders.some(h => h.name === 'Authorization');
    if (!hasApiKey || !hasAuthHdr) {
      console.log(`  ⚠ HTTP node "${httpNode.name}" missing auth headers — adding...`);
      httpNode.parameters.headerParameters = {
        parameters: [
          { name: 'apikey',         value: SUPA_KEY },
          { name: 'Authorization',  value: 'Bearer ' + SUPA_KEY },
          { name: 'Content-Type',   value: 'application/json' },
        ],
      };
    } else {
      console.log(`  ✓ HTTP node "${httpNode.name}" already has auth headers`);
    }
  } else {
    console.warn(`  ⚠ No HTTP Supabase node found in ${wf.name}`);
  }

  // 5. PUT with only the fields the n8n API accepts (tags=read-only, pinData=rejected)
  const payload = {
    name:        workflow.name,
    nodes:       workflow.nodes,
    connections: workflow.connections,
    settings:    workflow.settings,
    staticData:  workflow.staticData,
  };

  const { status: putStatus, data: putResp } = await n8nReq(
    'PUT',
    `/api/v1/workflows/${wf.id}`,
    payload
  );

  if (putStatus >= 200 && putStatus < 300) {
    console.log(`  ✓ Updated! New versionId: ${putResp.versionId || '(none)'}`);
    return true;
  } else {
    console.error(`  ✗ PUT failed (HTTP ${putStatus}):`, JSON.stringify(putResp).slice(0, 400));
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('fix_persist_nodes.js — Replacing DO $$ blocks with CTE approach');
  console.log(`N8N: ${N8N_HOST}`);
  console.log(`Supabase: ${SUPA_URL}`);
  console.log(`Patching ${WORKFLOWS.length} workflows...\n`);

  const results = [];
  for (const wf of WORKFLOWS) {
    const ok = await patchWorkflow(wf);
    results.push({ name: wf.name, ok });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Summary:');
  results.forEach(r => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`));
  const allOk = results.every(r => r.ok);
  if (!allOk) {
    console.error('\nSome workflows could not be patched. Check output above.');
    process.exit(1);
  }
  console.log('\nAll workflows patched. Test with a sample company scan.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
