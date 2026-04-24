/**
 * fix_a2_peso_fuente.js
 *
 * Sprint A.2 — Radar v1.1
 * Agrega el nodo "Code: Clasificar Fuente" al WF02.
 * Este nodo evalúa cada resultado Tavily y asigna peso_fuente (1-5):
 *   5 = gobierno / licitación oficial
 *   4 = operador público / IR corporativo
 *   3 = gremio / asociación industrial
 *   2 = prensa especializada
 *   1 = prensa general / blog
 *
 * El nodo se inserta DESPUÉS del nodo HTTP que ejecuta Tavily y
 * ANTES del nodo de validación del agente radar.
 *
 * Uso: node fix_a2_peso_fuente.js [--dry-run]
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const N8N_HOST     = 'n8n.event2flow.com';
const API_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID      = 'fko0zXYYl5X4PtHz';
// Nodo DESPUÉS del cual insertar (el último HTTP Tavily en el flujo)
const INSERT_AFTER = 'Buscar en Tavily';   // Ajustar al nombre exacto en n8n si difiere
const DRY_RUN      = process.argv.includes('--dry-run');

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

// ── Código del nuevo nodo ────────────────────────────────────────────────────
const CLASIFICAR_FUENTE_CODE = `// ─── A.2: Clasificar Fuente — asignar peso_fuente por dominio ─────────────
// Recorre los resultados de Tavily e inyecta peso_fuente (1-5) en cada item.

const GOV_DOMAINS = new Set([
  // Colombia
  'secop.gov.co', 'colombiacompra.gov.co', 'ani.gov.co', 'aerocivil.gov.co', 'dnp.gov.co',
  // México
  'afac.gob.mx', 'compranet.hacienda.gob.mx', 'gob.mx',
  // Chile
  'mercadopublico.cl', 'dgac.gob.cl', 'mop.gob.cl', 'chilecompra.cl',
  // Brasil
  'anac.gov.br', 'gov.br', 'portaltransparencia.gov.br', 'comprasnet.gov.br',
  // Perú / Argentina
  'seace.gob.pe', 'ositran.gob.pe', 'proinversion.gob.pe', 'argentinacompra.gov.ar',
]);

const IR_DOMAINS = new Set([
  'asur.com.mx', 'aeropuertosgap.com.mx', 'oma.aero',
  'klabin.com.br', 'suzano.com.br', 'bndes.gov.br',
  'corfo.cl', 'cmpc.cl',
  'andi.com.co',
]);

const GREMIO_DOMAINS = new Set([
  'andi.com.co', 'canainpa.com.mx', 'economia.gob.mx',
  'smf.com.mx', 'fedecarton.com', 'fiab.net',
]);

const PRENSA_ESP = new Set([
  'aviacionline.com', 'aerolatinnews.com', 'aircargonews.net',
  'packagingnews.co.uk', 'revista-logistica.com',
  'intralogistica.es', 'mhl-news.com',
]);

function getPesoFuente(url = '', dominio = '') {
  const d = (dominio || url.replace(/https?:\\/\\//, '').split('/')[0]).toLowerCase();

  // Peso 5: gobierno oficial o licitación pública
  if (GOV_DOMAINS.has(d)) return 5;
  if (d.endsWith('.gov.co') || d.endsWith('.gob.mx') || d.endsWith('.gov.br') ||
      d.endsWith('.gob.cl') || d.endsWith('.gob.pe') || d.endsWith('.gov.ar')) return 5;

  // Peso 4: operador público / IR corporativo blue-chip
  if (IR_DOMAINS.has(d)) return 4;
  if (d.includes('/ri') || d.includes('/ir') || d.includes('investor')) return 4;

  // Peso 3: gremio / asociación industrial
  if (GREMIO_DOMAINS.has(d)) return 3;
  if (d.includes('asociacion') || d.includes('camara') || d.includes('federacion')) return 3;

  // Peso 2: prensa especializada
  if (PRENSA_ESP.has(d)) return 2;

  // Peso 1: prensa general / otros
  return 1;
}

const items = $input.all();

return items.map(item => {
  const results = item.json.results || item.json.data?.results || [];

  const enriched = results.map(r => ({
    ...r,
    peso_fuente: getPesoFuente(r.url, r.domain || ''),
  }));

  const peso_max = enriched.reduce((m, r) => Math.max(m, r.peso_fuente), 0);

  return {
    json: {
      ...item.json,
      results:         enriched,
      peso_fuente_max: peso_max,
      tiene_fuente_gov: peso_max >= 4,
    }
  };
});
`;

const NEW_NODE = {
  id:          'wf02-clasificar-fuente',
  name:        'Code: Clasificar Fuente',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],   // se ajusta dinámicamente
  parameters: {
    mode:   'runOnceForAllItems',
    jsCode: CLASIFICAR_FUENTE_CODE,
  },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix A.2 — Jerarquía de fuentes + peso_fuente                  ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  console.log('[1/5] Fetching WF02...');
  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET failed: ${wfRes.status} ${wfRes.body}`);
  const wf = JSON.parse(wfRes.body);

  const backupPath = path.join(__dirname, `backup_wf02_pre_a2_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('[2/5] Backup:', DRY_RUN ? '(skipped)' : backupPath);

  // Check if node already exists
  if (wf.nodes.find(n => n.name === NEW_NODE.name)) {
    console.log('✔  Nodo "Code: Clasificar Fuente" ya existe — actualizando código...');
    const existing = wf.nodes.find(n => n.name === NEW_NODE.name);
    existing.parameters.jsCode = CLASIFICAR_FUENTE_CODE;
  } else {
    // Find INSERT_AFTER node to position correctly
    const anchorNode = wf.nodes.find(n => n.name === INSERT_AFTER);
    if (!anchorNode) {
      console.log(`WARN: Nodo anchor "${INSERT_AFTER}" no encontrado. Nodos disponibles:`);
      wf.nodes.forEach(n => console.log('  -', n.name));
      console.log('Insertando nodo en posición default [500, 500]');
      NEW_NODE.position = [500, 500];
    } else {
      NEW_NODE.position = [
        anchorNode.position[0] + 250,
        anchorNode.position[1],
      ];
    }
    wf.nodes.push(NEW_NODE);
    console.log(`[3/5] Nodo "${NEW_NODE.name}" agregado en posición`, NEW_NODE.position);

    // Wire connection: INSERT_AFTER → Clasificar Fuente
    if (anchorNode) {
      if (!wf.connections[INSERT_AFTER]) wf.connections[INSERT_AFTER] = { main: [[]] };
      const existingTargets = wf.connections[INSERT_AFTER].main[0] || [];
      existingTargets.push({ node: NEW_NODE.name, type: 'main', index: 0 });
      wf.connections[INSERT_AFTER].main[0] = existingTargets;
      console.log(`      ✔ Conexión: "${INSERT_AFTER}" → "${NEW_NODE.name}"`);
    }
  }

  console.log('[4/5] Validando nodos...');
  console.log(`      Nodos totales: ${wf.nodes.length}`);
  console.log(`      "Code: Clasificar Fuente" presente: ${!!wf.nodes.find(n => n.name === NEW_NODE.name)}`);

  if (!DRY_RUN) {
    console.log('[5/5] Actualizando workflow...');
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('      ✔ Workflow actualizado');
  } else {
    console.log('[5/5] DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Fix A.2 completado');
  console.log('   peso_fuente inyectado en cada resultado Tavily (1-5)');
  console.log('   peso_fuente_max y tiene_fuente_gov disponibles para el agente radar');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
