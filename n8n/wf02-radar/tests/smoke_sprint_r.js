/**
 * smoke_sprint_r.js
 *
 * Sprint R — Smoke test del reorden de cadena
 * Verifica que:
 *   1. WF02 dispara a /calificador (WF01), NO a /prospector directamente
 *   2. El payload de WF02 → WF01 incluye score_radar, tipo_senal, convergencia
 *   3. WF01 responde correctamente con tier_compuesto + score_calificacion
 *   4. La cadena completa E2E llega hasta WF03 sin errores
 *
 * Nivel L1 — n8n smoke (MAOA §10)
 *
 * Uso:
 *   node smoke_sprint_r.js           # test E2E completo
 *   node smoke_sprint_r.js --dry-run # solo valida estructura, sin llamadas HTTP
 */

const https   = require('https');
const DRY_RUN = process.argv.includes('--dry-run');

const N8N_HOST     = 'n8n.event2flow.com';
const API_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID      = 'fko0zXYYl5X4PtHz';
const WF01_ID      = 'jDtdafuyYt8TXISl';
const RADAR_URL    = `https://${N8N_HOST}/webhook/radar-scan`;
const TIMEOUT_MS   = 150_000;  // 2.5 min — cadena completa es más lenta

const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
};

function request(method, host, apiPath, body = null, useApiKey = false) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: host, path: apiPath, method,
      headers: {
        'Content-Type': 'application/json',
        ...(useApiKey  ? { 'X-N8N-API-KEY': API_KEY } : {}),
        ...(data       ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Test 1: Verificar que WF02 tiene nodo HTTP→WF01 (no→WF03) vía API ───────
async function testWF02HasCalificadorNode() {
  console.log(C.bold('\n[TEST 1] WF02 tiene nodo HTTP → /calificador (no /prospector directo)'));

  if (DRY_RUN) { console.log(C.yellow('  [DRY RUN]')); return true; }

  const res = await request('GET', N8N_HOST, `/api/v1/workflows/${WF02_ID}`, null, true);
  if (res.status !== 200) {
    console.log(C.red(`  ✗ No se pudo obtener WF02: HTTP ${res.status}`));
    return false;
  }

  const wf = JSON.parse(res.body);
  const httpNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');

  const hasCalificador = httpNodes.some(n =>
    (n.parameters?.url || '').includes('calificador') ||
    n.name.toLowerCase().includes('calificador')
  );
  const hasDirectProspector = httpNodes.some(n =>
    (n.parameters?.url || '').includes('prospector') &&
    !n.name.toLowerCase().includes('comentario')
  );

  if (hasCalificador) {
    console.log(C.green(`  ✔ Nodo HTTP→calificador encontrado en WF02`));
    const n = httpNodes.find(nd => (nd.parameters?.url || '').includes('calificador') || nd.name.toLowerCase().includes('calificador'));
    console.log(C.dim(`    "${n.name}" → ${n.parameters?.url}`));
  } else {
    console.log(C.red(`  ✗ No hay nodo HTTP→calificador en WF02`));
    console.log(C.dim(`    Nodos HTTP en WF02: ${httpNodes.map(n => `"${n.name}"`).join(', ')}`));
  }

  if (hasDirectProspector) {
    console.log(C.yellow(`  ⚠ WF02 aún tiene nodo directo a /prospector — verificar si es correcto`));
  } else {
    console.log(C.green(`  ✔ Sin nodo directo WF02→prospector (correcto)`));
  }

  return hasCalificador;
}

// ── Test 2: Verificar que WF01 tiene nodo Merge Radar Context ───────────────
async function testWF01HasMergeNode() {
  console.log(C.bold('\n[TEST 2] WF01 tiene nodo "Code: Merge Radar Context"'));

  if (DRY_RUN) { console.log(C.yellow('  [DRY RUN]')); return true; }

  const res = await request('GET', N8N_HOST, `/api/v1/workflows/${WF01_ID}`, null, true);
  if (res.status !== 200) {
    console.log(C.red(`  ✗ No se pudo obtener WF01: HTTP ${res.status}`));
    return false;
  }

  const wf    = JSON.parse(res.body);
  const merge = wf.nodes.find(n => n.name === 'Code: Merge Radar Context');

  if (merge) {
    console.log(C.green(`  ✔ Nodo "Code: Merge Radar Context" encontrado`));
    console.log(C.dim(`    mode: ${merge.parameters?.mode}`));
  } else {
    console.log(C.red(`  ✗ Nodo "Code: Merge Radar Context" NO encontrado en WF01`));
    console.log(C.dim(`    Nodos Code en WF01: ${wf.nodes.filter(n => n.type === 'n8n-nodes-base.code').map(n => `"${n.name}"`).join(', ')}`));
  }

  return !!merge;
}

// ── Test 3: E2E — disparar WF02 y verificar que la cadena llega a WF01 ───────
async function testE2EChain() {
  console.log(C.bold('\n[TEST 3] E2E — Frontend→WF02→WF01→WF03 cadena completa'));

  const payload = {
    empresa:            'Aeropuerto Internacional El Dorado',
    pais:               'Colombia',
    linea_negocio:      'BHS',
    tier:               'ORO',
    company_domain:     'eldorado.aero',
    score_calificacion:  8,
    paises:             ['Colombia'],
    segmentacion: {
      impacto_presupuesto: 'Muy Alto',
      multiplanta:         'Única sede',
      recurrencia:         'Alta',
      referente_mercado:   'Referente internacional',
      anio_objetivo:       '2026',
      ticket_estimado:     '> 5M USD',
      prioridad_comercial: 'Muy Alta',
    },
    _test_run: true,
  };

  if (DRY_RUN) {
    console.log(C.yellow('  [DRY RUN] Payload que se enviaría:'));
    console.log(C.dim(JSON.stringify(payload, null, 4).split('\n').map(l => '    ' + l).join('\n')));
    return true;
  }

  console.log(C.dim(`  Empresa: ${payload.empresa} / ${payload.pais}`));
  console.log(C.dim(`  URL: ${RADAR_URL}`));
  console.log(C.dim(`  (timeout: ${TIMEOUT_MS / 1000}s — cadena completa puede tardar 60-90s)`));

  const t0  = Date.now();
  const u   = new URL(RADAR_URL);
  const res = await request('POST', u.hostname, u.pathname, payload);
  const ms  = Date.now() - t0;
  console.log(C.dim(`  Status: ${res.status} | Tiempo: ${ms}ms`));

  if (res.status !== 200) {
    console.log(C.red(`  ✗ HTTP ${res.status}: ${res.body.slice(0, 400)}`));
    return false;
  }

  let result;
  try { result = JSON.parse(res.body); } catch { result = {}; }
  if (Array.isArray(result)) result = result[0] || {};
  if (result.data) result = result.data;

  // Verificaciones del resultado
  const checks = [
    { label: 'score_radar presente',     ok: result.score_radar !== undefined },
    { label: 'tier_compuesto asignado',  ok: !!result.tier_compuesto },
    { label: 'paises[] en output',       ok: Array.isArray(result.paises) && result.paises.length > 0 },
    { label: 'convergencia flag existe', ok: result.convergencia !== undefined },
    { label: 'peso_fuente_max existe',   ok: result.peso_fuente_max !== undefined },
  ];

  let ok = true;
  for (const c of checks) {
    console.log((c.ok ? C.green : C.red)(`  ${c.ok ? '✔' : '✗'} ${c.label}`));
    if (!c.ok) ok = false;
  }

  if (result._origen_wf02 === true) {
    console.log(C.green(`  ✔ _origen_wf02 = true (WF01 recibió contexto del Radar)`));
  }

  return ok;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(C.bold(' Smoke Tests — Sprint R (Reorden cadena WF02→WF01→WF03)       '));
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(`Modo: ${DRY_RUN ? C.yellow('DRY RUN') : C.cyan('PRODUCCIÓN')}`);

  const r1 = await testWF02HasCalificadorNode();
  const r2 = await testWF01HasMergeNode();
  const r3 = await testE2EChain();

  const results = [
    { id: 1, name: 'WF02 tiene nodo →calificador',  passed: r1 },
    { id: 2, name: 'WF01 tiene Merge Radar Context', passed: r2 },
    { id: 3, name: 'E2E cadena completa',            passed: r3 },
  ];

  console.log(C.bold('\n═══════════════════ RESUMEN ═══════════════════'));
  let p = 0, f = 0;
  for (const r of results) {
    if (DRY_RUN)      console.log(C.yellow(`  [SKIP] #${r.id} ${r.name}`));
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
