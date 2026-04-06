/**
 * create_workflow02_radar.js
 *
 * Crea el Workflow 02 - "Agent 02 - Radar de Inversión v1.0" en N8N.
 *
 * Toma el workflow monolítico actual (75 nodos), elimina los 15 nodos
 * que se movieron al WF01 o son obsoletos, y ajusta las conexiones.
 *
 * Nodos eliminados:
 *   - Schedule Trigger1, Get rows from sheet, Code in JS4, Code in JS1
 *   - Read BASE_DE_DATOS (x3), Read Existing1, Formatear Contexto1
 *   - Buscar Perfil Empresa, AI Agent Segmentación, Set: Merge Segmentación, OpenAI Segm.
 *   - if-bhs, if-carton, Append or update a sheet (generic)
 *
 * Nodos añadidos:
 *   - Code: Parse WF01 Input (convierte webhook WF01 → items para el loop)
 *
 * Conexiones corregidas:
 *   - Webhook Radar B2B → Code: Parse WF01 Input → Loop Over Items1
 *   - Format Final Columns1 → Normalizar Linea (directo, sin segmentación)
 *   - Se elimina: Format Final Columns1 → Buscar Perfil Empresa
 *
 * Uso: node create_workflow02_radar.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────
const N8N_HOST    = 'n8n.event2flow.com';
const API_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const BACKUP_FILE = path.join(__dirname, 'workflow_backup_pre_restructure.json');
const DRY_RUN     = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────
// NODES TO REMOVE FROM THE MONOLITH
// ────────────────────────────────────────────────────────
const NODES_TO_REMOVE = new Set([
  'Schedule Trigger1',
  'Read Existing1',
  'Formatear Contexto1',
  'Code in JavaScript4',
  'Read BASE_DE_DATOS Clientes1',
  'Read BASE_DE_DATOS Clientes',
  'Code in JavaScript1',
  'Read BASE_DE_DATOS Clientes2',
  'Append or update a sheet',       // generic/unused
  'if-bhs',                          // legacy (Switch handles routing)
  'if-carton',                       // legacy
  'Buscar Perfil Empresa',           // moved to WF01
  'AI Agent Segmentación Cualitativa', // moved to WF01
  'Set: Merge Segmentación',         // moved to WF01
  'OpenAI Chat Model Segm.',         // moved to WF01
]);

// ────────────────────────────────────────────────────────
// API HELPER
// ────────────────────────────────────────────────────────
function api(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: N8N_HOST,
      path: apiPath,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => {
        resolve({ status: r.statusCode, body: d });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Agent 02 - Radar de Inversión v1.0 — Creación N8N');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);
  console.log('');

  // 1. Load backup
  const original = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  console.log(`Original: "${original.name}" (${original.nodes.length} nodos)`);

  // 2. Filter nodes — remove the ones moved to WF01 or obsolete
  const keptNodes = original.nodes.filter(n => !NODES_TO_REMOVE.has(n.name));
  const removedNodes = original.nodes.filter(n => NODES_TO_REMOVE.has(n.name));
  console.log(`Nodos eliminados: ${removedNodes.length}`);
  removedNodes.forEach(n => console.log(`  - ${n.name}`));
  console.log('');

  // 3. Add new node: Code: Parse WF01 Input
  //    Parses webhook payload from WF01 (single company) or legacy batch
  const parseNode = {
    id: 'wf02-parse-input',
    name: 'Code: Parse WF01 Input',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-2480, 1360],  // just before Loop Over Items1
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `// Parse input from WF01 (Calificador) webhook or legacy webhook
// WF01 sends: { empresa, pais, linea_negocio, tier, company_domain, score_calificacion, segmentacion: {...} }
// Legacy sends: { empresas: [...] } or CSV-like structure

const items = $input.all();
const body = items[0]?.json || {};

let empresas = [];

// Format A: single company from WF01 (has 'empresa' and 'score_calificacion')
if (body.empresa && body.score_calificacion !== undefined) {
  empresas = [{
    empresa:           body.empresa,
    pais:              body.pais || 'Colombia',
    linea_negocio:     body.linea_negocio || '',
    tier:              body.tier || 'MONITOREO',
    company_domain:    body.company_domain || '',
    score_calificacion: body.score_calificacion,
    // Pass through segmentation from WF01 (pre-calculated)
    'IMPACTO EN EL PRESUPUESTO': body.segmentacion?.impacto_presupuesto || '',
    'MULTIPLANTA':               body.segmentacion?.multiplanta          || '',
    'RECURRENCIA':               body.segmentacion?.recurrencia          || '',
    'REFERENTE DEL MERCADO':     body.segmentacion?.referente_mercado    || '',
    'ANIO OBJETIVO':             body.segmentacion?.anio_objetivo        || '',
    'TICKET ESTIMADO':           body.segmentacion?.ticket_estimado      || 'Sin ticket',
    'PRIORIDAD COMERCIAL':       body.segmentacion?.prioridad_comercial  || '',
  }];
}
// Format B: array of companies (batch or legacy)
else if (body.empresas && Array.isArray(body.empresas)) {
  empresas = body.empresas.map(e => ({
    empresa:        e.empresa || e.company_name || '',
    pais:           e.pais    || e.country      || 'Colombia',
    linea_negocio:  e.linea_negocio || '',
    tier:           e.tier    || 'Tier B',
    company_domain: e.company_domain || '',
    score_calificacion: e.score_calificacion || null,
    'PRIORIDAD COMERCIAL': e.prioridad_comercial || '',
  }));
}
// Format C: legacy body (has 'empresa' as single but no score - direct webhook)
else if (body.empresa) {
  empresas = [{
    empresa:        body.empresa,
    pais:           body.pais || 'Colombia',
    linea_negocio:  body.linea_negocio || '',
    tier:           body.tier || 'Tier B',
    company_domain: body.company_domain || '',
  }];
}

if (!empresas.length) {
  throw new Error('No companies found in webhook body. Expected {empresa,...} or {empresas:[...]}');
}

return empresas.map(e => ({ json: e }));`
    }
  };

  // 4. Adapt Webhook Radar B2B — update path to 'radar-scan' for WF01 calls
  const webhookNode = keptNodes.find(n => n.name === 'Webhook Radar B2B');
  if (webhookNode) {
    // Keep original webhook ID but update path if needed
    // The webhook node already exists; we just update path to radar-scan
    webhookNode.parameters = {
      ...webhookNode.parameters,
      path: 'radar-scan',
      responseMode: 'onReceived',
      responseData: 'firstEntryJson'
    };
    console.log('Webhook Radar B2B → path updated to "radar-scan"');
  }

  // 5. Rebuild connections
  //    Start from original connections, remove any that touch deleted nodes,
  //    then add new connections.
  const originalConns = original.connections || {};
  const newConns = {};

  for (const [srcName, types] of Object.entries(originalConns)) {
    // Skip connections FROM removed nodes
    if (NODES_TO_REMOVE.has(srcName)) continue;

    const filteredTypes = {};
    for (const [ctype, outputs] of Object.entries(types)) {
      const filteredOutputs = outputs.map(outputArr =>
        (outputArr || []).filter(t => !NODES_TO_REMOVE.has(t.node))
      );
      // Only keep if there are remaining connections
      if (filteredOutputs.some(arr => arr.length > 0)) {
        filteredTypes[ctype] = filteredOutputs;
      }
    }
    if (Object.keys(filteredTypes).length > 0) {
      newConns[srcName] = filteredTypes;
    }
  }

  // 6. Add new connections:

  // a. Webhook Radar B2B → Code: Parse WF01 Input
  newConns['Webhook Radar B2B'] = {
    main: [[{ node: 'Code: Parse WF01 Input', type: 'main', index: 0 }]]
  };

  // b. Code: Parse WF01 Input → Loop Over Items1
  newConns['Code: Parse WF01 Input'] = {
    main: [[{ node: 'Loop Over Items1', type: 'main', index: 0 }]]
  };

  // c. Format Final Columns1 → Normalizar Linea (replaces the old segmentation chain)
  //    The original had: Format Final Columns1 → Buscar Perfil Empresa (removed)
  //    We need: Format Final Columns1 → Normalizar Linea (directly)
  //    But Format Final Columns1 also → Formatear para Vector1 (keep)
  //    So Format Final Columns1 should have TWO outputs:
  if (!newConns['Format Final Columns1']) {
    newConns['Format Final Columns1'] = { main: [[]] };
  }
  // Remove Buscar Perfil Empresa connection if still present, add Normalizar Linea
  const ffc = newConns['Format Final Columns1'];
  if (ffc && ffc.main) {
    // Filter out any remaining Buscar Perfil Empresa references
    ffc.main = ffc.main.map(outputArr =>
      outputArr.filter(t => t.node !== 'Buscar Perfil Empresa' && t.node !== 'Set: Merge Segmentación')
    );
    // Add Normalizar Linea if not already present in output[0]
    const firstOutput = ffc.main[0] || [];
    if (!firstOutput.some(t => t.node === 'Normalizar Linea')) {
      ffc.main[0] = [...firstOutput, { node: 'Normalizar Linea', type: 'main', index: 0 }];
    }
  }

  // 7. Build final nodes list
  const allNodes = [...keptNodes, parseNode];
  console.log(`Total nodos WF02: ${allNodes.length} (${keptNodes.length} reutilizados + 1 nuevo)`);
  console.log('');

  // 8. Build workflow payload
  const wf02 = {
    name: 'Agent 02 - Radar de Inversión v1.0',
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      callerPolicy: 'workflowsFromSameOwner',
      errorWorkflow: ''
    },
    nodes: allNodes,
    connections: newConns
  };

  if (DRY_RUN) {
    const out = path.join(__dirname, 'workflow02_radar_draft.json');
    fs.writeFileSync(out, JSON.stringify(wf02, null, 2), 'utf8');
    console.log('DRY RUN: workflow guardado en:', out);

    // Show Format Final Columns1 connections for review
    console.log('\nConexiones de Format Final Columns1:');
    const ffc2 = newConns['Format Final Columns1'];
    if (ffc2) {
      ffc2.main?.forEach((arr, i) => {
        arr.forEach(t => console.log(`  output[${i}] → ${t.node}`));
      });
    }
    return;
  }

  // 9. Create workflow
  console.log('Creando WF02 en N8N...');
  const createRes = await api('POST', '/api/v1/workflows', wf02);
  if (createRes.status !== 200 && createRes.status !== 201) {
    console.error('ERROR al crear WF02:', createRes.status, createRes.body);
    process.exit(1);
  }

  const created = JSON.parse(createRes.body);
  console.log('');
  console.log('✅ Workflow 02 creado exitosamente!');
  console.log(`   ID:     ${created.id}`);
  console.log(`   Nombre: ${created.name}`);
  console.log(`   URL:    https://${N8N_HOST}/workflow/${created.id}`);
  console.log(`   Webhook: https://${N8N_HOST}/webhook/radar-scan`);

  // Save to disk
  const savedPath = path.join(__dirname, 'workflow02_created.json');
  fs.writeFileSync(savedPath, JSON.stringify(created, null, 2), 'utf8');
  console.log(`   Guardado en: ${savedPath}`);

  console.log('');
  console.log('─────────────────────────────────────────────────');
  console.log('PRÓXIMOS PASOS:');
  console.log(`1. El WF01 ya apunta a: https://${N8N_HOST}/webhook/radar-scan`);
  console.log('   ✅ No necesitas actualizar WF01 — la URL ya es correcta.');
  console.log(`2. Activar WF02 en N8N UI: https://${N8N_HOST}/workflow/${created.id}`);
  console.log('3. Verificar que "Normalizar Linea" esté correctamente conectado a Format Final Columns1');
  console.log('4. Desactivar el workflow monolítico original: cB6VI7ZPS4fFVi-dAk4RG');
  console.log('─────────────────────────────────────────────────');
  console.log('');
  console.log('ID WF02 para actualizar en MEMORY.md:', created.id);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
