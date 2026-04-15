/**
 * fix_b1_convergencia.js
 *
 * Sprint B.1 — Radar v1.2
 * Agrega el nodo "Code: Calcular Convergencia" al WF02.
 *
 * Regla de convergencia (MAOA §5.4.B.1):
 *   convergencia = TRUE si:
 *     - Al menos 1 fuente con peso >= 4 (gov/IR oficial)
 *     - Y al menos 1 fuente adicional con peso >= 3 (gremio/asociación)
 *
 * El flag se persiste en radar_scans.convergencia y se agrega
 * al payload que va a WF01 (scoring) y WF03 (prospector).
 *
 * Uso: node fix_b1_convergencia.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST    = 'n8n.event2flow.com';
const API_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF02_ID     = 'fko0zXYYl5X4PtHz';
// Insertar después del nodo que calcula el composite score / Format Final Columns
const INSERT_AFTER = 'Code: Calcular Composite';
const DRY_RUN     = process.argv.includes('--dry-run');

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

const CONVERGENCIA_CODE = `// ─── B.1: Calcular Convergencia ──────────────────────────────────────────────
// Evalúa si la señal tiene convergencia multi-fuente:
//   convergencia = TRUE si hay >= 1 fuente peso >= 4 AND >= 1 fuente peso >= 3
//
// Input esperado: item con results[] donde cada result tiene peso_fuente (int 1-5)
// (inyectado por "Code: Clasificar Fuente" del Sprint A.2)

const items = $input.all();

return items.map(item => {
  const json    = item.json;
  const results = json.results || json.data?.results || [];

  // Agrupar pesos de fuentes
  const pesos = results.map(r => r.peso_fuente || 1);

  // Regla de convergencia
  const tieneAlta   = pesos.some(p => p >= 4);   // gov / IR oficial
  const tieneMedia  = pesos.some(p => p >= 3);   // gremio / asociación
  const convergencia = tieneAlta && tieneMedia;

  // Métricas adicionales para el agente y Supabase
  const fuentes_count   = results.length;
  const peso_fuente_max = pesos.length > 0 ? Math.max(...pesos) : 0;
  const peso_fuente_avg = pesos.length > 0
    ? Math.round((pesos.reduce((a, b) => a + b, 0) / pesos.length) * 10) / 10
    : 0;

  // Descripción de convergencia para el razonamiento del agente
  const convergencia_detalle = convergencia
    ? \`Convergencia confirmada: \${pesos.filter(p => p >= 4).length} fuente(s) oficial(es) + \${pesos.filter(p => p >= 3 && p < 4).length} fuente(s) gremial(es)\`
    : tieneAlta
    ? 'Solo fuentes oficiales — falta confirmación de gremio/prensa especializada'
    : tieneMedia
    ? 'Solo fuentes gremiales — falta fuente oficial o IR'
    : 'Sin fuentes de peso >= 3 — señal débil';

  return {
    json: {
      ...json,
      convergencia,
      convergencia_detalle,
      fuentes_count,
      peso_fuente_max,
      peso_fuente_avg,
      tiene_fuente_gov: tieneAlta,
    }
  };
});
`;

const NEW_NODE = {
  id:          'wf02-calcular-convergencia',
  name:        'Code: Calcular Convergencia',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: { mode: 'runOnceForAllItems', jsCode: CONVERGENCIA_CODE },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix B.1 — Calcular Convergencia multi-fuente                  ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf02_pre_b1_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // Agregar o actualizar nodo
  const existing = wf.nodes.find(n => n.name === NEW_NODE.name);
  if (existing) {
    existing.parameters.jsCode = CONVERGENCIA_CODE;
    console.log(`~ "${NEW_NODE.name}" actualizado`);
  } else {
    const anchor = wf.nodes.find(n => n.name === INSERT_AFTER);
    if (anchor) {
      NEW_NODE.position = [anchor.position[0] + 250, anchor.position[1]];
      // Redirigir conexiones salientes del anchor → NEW_NODE
      if (wf.connections[INSERT_AFTER]?.main?.[0]) {
        const oldTargets = wf.connections[INSERT_AFTER].main[0];
        wf.connections[NEW_NODE.name] = { main: [oldTargets.map(c => ({ ...c }))] };
        wf.connections[INSERT_AFTER].main[0] = [{ node: NEW_NODE.name, type: 'main', index: 0 }];
        console.log(`  ↪ ${INSERT_AFTER} → ${NEW_NODE.name} → [targets anteriores]`);
      }
    } else {
      console.log(`WARN: anchor "${INSERT_AFTER}" no encontrado. Nodos disponibles:`);
      wf.nodes.forEach(n => console.log('  -', n.name));
      NEW_NODE.position = [500, 1200];
    }
    wf.nodes.push(NEW_NODE);
    console.log(`+ Nodo "${NEW_NODE.name}" agregado`);
  }

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('✔ Workflow actualizado');
  } else {
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Fix B.1 completado');
  console.log('   convergencia, convergencia_detalle, peso_fuente_max, peso_fuente_avg');
  console.log('   disponibles en el payload hacia WF01 y Supabase.');
  console.log('');
  console.log('SIGUIENTE: fix_b3_hubspot_deal.js (requiere HubSpot Private App token)');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
