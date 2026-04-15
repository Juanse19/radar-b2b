/**
 * fix_a1_fuentes_institucionales.js
 *
 * Sprint A.1 — Radar v1.1
 * Actualiza el nodo "Code: Construir Query Tavily" en WF02 para generar:
 *   1. Query GOV  → usa include_domains[] con fuentes gubernamentales por país
 *   2. Query GEN  → query general con keywords por línea
 *
 * Resultado: cada empresa dispara 2 búsquedas Tavily (gov + general),
 * maximizando hits en pliegos, boletines y reportes IR.
 *
 * Uso: node fix_a1_fuentes_institucionales.js [--dry-run]
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const N8N_HOST   = 'n8n.event2flow.com';
const API_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID    = 'fko0zXYYl5X4PtHz';
const NODE_NAME  = 'Code: Construir Query Tavily';
const DRY_RUN    = process.argv.includes('--dry-run');

// ── API helper ───────────────────────────────────────────────────────────────
function api(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: N8N_HOST,
      path:     apiPath,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () =>
        resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── New node code ────────────────────────────────────────────────────────────
// Este código reemplaza el contenido del nodo "Code: Construir Query Tavily"
const NEW_JS_CODE = `// ─── A.1: Construir Query Tavily con fuentes gov + keywords por línea ─────────
// Genera DOS queries por empresa:
//   - query_gov  → include_domains con organismos oficiales por país
//   - query_gen  → keywords por línea (CAPEX, licitación, etc.)
// WF02 ejecutará ambas búsquedas en paralelo.

const item = $input.first().json;

const empresa      = item.empresa      || item['COMPANY NAME'] || '';
const pais_raw     = (item.pais        || item.PAIS            || 'CO').trim();
const linea_raw    = (item.linea_negocio || item['LINEA DE NEGOCIO'] || '').toLowerCase();
const keywords_db  = item._keywords_db || [];   // inyectadas por nodo Fetch Keywords Supabase

// ── 1. Normalizar país ────────────────────────────────────────────────────────
const PAIS_MAP = {
  colombia: 'CO', co: 'CO', col: 'CO',
  mexico: 'MX',   méxico: 'MX', mx: 'MX',
  chile: 'CL',    cl: 'CL',
  brasil: 'BR',   brazil: 'BR', br: 'BR',
  peru: 'PE',     perú: 'PE',   pe: 'PE',
  argentina: 'AR', ar: 'AR',
};
const pais = PAIS_MAP[pais_raw.toLowerCase()] || pais_raw.toUpperCase().slice(0, 2);

// ── 2. Dominios institucionales por país ─────────────────────────────────────
const DOMINIOS_GOV = {
  CO: ['secop.gov.co', 'colombiacompra.gov.co', 'ani.gov.co', 'aerocivil.gov.co',
       'andi.com.co', 'dnp.gov.co'],
  MX: ['afac.gob.mx', 'compranet.hacienda.gob.mx', 'asur.com.mx',
       'aeropuertosgap.com.mx', 'oma.aero', 'canainpa.com.mx', 'economia.gob.mx'],
  CL: ['mercadopublico.cl', 'dgac.gob.cl', 'mop.gob.cl', 'corfo.cl', 'chilecompra.cl'],
  BR: ['anac.gov.br', 'bndes.gov.br', 'klabin.com.br', 'suzano.com.br',
       'gov.br', 'portaltransparencia.gov.br'],
  PE: ['seace.gob.pe', 'ositran.gob.pe', 'proinversion.gob.pe'],
  AR: ['argentinacompra.gov.ar', 'aeropuertos-argentina.gob.ar'],
};
const dominios = DOMINIOS_GOV[pais] || DOMINIOS_GOV['CO'];

// ── 3. Keywords base por línea ────────────────────────────────────────────────
const KEYWORDS_BASE = {
  bhs:          'ampliacion terminal aeropuerto CAPEX concesion BHS sorter licitacion inversion',
  aeropuertos:  'ampliacion terminal aeropuerto CAPEX concesion BHS sorter licitacion inversion',
  cargo:        'carga aerea CAPEX expansion ULD operacion aeroportuaria inversion licitacion',
  cargo_uld:    'carga aerea CAPEX expansion ULD operacion aeroportuaria inversion licitacion',
  carton:       'planta carton corrugado CAPEX expansion capacidad produccion inversion nueva',
  carton_papel: 'planta carton corrugado CAPEX expansion capacidad produccion inversion nueva',
  intralogistica: 'CEDI WMS automatizacion bodega CAPEX conveyor picking robotica inversion',
  final_linea:  'planta embalaje packaging paletizado CAPEX expansion linea produccion',
  motos:        'ensambladora motocicletas CAPEX planta nueva linea ensamble inversion expansion',
  ensambladoras_motos: 'ensambladora motocicletas CAPEX planta nueva linea ensamble inversion',
  solumat:      'planta plasticos inyeccion CAPEX expansion materiales industriales inversion',
};

// Detectar clave de línea
let lineaKey = 'bhs';
for (const k of Object.keys(KEYWORDS_BASE)) {
  if (linea_raw.includes(k) || k.includes(linea_raw.split(' ')[0])) {
    lineaKey = k; break;
  }
}

let kw = KEYWORDS_BASE[lineaKey] || 'CAPEX inversion expansion planta nueva licitacion 2026 2027';

// Agregar keywords de Supabase (peso >= 1, tipo senal/capex/licitacion)
if (keywords_db.length > 0) {
  const extra = keywords_db
    .filter(k => k.activo && k.peso >= 1)
    .map(k => k.palabra)
    .join(' ');
  kw = kw + ' ' + extra;
}

// ── 4. Construir queries ──────────────────────────────────────────────────────
const query_gov = '"' + empresa + '" ' + pais + ' ' + kw.split(' ').slice(0, 4).join(' ');
const query_gen = '"' + empresa + '" ' + pais + ' ' + kw;

return [{
  json: {
    ...item,
    query_gov,
    query_gen,
    include_domains: dominios,
    linea_key:       lineaKey,
    pais_iso:        pais,
    keywords_used:   kw,
  }
}];
`;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix A.1 — Fuentes institucionales LATAM + include_domains     ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN (sin cambios)' : 'PRODUCCIÓN');
  console.log('');

  // 1. Fetch workflow
  console.log('[1/4] Fetching WF02...');
  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET workflow failed: ${wfRes.status} ${wfRes.body}`);
  const wf = JSON.parse(wfRes.body);

  // 2. Backup
  const backupPath = path.join(__dirname, `backup_wf02_pre_a1_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('[2/4] Backup:', DRY_RUN ? '(skipped — dry run)' : backupPath);

  // 3. Find and update node
  const node = wf.nodes.find(n => n.name === NODE_NAME);
  if (!node) {
    const names = wf.nodes.map(n => n.name);
    throw new Error(`Nodo "${NODE_NAME}" no encontrado. Nodos disponibles:\n${names.join('\n')}`);
  }
  console.log(`[3/4] Nodo encontrado: "${node.name}" (type: ${node.type})`);

  node.parameters = {
    ...node.parameters,
    mode:   'runOnceForEachItem',
    jsCode: NEW_JS_CODE,
  };

  console.log('      ✔ jsCode reemplazado con dual-query (gov + general)');
  console.log('      ✔ include_domains[] configurado para CO/MX/CL/BR/PE/AR');

  // 4. Push update
  if (!DRY_RUN) {
    console.log('[4/4] Actualizando workflow en n8n...');
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT workflow failed: ${upRes.status} ${upRes.body}`);
    console.log('      ✔ Workflow actualizado exitosamente');
  } else {
    console.log('[4/4] DRY RUN: no se actualizó el workflow');
  }

  console.log('');
  console.log('✅ Fix A.1 completado');
  console.log('');
  console.log('⚠️  SIGUIENTE PASO requerido:');
  console.log('   Los nodos HTTP Tavily deben ser duplicados para ejecutar');
  console.log('   AMBAS queries (gov + gen). Ver fix_a2_peso_fuente.js');
  console.log('   que también agrega el nodo "Code: Clasificar Fuente".');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
