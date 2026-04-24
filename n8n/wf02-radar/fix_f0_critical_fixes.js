/**
 * fix_f0_critical_fixes.js
 *
 * Sprint F0 — Correcciones críticas WF02 Radar (sesión 2026-04-15)
 *
 * Problemas que resuelve:
 *   E1: HTTP: Fetch Keywords Supabase tiene body VACÍO → no hay keywords
 *   E2: HTTP: Supabase Persist Radar usa localhost:8000 → falla desde n8n cloud
 *   E3: Embeddings OpenAI1 + Guardar en Pinecone sin continueOnFail → aborta ejecución
 *   E6: Filtro Menciones Empresa muy estricto → 0 ítems pasan
 *
 * Uso: node fix_f0_critical_fixes.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST  = 'n8n.event2flow.com';
const API_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID   = 'fko0zXYYl5X4PtHz';
const SUPABASE_URL = 'https://supabase.valparaiso.cafe';
const DRY_RUN   = process.argv.includes('--dry-run');

const PUT_ALLOWED = ['name', 'nodes', 'connections', 'settings'];
function stripForPut(wf) {
  const out = {};
  for (const k of PUT_ALLOWED) if (k in wf) out[k] = wf[k];
  return out;
}

function api(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: N8N_HOST, path: apiPath, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function err(msg)  { console.log(`  ✗ ${msg}`); }

// ─── E1: Fix HTTP: Fetch Keywords Supabase body ───────────────────────────────
// El nodo tiene bodyParameters vacíos. Necesita enviar una query SQL real.
function fixKeywordsBody(node) {
  log('\n[E1] Fix HTTP: Fetch Keywords Supabase — agregar query SQL al body');

  // SQL query para obtener keywords por sub-línea
  const sqlQuery = [
    'SELECT p.palabra, p.tipo, p.peso',
    'FROM matec_radar.palabras_clave_por_linea p',
    'JOIN matec_radar.sub_lineas_negocio sl ON p.sub_linea_id = sl.id',
    "WHERE sl.codigo = $1",
    'AND p.activo = true',
    'ORDER BY p.peso DESC, p.palabra ASC',
    'LIMIT 60'
  ].join(' ');

  // La expresión n8n para tomar la primera sub-línea del array del nodo anterior
  const subLineaExpr = "$json._sub_lineas?.[0] || 'aeropuertos'";

  // Cambiar de bodyParameters a specifyBody=json con expresión
  node.parameters = {
    ...node.parameters,
    // Remover el modo bodyParameters
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ ({ "query": "${sqlQuery}", "params": [${subLineaExpr}] }) }}`,
    // Limpiar bodyParameters vacío
    bodyParameters: undefined,
  };
  // Eliminar bodyParameters si quedó undefined
  delete node.parameters.bodyParameters;

  // Asegurar que headers incluyen Content-Type
  node.parameters.sendHeaders = true;
  node.parameters.headerParameters = {
    parameters: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'apikey', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzU2NzI2NzcsImV4cCI6MTkzMzM1MjY3N30.EcqvysQnH7ZrGAz2OJJnUQVYYS1qsRlEhnb9xjbqFuQ' },
    ]
  };

  ok('Body actualizado con query SQL + sub_linea_id desde Code: Resolve Sub-Línea');
  return true;
}

// ─── E2: Fix HTTP: Supabase Persist Radar — URL localhost → producción ─────────
function fixSupabaseUrl(node) {
  log('\n[E2] Fix HTTP: Supabase Persist Radar (WF02) — actualizar URL a producción');

  const currentUrl = node.parameters?.url || '';
  if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
    node.parameters.url = `${SUPABASE_URL}/pg/query`;
    node.parameters.options = {
      ...node.parameters.options,
      allowUnauthorizedCerts: false,
    };
    // Agregar apikey header
    const headers = node.parameters.headerParameters?.parameters || [];
    const hasApiKey = headers.some(h => h.name === 'apikey');
    if (!hasApiKey) {
      headers.push({
        name:  'apikey',
        value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzU2NzI2NzcsImV4cCI6MTkzMzM1MjY3N30.EcqvysQnH7ZrGAz2OJJnUQVYYS1qsRlEhnb9xjbqFuQ',
      });
      node.parameters.headerParameters = { parameters: headers };
      node.parameters.sendHeaders = true;
    }
    ok(`URL: ${currentUrl} → ${node.parameters.url}`);
    return true;
  } else {
    warn(`URL ya apunta a producción: ${currentUrl}`);
    return false;
  }
}

// ─── E3: continueOnFail en Embeddings OpenAI1 + Guardar en Pinecone ──────────
function fixContinueOnFail(node) {
  log(`\n[E3] Fix continueOnFail en "${node.name}"`);
  if (node.onError === 'continueErrorOutput' || node.continueOnFail === true) {
    warn(`  ya tiene continueOnFail/onError`);
    return false;
  }
  node.onError = 'continueRegularOutput';
  ok(`continueOnFail activado en "${node.name}"`);
  return true;
}

// ─── E6: Relajar Filtro Menciones Empresa ────────────────────────────────────
// Problemas actuales:
//   - No tiene aliases (DHL Express ≠ DHL en texto)
//   - Descarta todos los resultados GOV aunque sean relevantes
//   - Requiere que el snippet mencione exactamente el nombre de la empresa
function fixFiltroMenciones(node) {
  log('\n[E6] Fix Filtro Menciones Empresa — relajar criterios + agregar aliases');

  node.parameters.jsCode = `// === FILTRO MENCIONES EMPRESA v5 — MAOA Sprint F0 ===
// Mejoras v5:
//   - Aliases para empresas multinacionales comunes
//   - Resultados GOV (include_domains) pasan con criterio relajado
//   - Permite match por dominio de empresa
//   - Mínimo 1 resultado siempre pasa (no quedar con 0 menciones)

const item = $input.item.json;
const empresa  = item.empresa || '';
const organic  = item.organic || [];
const linea    = item.linea_negocio || '';
const fromGov  = item._from_gov === true; // flag del nodo Buscar Fuentes Primarias

// ── Aliases de empresas multinacionales ─────────────────────────────────────
const ALIASES = {
  'dhl':    ['dhl express', 'dhl supply chain', 'deutsche post dhl', 'dhl logistics', 'dhl global', 'dhl freight'],
  'fedex':  ['federal express', 'fedex express', 'fedex ground', 'fedex freight', 'tnt express'],
  'ups':    ['united parcel service', 'ups supply chain', 'ups logistics', 'ups freight'],
  'amazon': ['amazon logistics', 'amazon fulfillment', 'amazon distribution'],
  'maersk': ['maersk logistics', 'maersk supply chain', 'damco'],
  'dhl express': ['dhl'],
};

function normalizar(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

const empNorm = normalizar(empresa);

// Construir lista de términos a buscar (empresa + aliases)
const searchTerms = [empNorm];
const alias = ALIASES[empNorm] || [];
alias.forEach(a => searchTerms.push(normalizar(a)));
// Agregar primera palabra si la empresa tiene múltiples palabras (>4 chars)
const firstWord = empNorm.split(' ')[0];
if (firstWord && firstWord.length >= 4) searchTerms.push(firstWord);

function matchesEmpresa(text) {
  const norm = normalizar(text);
  return searchTerms.some(term => norm.includes(term));
}

// ── Clasificar resultados ────────────────────────────────────────────────────
const menciones = [];
const sinMencion = [];

for (const r of organic) {
  const fullText = (r.title || '') + ' ' + (r.snippet || '') + ' ' + (r.link || '');
  if (matchesEmpresa(fullText)) {
    menciones.push({ ...r, _match_type: 'direct' });
  } else if (fromGov) {
    // Para fuentes GOV: si la consulta fue específica de la empresa,
    // aceptar el resultado aunque no mencione el nombre (puede ser un concurso)
    sinMencion.push({ ...r, _match_type: 'gov_indirect' });
  } else {
    // No match — incluir igual si hay pocos resultados en total
    sinMencion.push({ ...r, _match_type: 'no_match' });
  }
}

// ── Decidir qué devolver ─────────────────────────────────────────────────────
let finalResults;

if (menciones.length >= 2) {
  // Suficientes menciones directas → solo esas
  finalResults = menciones;
} else if (menciones.length === 1) {
  // 1 mención directa → agregar hasta 3 resultados GOV indirectos
  const govIndirect = sinMencion.filter(r => r._match_type === 'gov_indirect').slice(0, 3);
  finalResults = [...menciones, ...govIndirect];
} else if (fromGov && sinMencion.length > 0) {
  // Sin menciones directas pero fuente GOV → pasar los primeros 5
  finalResults = sinMencion.slice(0, 5);
} else {
  // Sin nada → devolver todos los resultados originales (mínimo 1 siempre)
  // El AI RADAR1 decidirá si hay señal o no
  finalResults = organic.slice(0, 8).map(r => ({ ...r, _match_type: 'fallback' }));
}

return [{ json: {
  ...item,
  organic:    finalResults,
  _menciones: menciones.length,
  _total:     organic.length,
  _fallback:  menciones.length === 0,
} }];
`;

  ok('Filtro Menciones v5 — aliases + GOV pass-through + fallback mínimo');
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log(' Fix F0 — Correcciones críticas WF02 (Sprint MAOA 2026-04-15) ');
  log('═══════════════════════════════════════════════════════════════');
  log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);
  log('');

  // 1. Fetch WF02
  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET WF02 failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  log(`WF02 cargado: "${wf.name}" (${wf.nodes.length} nodos)`);

  // 2. Backup
  if (!DRY_RUN) {
    const backupPath = path.join(__dirname, `backup_${WF02_ID}_pre_f0_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
    log(`Backup: ${backupPath}`);
  }

  let changes = 0;

  // 3. Apply fixes node by node
  for (const node of wf.nodes) {
    switch (node.name) {
      case 'HTTP: Fetch Keywords Supabase':
        if (fixKeywordsBody(node)) changes++;
        break;

      case 'HTTP: Supabase Persist Radar (WF02)':
        if (fixSupabaseUrl(node)) changes++;
        break;

      case 'Embeddings OpenAI1':
      case 'Guardar en Memoria (Pinecone)1':
        if (fixContinueOnFail(node)) changes++;
        break;

      case 'Filtro Menciones Empresa':
        if (fixFiltroMenciones(node)) changes++;
        break;

      default:
        break;
    }
  }

  log(`\n${changes} nodos modificados`);

  // 4. PUT back
  if (!DRY_RUN && changes > 0) {
    log('\nAplicando cambios en n8n...');
    const payload = stripForPut(wf);
    const putRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, payload);
    if (putRes.status !== 200) {
      throw new Error(`PUT WF02 failed: ${putRes.status}\n${putRes.body}`);
    }
    ok('WF02 actualizado exitosamente en producción');
  } else if (DRY_RUN) {
    log('\nDRY RUN — sin cambios aplicados');
  }

  log('');
  log('✅ Fix F0 completado');
  log('');
  log('PRÓXIMOS PASOS:');
  log('  1. Ejecutar: node fix_f1_maoa_alignment.js');
  log('  2. Importar keywords Excel: node ../tools/import_keywords_excel.js');
  log('  3. Probar con DHL Express / Colombia / Intralogística');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
