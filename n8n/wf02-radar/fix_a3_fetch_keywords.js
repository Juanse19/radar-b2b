/**
 * fix_a3_fetch_keywords.js
 *
 * Sprint A.3 — Radar v1.1 (parte n8n)
 * Agrega el nodo "HTTP: Fetch Keywords Supabase" al inicio de WF02,
 * ANTES de "Code: Construir Query Tavily".
 *
 * Este nodo consulta matec_radar.palabras_clave_por_linea filtrando por
 * la sub-línea de la empresa actual y devuelve las keywords activas
 * que el nodo Tavily usa para enriquecer las queries.
 *
 * Supabase endpoint: /pg/query (directo SQL vía service role)
 * Credencial n8n requerida: "Supabase Service Role" (HTTP Header Auth)
 *   → Header: apikey = <SUPABASE_SERVICE_ROLE_KEY>
 *   → Header: Authorization = Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Uso: node fix_a3_fetch_keywords.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST     = 'n8n.event2flow.com';
const API_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF02_ID      = 'fko0zXYYl5X4PtHz';
const SUPABASE_URL = 'https://supabase.valparaiso.cafe';
// Nodo ANTES del cual insertar
const INSERT_BEFORE = 'Code: Construir Query Tavily';
const DRY_RUN       = process.argv.includes('--dry-run');

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

// ── Nodo 1: SQL para obtener sub_linea_id desde el nombre de línea ───────────
// Este Code node convierte linea_negocio text → sub_linea_id para la query Supabase
const RESOLVE_SUBLINEA_CODE = `// Resuelve sub_linea_id a partir de linea_negocio string
const item = $input.first().json;
const linea = (item.linea_negocio || item['LINEA DE NEGOCIO'] || '').toLowerCase();

// Mapa linea_negocio → codigo sub_linea (debe coincidir con seed)
const LINEA_CODIGO_MAP = {
  'bhs': 'aeropuertos', 'aeropuertos': 'aeropuertos',
  'cargo': 'cargo_uld',  'cargo uld': 'cargo_uld', 'cargo_uld': 'cargo_uld',
  'carton': 'carton_corrugado', 'cartón': 'carton_corrugado',
  'carton_papel': 'carton_corrugado', 'corrugado': 'carton_corrugado',
  'intralogistica': 'final_linea', 'intralogística': 'final_linea',
  'final de línea': 'final_linea', 'final_linea': 'final_linea',
  'final linea': 'final_linea',
  'motos': 'ensambladoras_motos', 'ensambladoras': 'ensambladoras_motos',
  'solumat': 'solumat', 'plásticos': 'solumat',
};

let subLineaCodigo = 'aeropuertos'; // default
for (const [k, v] of Object.entries(LINEA_CODIGO_MAP)) {
  if (linea.includes(k)) { subLineaCodigo = v; break; }
}

return [{ json: { ...item, _sub_linea_codigo: subLineaCodigo } }];
`;

// ── Nodo 2: HTTP Request a Supabase para obtener keywords ───────────────────
const HTTP_KEYWORDS_NODE = {
  id:          'wf02-fetch-keywords-supabase',
  name:        'HTTP: Fetch Keywords Supabase',
  type:        'n8n-nodes-base.httpRequest',
  typeVersion:  4.2,
  position:    [0, 0],
  parameters: {
    method:   'POST',
    url:      `${SUPABASE_URL}/pg/query`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Content-Type',  value: 'application/json' },
        // Las siguientes 2 se deben reemplazar con credencial "Supabase Service Role"
        // Por ahora se usan expressions que leen de variables de entorno del workflow
        { name: 'apikey',        value: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}' },
        { name: 'Authorization', value: '=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}' },
      ],
    },
    sendBody: true,
    contentType: 'json',
    body: {
      // Usar expression para construir la SQL query con el sub_linea_codigo resuelto
      query: `=SELECT pc.palabra, pc.tipo, pc.peso
FROM matec_radar.palabras_clave_por_linea pc
JOIN matec_radar.sub_lineas_negocio sl ON sl.id = pc.sub_linea_id
WHERE sl.codigo = '{{ $json._sub_linea_codigo }}'
  AND pc.activo = TRUE
  AND pc.peso >= 1
ORDER BY pc.peso DESC, pc.palabra
LIMIT 50`,
    },
    options: {
      response: { response: { neverError: true } },
    },
  },
};

// ── Nodo 3: Code para fusionar keywords al item original ────────────────────
const MERGE_KEYWORDS_NODE = {
  id:          'wf02-merge-keywords',
  name:        'Code: Merge Keywords DB',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: {
    mode:   'runOnceForEachItem',
    jsCode: `// Fusiona keywords de Supabase de vuelta al item original
// El nodo HTTP devuelve las rows en .body o directamente en el array
const item = $input.first().json;

// Supabase /pg/query devuelve { rows: [...] } o directamente el array
const keywordsRaw = item.rows || item.data?.rows || item || [];
const keywords = Array.isArray(keywordsRaw) ? keywordsRaw : [];

// Recuperar el item original del contexto del loop
// En n8n, el item anterior se accede desde $('Code: Resolve Sub-Línea').item.json
const originalItem = $('Code: Resolve Sub-Línea').item?.json || {};

return [{
  json: {
    ...originalItem,
    _keywords_db: keywords,
    _keywords_count: keywords.length,
  }
}];
`,
  },
};

// ── Nodo 4: Code resolve sub-línea ─────────────────────────────────────────
const RESOLVE_NODE = {
  id:          'wf02-resolve-sublinea',
  name:        'Code: Resolve Sub-Línea',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: {
    mode:   'runOnceForEachItem',
    jsCode: RESOLVE_SUBLINEA_CODE,
  },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix A.3 — HTTP: Fetch Keywords Supabase → WF02               ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf02_pre_a3_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // Buscar nodo anchor (target: insertar ANTES de Construir Query Tavily)
  const tavilyNode = wf.nodes.find(n => n.name === INSERT_BEFORE);
  if (!tavilyNode) {
    console.log(`WARN: Nodo "${INSERT_BEFORE}" no encontrado. Nodos disponibles:`);
    wf.nodes.forEach(n => console.log('  -', n.name));
  }

  const basePos = tavilyNode
    ? [tavilyNode.position[0] - 750, tavilyNode.position[1]]
    : [-2000, 1360];

  // Posicionar los nuevos nodos en cadena
  RESOLVE_NODE.position       = [basePos[0],        basePos[1]];
  HTTP_KEYWORDS_NODE.position  = [basePos[0] + 250,  basePos[1]];
  MERGE_KEYWORDS_NODE.position = [basePos[0] + 500,  basePos[1]];

  // Agregar nodos sólo si no existen
  const newNodes = [RESOLVE_NODE, HTTP_KEYWORDS_NODE, MERGE_KEYWORDS_NODE];
  for (const n of newNodes) {
    if (!wf.nodes.find(e => e.name === n.name)) {
      wf.nodes.push(n);
      console.log(`+ Nodo agregado: "${n.name}"`);
    } else {
      console.log(`~ Nodo ya existe (actualizado): "${n.name}"`);
      const ex = wf.nodes.find(e => e.name === n.name);
      ex.parameters = n.parameters;
    }
  }

  // Conexiones: Resolve → HTTP → Merge → Construir Query Tavily
  const addConn = (from, to) => {
    if (!wf.connections[from]) wf.connections[from] = { main: [[]] };
    if (!wf.connections[from].main) wf.connections[from].main = [[]];
    if (!wf.connections[from].main[0]) wf.connections[from].main[0] = [];
    // Evitar duplicados
    if (!wf.connections[from].main[0].find(c => c.node === to)) {
      wf.connections[from].main[0].push({ node: to, type: 'main', index: 0 });
    }
  };

  addConn(RESOLVE_NODE.name, HTTP_KEYWORDS_NODE.name);
  addConn(HTTP_KEYWORDS_NODE.name, MERGE_KEYWORDS_NODE.name);
  if (tavilyNode) addConn(MERGE_KEYWORDS_NODE.name, INSERT_BEFORE);

  // El nodo que antes apuntaba a Construir Query Tavily ahora apunta a Resolve
  // Buscar conexiones entrantes a INSERT_BEFORE y redirigir a RESOLVE_NODE
  for (const [srcName, types] of Object.entries(wf.connections)) {
    for (const outputs of Object.values(types)) {
      for (const branch of outputs) {
        for (const conn of branch) {
          if (conn.node === INSERT_BEFORE && srcName !== MERGE_KEYWORDS_NODE.name) {
            conn.node = RESOLVE_NODE.name;
            console.log(`  ↪ Redirección: "${srcName}" → "${RESOLVE_NODE.name}" (era → "${INSERT_BEFORE}")`);
          }
        }
      }
    }
  }

  console.log('');
  console.log('Cadena n8n resultante:');
  console.log(`  → Code: Resolve Sub-Línea`);
  console.log(`  → HTTP: Fetch Keywords Supabase (POST /pg/query)`);
  console.log(`  → Code: Merge Keywords DB`);
  console.log(`  → ${INSERT_BEFORE} (usa _keywords_db[])`);

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('');
    console.log('✔ Workflow actualizado en n8n');
  } else {
    console.log('');
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Fix A.3 completado');
  console.log('');
  console.log('⚠️  PENDIENTE (manual en n8n):');
  console.log('   1. En nodo "HTTP: Fetch Keywords Supabase": reemplazar headers');
  console.log('      hardcodeados por credencial "Supabase Service Role".');
  console.log('   2. Variables de entorno del workflow:');
  console.log(`      SUPABASE_SERVICE_ROLE_KEY = <service_role_key de ${SUPABASE_URL}>`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
