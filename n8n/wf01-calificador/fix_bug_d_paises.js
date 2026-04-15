/**
 * fix_bug_d_paises.js
 *
 * Bug D — WF01 Calificador
 * WF03 necesita paises[] para hacer búsqueda multi-país en Apollo.
 * WF01 no pasa este array en su HTTP Request a /radar-scan ni a /prospector.
 *
 * Fix: Actualiza el nodo que hace POST a /radar-scan (WF02) para incluir
 * paises[] construido desde el campo 'pais' y los datos de multinacionalidad
 * del segmentacion block.
 *
 * También actualiza el nodo HTTP hacia /prospector (WF03) para incluir paises[].
 *
 * Documentación de referencia: docs/PROMPT_Agent01_v2.md → Cambio 5
 *
 * Uso: node fix_bug_d_paises.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF01_ID  = 'jDtdafuyYt8TXISl';
const DRY_RUN  = process.argv.includes('--dry-run');

// Nombres posibles del nodo HTTP que llama a WF02 /radar-scan
const RADAR_NODE_CANDIDATES = [
  'HTTP Request',
  'HTTP: Trigger Radar WF02',
  'Trigger WF02 Radar',
  'HTTP: Radar Scan',
  'POST /radar-scan',
];
// Nombres posibles del nodo HTTP que llama a WF03 /prospector
const PROSP_NODE_CANDIDATES = [
  'HTTP: Trigger Prospector WF03',
  'Trigger WF03',
  'HTTP: Prospector',
  'POST /prospector',
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

// ── Código para el nodo Code que construye paises[] ─────────────────────────
// Se inserta ANTES del HTTP Request a WF02/WF03
const BUILD_PAISES_CODE = `// ─── Bug D fix: construir paises[] para WF02 y WF03 ─────────────────────────
// WF01 recibe 'pais' (string) y datos de multinacionalidad del segmentador.
// Construimos paises[] combinando pais principal + países adicionales detectados.

const item = $input.first().json;

// País principal
const paisPrincipal = item.pais || item.PAIS || 'Colombia';

// Países adicionales desde segmentación
const multiplanta = (item.segmentacion?.multiplanta || item['MULTIPLANTA'] || '').toLowerCase();
const esMult = multiplanta.includes('internacional') || multiplanta.includes('regional');

// Mapa de países frecuentes para empresas multinacionales LATAM
const PAISES_LATAM_CORE = ['Colombia', 'Mexico', 'Chile', 'Brasil'];

let paises;
if (esMult) {
  // Para multinacionales: incluir todos los países LATAM core
  // más el país principal si no está en la lista
  paises = [...new Set([paisPrincipal, ...PAISES_LATAM_CORE])];
} else {
  // Para empresa de único país: sólo el país principal
  paises = [paisPrincipal];
}

return [{
  json: {
    ...item,
    paises,
    es_multinacional: esMult,
  }
}];
`;

function findNode(nodes, candidates, urlFragment) {
  // 1. Buscar por nombre exacto
  for (const c of candidates) {
    const n = nodes.find(nd => nd.name === c);
    if (n) return n;
  }
  // 2. Buscar HTTP nodes que apunten a la URL correcta
  if (urlFragment) {
    return nodes.find(
      nd => nd.type === 'n8n-nodes-base.httpRequest' &&
            (nd.parameters?.url || '').includes(urlFragment)
    );
  }
  return null;
}

// Agrega/actualiza campo en el body del HTTP request node
function injectPaisesInBody(node, fieldName = 'paises') {
  // n8n HTTP Request body puede estar en parameters.body (object/string) o
  // parameters.bodyParameters.parameters (array de key-value)
  const params = node.parameters || {};

  if (params.bodyParametersJson) {
    // JSON body como string — parsear, inyectar, volver a stringify
    try {
      const body = JSON.parse(params.bodyParametersJson);
      body[fieldName] = `={{ $json.${fieldName} }}`;
      body.es_multinacional = '={{ $json.es_multinacional }}';
      node.parameters.bodyParametersJson = JSON.stringify(body, null, 2);
      return `bodyParametersJson`;
    } catch { /* seguir */ }
  }

  if (params.body && typeof params.body === 'object') {
    params.body[fieldName] = `={{ $json.${fieldName} }}`;
    params.body.es_multinacional = '={{ $json.es_multinacional }}';
    return 'body (object)';
  }

  if (params.bodyParameters?.parameters) {
    const arr = params.bodyParameters.parameters;
    const existing = arr.find(p => p.name === fieldName);
    if (existing) {
      existing.value = `={{ $json.${fieldName} }}`;
    } else {
      arr.push({ name: fieldName,           value: `={{ $json.${fieldName} }}` });
      arr.push({ name: 'es_multinacional',  value: '={{ $json.es_multinacional }}' });
    }
    return 'bodyParameters.parameters';
  }

  // Fallback: no se pudo inyectar automáticamente
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Bug D Fix — WF01: paises[] en HTTP hacia WF02 y WF03          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF01_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET WF01 failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf01_pre_bugD_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // ── 1. Agregar nodo "Code: Build Paises" ────────────────────────────────
  const buildPaisesNodeName = 'Code: Build Paises';
  let buildNode = wf.nodes.find(n => n.name === buildPaisesNodeName);
  if (buildNode) {
    buildNode.parameters.jsCode = BUILD_PAISES_CODE;
    console.log(`~ Nodo "${buildPaisesNodeName}" actualizado`);
  } else {
    buildNode = {
      id:          'wf01-build-paises',
      name:        buildPaisesNodeName,
      type:        'n8n-nodes-base.code',
      typeVersion:  2,
      position:    [-500, 1000],
      parameters: { mode: 'runOnceForEachItem', jsCode: BUILD_PAISES_CODE },
    };
    wf.nodes.push(buildNode);
    console.log(`+ Nodo "${buildPaisesNodeName}" agregado`);
  }

  // ── 2. Encontrar y parchear nodo HTTP → WF02 /radar-scan ────────────────
  const radarNode = findNode(wf.nodes, RADAR_NODE_CANDIDATES, 'radar-scan');
  if (radarNode) {
    const injected = injectPaisesInBody(radarNode, 'paises');
    if (injected) {
      console.log(`✔ "${radarNode.name}": paises[] inyectado en ${injected}`);
    } else {
      console.log(`WARN: "${radarNode.name}": no se pudo inyectar automáticamente.`);
      console.log('     Agregar manualmente en n8n: body.paises = {{ $json.paises }}');
    }
  } else {
    console.log('WARN: Nodo HTTP → WF02 no encontrado. Nodos HTTP disponibles:');
    wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
      .forEach(n => console.log(`  - "${n.name}" url=${n.parameters?.url || 'N/A'}`));
  }

  // ── 3. Encontrar y parchear nodo HTTP → WF03 /prospector ────────────────
  const prospNode = findNode(wf.nodes, PROSP_NODE_CANDIDATES, 'prospector');
  if (prospNode) {
    const injected = injectPaisesInBody(prospNode, 'paises');
    if (injected) {
      console.log(`✔ "${prospNode.name}": paises[] inyectado en ${injected}`);
    } else {
      console.log(`WARN: "${prospNode.name}": no se pudo inyectar automáticamente.`);
    }
  } else {
    console.log('WARN: Nodo HTTP → WF03 no encontrado.');
  }

  // ── 4. Conectar Build Paises antes del nodo radar (si encontrado) ────────
  if (radarNode) {
    // Buscar quién apunta actualmente a radarNode y redirigir a buildNode
    for (const [srcName, types] of Object.entries(wf.connections)) {
      for (const outputs of Object.values(types)) {
        for (const branch of outputs) {
          for (const conn of branch) {
            if (conn.node === radarNode.name && srcName !== buildPaisesNodeName) {
              conn.node = buildPaisesNodeName;
              console.log(`  ↪ Redirección: "${srcName}" → "${buildPaisesNodeName}" (era → "${radarNode.name}")`);
            }
          }
        }
      }
    }
    // Build Paises → radarNode
    if (!wf.connections[buildPaisesNodeName]) wf.connections[buildPaisesNodeName] = { main: [[]] };
    if (!wf.connections[buildPaisesNodeName].main[0]?.find(c => c.node === radarNode.name)) {
      (wf.connections[buildPaisesNodeName].main[0] = wf.connections[buildPaisesNodeName].main[0] || [])
        .push({ node: radarNode.name, type: 'main', index: 0 });
    }
  }

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF01_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT WF01 failed: ${upRes.status} ${upRes.body}`);
    console.log('');
    console.log('✔ WF01 actualizado en n8n');
  } else {
    console.log('');
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Bug D completado');
  console.log('   paises[] ahora se construye desde pais + multinacionalidad');
  console.log('   y se pasa a WF02 y WF03 en el payload HTTP.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
