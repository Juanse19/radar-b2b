/**
 * test_batch_real.js
 *
 * Prueba el flujo N8N con las top 10 empresas reales por prioridad.
 * Lee desde la API del frontend → dispara N8N → verifica resultados.
 *
 * Uso:
 *   node test_batch_real.js                     # BHS por defecto, 10 empresas
 *   node test_batch_real.js --linea Intralogística
 *   node test_batch_real.js --linea "Cartón" --batch 5
 *
 * Requisito: el frontend debe estar corriendo en localhost:3000
 */

const N8N_HOST    = 'https://n8n.event2flow.com';
const WORKFLOW_ID = 'cB6VI7ZPS4fFVi-dAk4RG';
const API_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const N8N_HEADERS = { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY };
const FRONTEND    = 'http://localhost:3000';

// Parsear args
const lineaArg = (() => {
  const i = process.argv.indexOf('--linea');
  return i !== -1 ? process.argv[i + 1] : 'BHS';
})();
const batchArg = (() => {
  const i = process.argv.indexOf('--batch');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 10;
})();

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n=== TEST BATCH REAL ===`);
  console.log(`Línea: ${lineaArg} | Batch: ${batchArg}`);

  // ── 1. Obtener empresas desde el frontend API ──────────────────────────────
  console.log(`\n[1/4] Obteniendo top ${batchArg} empresas de ${lineaArg} desde ${FRONTEND}...`);
  let empresas;
  try {
    const res = await fetch(`${FRONTEND}/api/companies?linea=${encodeURIComponent(lineaArg)}&limit=${batchArg}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    empresas = await res.json();
  } catch (e) {
    console.error(`  ERROR: No se pudo conectar al frontend. ¿Está corriendo npm run dev?`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(empresas) || empresas.length === 0) {
    console.error(`  No se encontraron empresas para la línea "${lineaArg}". Verifica que el import haya corrido.`);
    process.exit(1);
  }

  console.log(`  ${empresas.length} empresas obtenidas:`);
  empresas.slice(0, 5).forEach(e => console.log(`    - ${e.nombre} (${e.pais ?? '?'}) prioridad: ${e.prioridad ?? 0}`));
  if (empresas.length > 5) console.log(`    ... y ${empresas.length - 5} más`);

  // ── 2. Disparar webhook N8N ────────────────────────────────────────────────
  console.log(`\n[2/4] Disparando webhook N8N...`);
  const payload = {
    linea:           lineaArg,
    batch_size:      empresas.length,
    trigger_type:    'test',
    date_filter_from:'2025-07-01',
    empresas:        empresas.map(e => ({
      nombre:  e.nombre,
      dominio: e.dominio ?? '',
      pais:    e.pais    ?? 'LATAM',
      linea:   e.linea   ?? lineaArg,
    })),
  };

  const wRes = await fetch(`${N8N_HOST}/webhook/radar-b2b-scan`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  console.log(`  Webhook: HTTP ${wRes.status} → ${await wRes.text()}`);

  // ── 3. Esperar y obtener ejecución ─────────────────────────────────────────
  const waitSec = 90;
  console.log(`\n[3/4] Esperando ${waitSec}s para que complete la ejecución...`);
  await sleep(waitSec * 1000);

  const execRes  = await fetch(`${N8N_HOST}/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1`, { headers: N8N_HEADERS });
  const execData = await execRes.json();
  const latest   = execData?.data?.[0];
  if (!latest) { console.error('  No se encontró ejecución.'); return; }

  const dur = ((new Date(latest.stoppedAt).getTime() - new Date(latest.startedAt).getTime()) / 1000).toFixed(1);
  console.log(`  Ejecución: ${latest.id} | ${latest.status} | ${dur}s`);

  // ── 4. Verificar resultados ────────────────────────────────────────────────
  console.log(`\n[4/4] Verificando resultado...`);
  const detRes  = await fetch(`${N8N_HOST}/api/v1/executions/${latest.id}?includeData=true`, { headers: N8N_HEADERS });
  const detail  = await detRes.json();
  const rd      = detail?.data?.resultData?.runData || {};

  // Normalizar Linea
  const normItems = rd?.['Normalizar Linea']?.[0]?.data?.main?.[0] || [];
  console.log(`\nNormalizar Linea (${normItems.length} items):`);
  for (const item of normItems.slice(0, 5)) {
    const empresa = item?.json?.['COMPANY NAME'] || item?.json?.empresa || '?';
    const _linea  = item?.json?._linea || '?';
    const ok      = _linea !== 'undefined' && _linea !== '';
    console.log(`  ${ok ? '✅' : '❌'} ${empresa} → _linea: ${_linea}`);
  }

  // Code JS4 output
  const codeItems = rd?.['Code in JavaScript1']?.[0]?.data?.main?.[0] || [];
  const undefCount = codeItems.filter(i => !i?.json?.empresa || i?.json?.empresa === 'undefined').length;
  console.log(`\nCode JS4: ${codeItems.length} items | empresa=undefined: ${undefCount}`);
  if (undefCount > 0) console.log('  ❌ PROBLEMA: hay empresas undefined — revisar Code JS4');
  else                console.log('  ✅ Todas las empresas correctas');

  // if-bhs / if-carton routing
  const lineaNorm = lineaArg === 'BHS' ? 'bhs' : lineaArg.toLowerCase().includes('cart') ? 'carton' : 'intra';
  if (lineaNorm === 'bhs') {
    const t = rd?.['if-bhs']?.[0]?.data?.main?.[0]?.length ?? 0;
    const f = rd?.['if-bhs']?.[0]?.data?.main?.[1]?.length ?? 0;
    console.log(`\nif-bhs → true: ${t}, false: ${f}`);
    const append = rd?.['Append Resultados BHS']?.[0]?.data?.main?.[0]?.length ?? 0;
    console.log(`Append Resultados BHS: ${append} items ${append > 0 ? '✅' : '❌'}`);
  } else if (lineaNorm === 'carton') {
    const t = rd?.['if-carton']?.[0]?.data?.main?.[0]?.length ?? 0;
    const append = rd?.["Append Resultados Cartón"]?.[0]?.data?.main?.[0]?.length ?? 0;
    console.log(`\nif-carton → true: ${t} | Append Resultados Cartón: ${append} items ${append > 0 ? '✅' : '❌'}`);
  } else {
    const append = rd?.["Append Resultados Intralogística"]?.[0]?.data?.main?.[0]?.length ?? 0;
    console.log(`\nAppend Resultados Intralogística: ${append} items ${append > 0 ? '✅' : '❌'}`);
  }

  // Error global
  const err = detail?.data?.resultData?.error;
  if (err) {
    console.log(`\n❌ ERROR en "${err?.node?.name}": ${err?.message?.substring(0, 300)}`);
  } else {
    console.log(`\n✅ Ejecución sin errores.`);
  }
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
