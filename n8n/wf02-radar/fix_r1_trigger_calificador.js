/**
 * fix_r1_trigger_calificador.js
 *
 * Sprint R — Reorden cadena A1→A2→A3
 * Modifica WF02 para que al final llame a /calificador (WF01)
 * en vez de /prospector (WF03) directamente.
 *
 * Flujo ANTES (incorrecto):
 *   WF01 → WF02 → WF03
 *
 * Flujo DESPUÉS (correcto per MAOA §3.2):
 *   Frontend → WF02 → WF01 → WF03
 *
 * Cambios en este script:
 *   1. Busca el nodo HTTP que actualmente llama a /prospector en WF02
 *   2. Lo reemplaza por un nuevo nodo HTTP → /calificador con payload enriquecido
 *   3. El nodo IF que filtra tier ARCHIVO sigue funcionando igual (solo ARCHIVO se corta)
 *
 * Nota: WF01 continuará llamando a WF03 al final — no se modifica esa parte.
 *
 * Uso: node fix_r1_trigger_calificador.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST        = 'n8n.event2flow.com';
const API_KEY         = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID         = 'fko0zXYYl5X4PtHz';
const CALIFICADOR_URL = 'https://n8n.event2flow.com/webhook/calificador';
const DRY_RUN         = process.argv.includes('--dry-run');

// Nombres candidatos del nodo HTTP que actualmente llama a /prospector en WF02
const PROSP_NODE_CANDIDATES = [
  'HTTP: Trigger Prospector WF03',
  'Trigger WF03',
  'HTTP: Prospector',
  'POST /prospector',
  'HTTP Request',   // fallback genérico
];

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

// ── Payload que WF02 envía a WF01 /calificador ───────────────────────────────
// WF01 recibe estos campos y los usa para TIR + composite scoring
const TRIGGER_CALIFICADOR_BODY = {
  empresa:            '={{ $json["COMPANY NAME"] || $json.empresa }}',
  pais:               '={{ $json.PAIS           || $json.pais }}',
  linea_negocio:      '={{ $json["LINEA DE NEGOCIO"] || $json.linea_negocio }}',
  company_domain:     '={{ $json.company_domain  || "" }}',
  paises:             '={{ $json.paises          || [$json.PAIS || $json.pais] }}',
  es_multinacional:   '={{ $json.es_multinacional || false }}',

  // Contexto del Radar para que WF01 calcule TIR con datos reales
  score_radar:        '={{ $json["SCORE RADAR"]  || $json.score_radar || 0 }}',
  composite_score:    '={{ $json.composite_score  || 0 }}',
  tier_radar:         '={{ $json.tier_compuesto   || "MONITOREO" }}',
  tipo_senal:         '={{ $json.tipo_senal        || "" }}',
  descripcion_senal:  '={{ $json.descripcion_senal || $json["DESCRIPCION SEÑAL"] || "" }}',
  monto_detectado:    '={{ $json.monto_detectado   || $json["MONTO DETECTADO"] || "" }}',
  horizonte_meses:    '={{ $json.horizonte_meses   || null }}',
  convergencia:       '={{ $json.convergencia      || false }}',
  convergencia_detalle: '={{ $json.convergencia_detalle || "" }}',
  peso_fuente_max:    '={{ $json.peso_fuente_max   || 0 }}',

  // Flag para que WF01 sepa que viene del Radar (no llamada directa del frontend)
  _origen:            'wf02_radar',
  _wf02_execution:    '={{ $execution.id }}',
};

// ── Nuevo nodo HTTP que reemplaza el trigger directo a WF03 ──────────────────
const TRIGGER_CALIFICADOR_NODE = {
  id:          'wf02-trigger-calificador',
  name:        'HTTP: Trigger Calificador WF01',
  type:        'n8n-nodes-base.httpRequest',
  typeVersion:  4.2,
  position:    [0, 0],
  parameters: {
    method:      'POST',
    url:         CALIFICADOR_URL,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'Content-Type', value: 'application/json' }],
    },
    sendBody:    true,
    contentType: 'json',
    body:        TRIGGER_CALIFICADOR_BODY,
    options: {
      response: { response: { neverError: true } },
      timeout: 30000,
    },
  },
};

function findProspectorNode(nodes) {
  for (const c of PROSP_NODE_CANDIDATES) {
    const n = nodes.find(nd => nd.name === c);
    if (n) return n;
  }
  // Buscar por URL
  return nodes.find(n =>
    n.type === 'n8n-nodes-base.httpRequest' &&
    (n.parameters?.url || '').includes('prospector')
  );
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Sprint R.1 — WF02: reemplazar trigger WF03 → trigger WF01     ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');
  console.log('Flujo objetivo:');
  console.log('  Frontend → /radar-scan (WF02) → /calificador (WF01) → /prospector (WF03)');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET WF02 failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf02_pre_sprintR1_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // ── 1. Encontrar nodo que actualmente llama a /prospector ───────────────
  const prospNode = findProspectorNode(wf.nodes);
  if (!prospNode) {
    console.log('WARN: No se encontró nodo HTTP → /prospector. Nodos HTTP disponibles:');
    wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
      .forEach(n => console.log(`  - "${n.name}"  url=${n.parameters?.url || 'N/A'}`));
    console.log('');
    console.log('ACCIÓN MANUAL REQUERIDA:');
    console.log('  En n8n, buscar el nodo HTTP que llama a /webhook/prospector');
    console.log(`  y cambiar su URL a: ${CALIFICADOR_URL}`);
    console.log('  Actualizar el body con los campos del payload de WF01 (ver script).');
  } else {
    console.log(`Nodo encontrado: "${prospNode.name}"`);
    console.log(`  URL actual: ${prospNode.parameters?.url || 'N/A'}`);
    console.log(`  URL nueva:  ${CALIFICADOR_URL}`);

    const oldName = prospNode.name;
    prospNode.name        = TRIGGER_CALIFICADOR_NODE.name;
    prospNode.parameters  = TRIGGER_CALIFICADOR_NODE.parameters;
    // Mantener posición original
    console.log(`  ✔ Nodo renombrado: "${oldName}" → "${prospNode.name}"`);
    console.log(`  ✔ URL → ${CALIFICADOR_URL}`);
    console.log(`  ✔ Body actualizado con contexto Radar (score_radar, convergencia, tipo_senal...)`);

    // Actualizar referencias en connections si el nombre cambió
    if (oldName !== prospNode.name) {
      for (const [src, types] of Object.entries(wf.connections)) {
        for (const outputs of Object.values(types)) {
          for (const branch of outputs) {
            for (const conn of branch) {
              if (conn.node === oldName) {
                conn.node = prospNode.name;
                console.log(`  ↪ Conexión actualizada: "${src}" → "${prospNode.name}"`);
              }
            }
          }
        }
      }
      // Mover connections del oldName al newName
      if (wf.connections[oldName]) {
        wf.connections[prospNode.name] = wf.connections[oldName];
        delete wf.connections[oldName];
      }
    }
  }

  console.log('');
  console.log('[Verificación] Nodos HTTP actuales en WF02:');
  wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
    .forEach(n => console.log(`  - "${n.name}"  →  ${n.parameters?.url || 'N/A'}`));

  if (!DRY_RUN) {
    console.log('');
    console.log('Actualizando WF02...');
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('✔ WF02 actualizado en n8n');
  } else {
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Sprint R.1 completado');
  console.log('');
  console.log('SIGUIENTE: fix_r2_wf01_accept_radar_context.js');
  console.log('  WF01 debe aceptar score_radar + tipo_senal del Radar');
  console.log('  y usarlos para calcular TIR (Sprint C).');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
