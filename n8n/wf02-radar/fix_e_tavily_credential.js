/**
 * fix_e_tavily_credential.js
 *
 * Sprint A.5 / Bug E — Radar v1.1
 * Reemplaza el header Authorization hardcodeado de Tavily en todos los
 * nodos HTTP de WF02 por una referencia a la credencial n8n "Tavily API Key".
 *
 * IMPORTANTE: Antes de correr este script:
 *   1. Crear credencial en n8n → Settings → Credentials → New
 *      Tipo: HTTP Header Auth
 *      Name: Tavily API Key
 *      Parameter Name: Authorization
 *      Value: Bearer tvly-...  (la clave activa)
 *   2. Copiar el credentialId que asigna n8n (aparece en la URL al editar)
 *   3. Pasarlo como argumento: node fix_e_tavily_credential.js <credentialId>
 *
 * Uso: node fix_e_tavily_credential.js <credentialId> [--dry-run]
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF02_ID  = 'fko0zXYYl5X4PtHz';
// WF01 también tiene Tavily hardcodeada — ajustar si se desea incluir
const WF01_ID  = 'jDtdafuyYt8TXISl';
const DRY_RUN  = process.argv.includes('--dry-run');

// credentialId pasado como primer arg (no flag)
const CRED_ID  = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) || null;

const TAVILY_ENDPOINT = 'https://api.tavily.com';
// Patrones de nombre de nodo que llaman a Tavily
const TAVILY_NODE_NAMES = [
  'Buscar en Tavily',
  'HTTP Tavily',
  'Tavily Search',
  'Tavily: Búsqueda GOV',
  'Tavily: Búsqueda General',
  'HTTP: Tavily Search',
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

function isTavilyNode(node) {
  if (node.type !== 'n8n-nodes-base.httpRequest') return false;
  const url = node.parameters?.url || node.parameters?.options?.url || '';
  const isUrl = url.includes('tavily.com');
  const isName = TAVILY_NODE_NAMES.some(n => node.name.toLowerCase().includes(n.toLowerCase().split(':')[0].trim()));
  return isUrl || isName;
}

function removeHardcodedKey(node) {
  const headers = node.parameters?.options?.headers?.parameters || [];
  node.parameters.options = node.parameters.options || {};
  // Remove Authorization header
  node.parameters.options.headers = {
    parameters: headers.filter(h => h.name !== 'Authorization'),
  };
}

function addCredential(node, credId, credName = 'Tavily API Key') {
  node.credentials = node.credentials || {};
  node.credentials.httpHeaderAuth = {
    id:   credId,
    name: credName,
  };
}

async function processWorkflow(wfId, label) {
  const wfRes = await api('GET', `/api/v1/workflows/${wfId}`);
  if (wfRes.status !== 200) throw new Error(`GET ${label} failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);

  const tavilyNodes = wf.nodes.filter(isTavilyNode);
  console.log(`  ${label}: encontrados ${tavilyNodes.length} nodos Tavily`);

  if (tavilyNodes.length === 0) {
    console.log(`  WARN: Ningún nodo reconocido como Tavily. Nodos HTTP disponibles:`);
    wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
      .forEach(n => console.log(`    - "${n.name}" url=${n.parameters?.url || 'N/A'}`));
    return;
  }

  const backupPath = path.join(__dirname, `backup_${wfId}_pre_bugE_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));

  for (const node of tavilyNodes) {
    removeHardcodedKey(node);
    if (CRED_ID) {
      addCredential(node, CRED_ID, 'Tavily API Key');
      console.log(`  ✔ "${node.name}": header removido, credencial asignada`);
    } else {
      console.log(`  ✔ "${node.name}": header removido (sin credentialId — asignar manualmente en n8n)`);
    }
  }

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${wfId}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT ${label} failed: ${upRes.status} ${upRes.body}`);
    console.log(`  ✔ ${label} actualizado (backup: ${backupPath})`);
  } else {
    console.log(`  DRY RUN — ${label} sin cambios`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix E — Tavily API Key → credencial n8n (WF01 + WF02)         ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  if (!CRED_ID) {
    console.log('');
    console.log('⚠️  AVISO: No se pasó credentialId como argumento.');
    console.log('   Los headers hardcodeados serán removidos pero la credencial');
    console.log('   no será asignada automáticamente. Asignarla manualmente en n8n.');
    console.log('   Uso: node fix_e_tavily_credential.js <credentialId> [--dry-run]');
  } else {
    console.log(`Credential ID: ${CRED_ID}`);
  }
  console.log('');

  console.log('[WF02 — Radar]');
  await processWorkflow(WF02_ID, 'WF02');
  console.log('');
  console.log('[WF01 — Calificador]');
  await processWorkflow(WF01_ID, 'WF01');

  console.log('');
  console.log('✅ Bug E completado');
  console.log('');
  console.log('PRÓXIMOS PASOS:');
  console.log('  1. Ir a n8n → Settings → Credentials → "Tavily API Key"');
  console.log('  2. Verificar que Value = "Bearer tvly-dev-<nueva_key>"');
  console.log('  3. Rotar la key antigua en https://app.tavily.com/keys');
  console.log('  4. Probar WF02 con una empresa de prueba (ej. Grupo Bimbo / MX)');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
