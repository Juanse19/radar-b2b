/**
 * smoke_wf02_v1.1.js
 *
 * Sprint A.6 — Tests de humo para WF02 Radar v1.1
 * Ejecuta los 3 escenarios críticos del Radar contra el webhook real
 * y verifica que los campos clave estén presentes en el output.
 *
 * Nivel L1 — n8n smoke (ver MAOA §10)
 *
 * Pre-requisitos:
 *   - WF02 activo en n8n.event2flow.com con los fixes A.1–A.5 aplicados
 *   - Credencial Tavily operativa
 *   - Acceso Supabase con tabla palabras_clave_por_linea seedeada (migración 007)
 *
 * Uso:
 *   node smoke_wf02_v1.1.js             # corre todos los tests
 *   node smoke_wf02_v1.1.js --test 1    # solo test 1
 *   node smoke_wf02_v1.1.js --dry-run   # sin llamadas reales (valida estructura)
 */

const https   = require('https');
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY    = process.argv.includes('--test') ?
  Number(process.argv[process.argv.indexOf('--test') + 1]) : null;

const WEBHOOK_URL = 'https://n8n.event2flow.com/webhook/radar-scan';
const TIMEOUT_MS  = 120_000; // 2 min máximo por test

// ── Colores de consola ───────────────────────────────────────────────────────
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ── Fixtures de test ─────────────────────────────────────────────────────────
const TESTS = [
  {
    id:   1,
    name: 'ORO — fuente gov MX con CAPEX BHS',
    payload: {
      empresa:           'Aeropuertos y Servicios Auxiliares',
      pais:              'Mexico',
      linea_negocio:     'BHS',
      tier:              'ORO',
      company_domain:    'asur.com.mx',
      score_calificacion: 8.5,
      paises:            ['Mexico'],
      segmentacion: {
        impacto_presupuesto: 'Muy Alto',
        multiplanta:         'Presencia internacional',
        recurrencia:         'Alta',
        referente_mercado:   'Referente internacional',
        anio_objetivo:       '2026',
        ticket_estimado:     '> 5M USD',
        prioridad_comercial: 'Muy Alta',
      },
    },
    assertions: [
      { path: 'score_radar',        op: 'gte', value: 20,   label: 'score_radar >= 20' },
      { path: 'peso_fuente_max',    op: 'gte', value: 4,    label: 'peso_fuente_max >= 4 (fuente oficial/IR)' },
      { path: 'tier_compuesto',     op: 'in',  value: ['ORO','MONITOREO'], label: 'tier_compuesto es ORO o MONITOREO' },
      { path: 'paises',             op: 'array', label: 'paises[] presente' },
      { path: 'descartado_horizonte', op: 'eq', value: false, label: 'no descartado por horizonte' },
    ],
  },
  {
    id:   2,
    name: 'MONITOREO — empresa sin fuente oficial, score medio',
    payload: {
      empresa:           'Empaques del Valle S.A.',
      pais:              'Colombia',
      linea_negocio:     'Cartón y Papel',
      tier:              'MONITOREO',
      company_domain:    'empaquesvalle.com.co',
      score_calificacion: 5.5,
      paises:            ['Colombia'],
      segmentacion: {
        impacto_presupuesto: 'Medio',
        multiplanta:         'Única sede',
        recurrencia:         'Media',
        referente_mercado:   'Baja',
        anio_objetivo:       '2027',
        ticket_estimado:     '500K-1M USD',
        prioridad_comercial: 'Media',
      },
    },
    assertions: [
      { path: 'score_radar',    op: 'gte', value: 0,   label: 'score_radar existe (>= 0)' },
      { path: 'tier_compuesto', op: 'in',  value: ['ORO','MONITOREO','ARCHIVO'], label: 'tier_compuesto asignado' },
      { path: 'paises',         op: 'array', label: 'paises[] presente' },
    ],
  },
  {
    id:   3,
    name: 'Sin señal — empresa sin CAPEX detectado',
    payload: {
      empresa:           'Papelería Central Bogotá',
      pais:              'Colombia',
      linea_negocio:     'Intralogística',
      tier:              'MONITOREO',
      company_domain:    'papeleriacentral.co',
      score_calificacion: 4.0,
      paises:            ['Colombia'],
      segmentacion: {
        impacto_presupuesto: 'Muy Bajo',
        multiplanta:         'Única sede',
        recurrencia:         'Baja',
        referente_mercado:   'Baja',
        anio_objetivo:       '2028',
        ticket_estimado:     '< 500K USD',
        prioridad_comercial: 'Baja',
      },
    },
    assertions: [
      { path: 'score_radar',    op: 'gte', value: 0,   label: 'score_radar existe (puede ser bajo)' },
      { path: 'tier_compuesto', op: 'in',  value: ['ORO','MONITOREO','ARCHIVO'], label: 'tier_compuesto asignado' },
    ],
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────
function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u    = new URL(url);
    const req  = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function assert(result, assertion) {
  const val = getPath(result, assertion.path);
  switch (assertion.op) {
    case 'gte':   return val !== undefined && val >= assertion.value;
    case 'lte':   return val !== undefined && val <= assertion.value;
    case 'eq':    return val === assertion.value;
    case 'in':    return Array.isArray(assertion.value) && assertion.value.includes(val);
    case 'array': return Array.isArray(val) && val.length > 0;
    case 'truthy':return !!val;
    default:      return false;
  }
}

async function runTest(t) {
  console.log(C.bold(`\n[TEST ${t.id}] ${t.name}`));
  console.log(C.dim(`  Empresa: ${t.payload.empresa} / ${t.payload.pais} / ${t.payload.linea_negocio}`));

  if (DRY_RUN) {
    console.log(C.yellow('  [DRY RUN] Saltando llamada HTTP'));
    return { passed: true, skipped: true };
  }

  let result;
  try {
    const t0  = Date.now();
    const res = await post(WEBHOOK_URL, t.payload);
    const ms  = Date.now() - t0;
    console.log(C.dim(`  Status: ${res.status} | Tiempo: ${ms}ms`));

    if (res.status !== 200) {
      console.log(C.red(`  ✗ HTTP ${res.status}: ${res.body.slice(0, 300)}`));
      return { passed: false };
    }

    try { result = JSON.parse(res.body); }
    catch { result = { raw: res.body }; }

    // Normalizar: el webhook puede devolver array o objeto
    if (Array.isArray(result)) result = result[0] || {};
    if (result.data)           result = result.data;

  } catch (e) {
    console.log(C.red(`  ✗ Error: ${e.message}`));
    return { passed: false };
  }

  // Evaluar assertions
  let allPassed = true;
  for (const a of t.assertions) {
    const ok  = assert(result, a);
    const val = getPath(result, a.path);
    const str = val !== undefined ? ` (actual: ${JSON.stringify(val)})` : ' (campo ausente)';
    if (ok) {
      console.log(C.green(`  ✔ ${a.label}${str}`));
    } else {
      console.log(C.red(`  ✗ ${a.label}${str}`));
      allPassed = false;
    }
  }

  return { passed: allPassed, result };
}

async function main() {
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(C.bold(' Smoke Tests — WF02 Radar v1.1 (Sprint A)                     '));
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(`Webhook: ${WEBHOOK_URL}`);
  console.log(`Modo:    ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);
  console.log(`Tests:   ${ONLY ? `solo #${ONLY}` : `todos (${TESTS.length})`}`);

  const suite = ONLY ? TESTS.filter(t => t.id === ONLY) : TESTS;
  const results = [];

  for (const t of suite) {
    const r = await runTest(t);
    results.push({ id: t.id, name: t.name, ...r });
  }

  // Resumen
  console.log(C.bold('\n═══════════════════ RESUMEN ═══════════════════'));
  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log(C.yellow(`  [SKIP] #${r.id} ${r.name}`));
    } else if (r.passed) {
      console.log(C.green(`  [PASS] #${r.id} ${r.name}`));
      passed++;
    } else {
      console.log(C.red(`  [FAIL] #${r.id} ${r.name}`));
      failed++;
    }
  }
  console.log('');
  if (DRY_RUN) {
    console.log(C.yellow('DRY RUN — sin llamadas reales'));
  } else {
    console.log(`Resultado: ${C.green(`${passed} PASS`)} | ${failed ? C.red(`${failed} FAIL`) : '0 FAIL'}`);
    if (failed > 0) process.exit(1);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
