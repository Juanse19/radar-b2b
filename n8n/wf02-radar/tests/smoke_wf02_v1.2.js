/**
 * smoke_wf02_v1.2.js
 *
 * Sprint B.4 — Tests de humo para WF02 Radar v1.2
 * Verifica convergencia + flag HubSpot en el output del Radar.
 *
 * Nivel L1 — n8n smoke (MAOA §10)
 *
 * Uso: node smoke_wf02_v1.2.js [--dry-run]
 */

const https   = require('https');
const DRY_RUN = process.argv.includes('--dry-run');

const WEBHOOK_URL = 'https://n8n.event2flow.com/webhook/radar-scan';
const TIMEOUT_MS  = 120_000;

const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

const TESTS = [
  {
    id:   1,
    name: 'Convergencia TRUE — fuente gov + fuente gremio',
    payload: {
      empresa:           'Grupo Aeroportuario del Pacífico',
      pais:              'Mexico',
      linea_negocio:     'BHS',
      tier:              'ORO',
      company_domain:    'aeropuertosgap.com.mx',
      score_calificacion: 9,
      paises:            ['Mexico', 'Colombia'],
    },
    assertions: [
      { path: 'convergencia',      op: 'truthy', label: 'convergencia = true' },
      { path: 'fuentes_count',     op: 'gte', value: 1, label: 'fuentes_count >= 1' },
      { path: 'peso_fuente_max',   op: 'gte', value: 3, label: 'peso_fuente_max >= 3' },
      { path: 'convergencia_detalle', op: 'truthy', label: 'convergencia_detalle presente' },
    ],
  },
  {
    id:   2,
    name: 'Sin convergencia — solo prensa general (peso <= 2)',
    payload: {
      empresa:           'Pequeños Corrugados S.A.',
      pais:              'Colombia',
      linea_negocio:     'Cartón y Papel',
      tier:              'MONITOREO',
      company_domain:    'pequenoscorrugados.co',
      score_calificacion: 4,
      paises:            ['Colombia'],
    },
    assertions: [
      { path: 'convergencia',    op: 'eq', value: false, label: 'convergencia = false (esperado)' },
      { path: 'tiene_fuente_gov', op: 'eq', value: false, label: 'tiene_fuente_gov = false' },
    ],
  },
  {
    id:   3,
    name: 'IF HubSpot — score >= 8 Y convergencia → payload HubSpot ready',
    description: 'Verifica que el payload incluye campos necesarios para crear Deal en HubSpot',
    payload: {
      empresa:           'Aeropuertos Colombia S.A.',
      pais:              'Colombia',
      linea_negocio:     'BHS',
      tier:              'ORO',
      company_domain:    'aeropuertoscolombia.com.co',
      score_calificacion: 9,
      paises:            ['Colombia', 'Ecuador'],
    },
    assertions: [
      { path: 'empresa',           op: 'truthy', label: 'empresa presente en output' },
      { path: 'linea_negocio',     op: 'truthy', label: 'linea_negocio presente' },
      { path: 'score_radar',       op: 'gte', value: 0, label: 'score_radar presente' },
      { path: 'tier_compuesto',    op: 'truthy', label: 'tier_compuesto presente' },
      { path: 'paises',            op: 'array',  label: 'paises[] array no vacío' },
    ],
  },
];

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u    = new URL(url);
    const req  = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data); req.end();
  });
}

function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function assert(result, a) {
  const val = getPath(result, a.path);
  switch (a.op) {
    case 'gte':    return val !== undefined && val >= a.value;
    case 'eq':     return val === a.value;
    case 'truthy': return !!val;
    case 'array':  return Array.isArray(val) && val.length > 0;
    default:       return false;
  }
}

async function runTest(t) {
  console.log(C.bold(`\n[TEST ${t.id}] ${t.name}`));
  if (t.description) console.log(C.dim(`  ${t.description}`));

  if (DRY_RUN) { console.log(C.yellow('  [DRY RUN] Saltando')); return { passed: true, skipped: true }; }

  let result;
  try {
    const t0  = Date.now();
    const res = await post(WEBHOOK_URL, t.payload);
    console.log(C.dim(`  Status: ${res.status} | Tiempo: ${Date.now() - t0}ms`));
    if (res.status !== 200) {
      console.log(C.red(`  ✗ HTTP ${res.status}: ${res.body.slice(0, 300)}`));
      return { passed: false };
    }
    try { result = JSON.parse(res.body); } catch { result = {}; }
    if (Array.isArray(result)) result = result[0] || {};
    if (result.data)           result = result.data;
  } catch (e) {
    console.log(C.red(`  ✗ ${e.message}`)); return { passed: false };
  }

  let ok = true;
  for (const a of t.assertions) {
    const passed = assert(result, a);
    const val    = getPath(result, a.path);
    const str    = val !== undefined ? ` (${JSON.stringify(val)})` : ' (ausente)';
    console.log((passed ? C.green : C.red)(`  ${passed ? '✔' : '✗'} ${a.label}${str}`));
    if (!passed) ok = false;
  }
  return { passed: ok };
}

async function main() {
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(C.bold(' Smoke Tests — WF02 Radar v1.2 (Sprint B — Convergencia)       '));
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);

  const results = [];
  for (const t of TESTS) results.push({ id: t.id, name: t.name, ...(await runTest(t)) });

  console.log(C.bold('\n═══════════════════ RESUMEN ═══════════════════'));
  let p = 0, f = 0;
  for (const r of results) {
    if (r.skipped)     console.log(C.yellow(`  [SKIP] #${r.id} ${r.name}`));
    else if (r.passed) { console.log(C.green(`  [PASS] #${r.id} ${r.name}`)); p++; }
    else               { console.log(C.red(`  [FAIL] #${r.id} ${r.name}`)); f++; }
  }
  console.log('');
  if (!DRY_RUN) {
    console.log(`Resultado: ${C.green(`${p} PASS`)} | ${f ? C.red(`${f} FAIL`) : '0 FAIL'}`);
    if (f > 0) process.exit(1);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
