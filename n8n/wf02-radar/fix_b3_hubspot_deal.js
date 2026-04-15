/**
 * fix_b3_hubspot_deal.js
 *
 * Sprint B.3 — Radar v1.2
 * Agrega el nodo HubSpot "Create Deal + Task" al final de WF02.
 * Se dispara SOLO si: score_radar >= 8 AND convergencia = true.
 *
 * BLOQUEADOR: Requiere Private App Token de HubSpot.
 * Aprobación de Felipe Gaviria requerida (MAOA §12.3).
 *
 * Pasos manuales previos:
 *   1. En HubSpot: Settings → Integrations → Private Apps → Create app
 *      Permisos necesibles: crm.objects.deals.write, crm.objects.contacts.write,
 *                           crm.objects.notes.write, sales.tasks.write
 *   2. Copiar el token y crear credencial en n8n:
 *      Settings → Credentials → New → HubSpot API
 *      Name: "HubSpot Radar Matec"  Value: pat-na1-...
 *   3. Copiar el credentialId y pasarlo como argumento
 *   4. Crear pipeline "Radar" en HubSpot CRM
 *      y copiar el pipelineId y la etapa inicial (stageId)
 *
 * Uso:
 *   node fix_b3_hubspot_deal.js <credentialId> <pipelineId> <stageId> [--dry-run]
 *
 * Ejemplo:
 *   node fix_b3_hubspot_deal.js abc123 "pipeline-radar" "etapa-nueva" --dry-run
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID  = 'fko0zXYYl5X4PtHz';
const DRY_RUN  = process.argv.includes('--dry-run');

// Args posicionales (no flags)
const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [CRED_ID = null, PIPELINE_ID = 'REEMPLAZAR_PIPELINE_ID', STAGE_ID = 'REEMPLAZAR_STAGE_ID'] = ARGS;

// Insertar después del nodo de convergencia y ANTES del trigger WF01
const INSERT_AFTER = 'Code: Calcular Convergencia';

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

// ── Nodo IF: condición de convergencia para activar HubSpot ─────────────────
const IF_HUBSPOT_NODE = {
  id:          'wf02-if-hubspot',
  name:        'IF: Score >= 8 y Convergencia',
  type:        'n8n-nodes-base.if',
  typeVersion:  2.2,
  position:    [0, 0],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      combinator: 'and',
      conditions: [
        {
          id:        'cond-score',
          leftValue:  '={{ $json.score_radar }}',
          rightValue: 8,
          operator:  { type: 'number', operation: 'gte' },
        },
        {
          id:        'cond-convergencia',
          leftValue:  '={{ $json.convergencia }}',
          rightValue: true,
          operator:  { type: 'boolean', operation: 'equals' },
        },
      ],
    },
    options: { version: 3 },
  },
};

// ── Nodo HubSpot: Create Deal ────────────────────────────────────────────────
const HUBSPOT_DEAL_NODE = {
  id:          'wf02-hubspot-deal',
  name:        'HubSpot: Create Deal Radar',
  type:        'n8n-nodes-base.hubspot',
  typeVersion:  2,
  position:    [0, 0],
  parameters: {
    resource:   'deal',
    operation:  'create',
    additionalFields: {
      dealname:   '=[RADAR] ={{ $json.empresa }} — {{ $json.linea_negocio }} ({{ $json.pais }})',
      pipeline:   PIPELINE_ID,
      dealstage:  STAGE_ID,
      amount:     '={{ $json.monto_detectado || 0 }}',
      closedate:  '={{ $json.fecha_senal || "" }}',
      description: `=🎯 Señal detectada por Matec Radar (WF02)
Empresa:     {{ $json.empresa }}
País:        {{ $json.pais }}
Línea:       {{ $json.linea_negocio }}
Score Radar: {{ $json.score_radar }}/100
Composite:   {{ $json.composite_score }}/100
Tier:        {{ $json.tier_compuesto }}
Convergencia: {{ $json.convergencia_detalle }}
Horizonte:   {{ $json.horizonte_meses }} meses
Fuentes:     {{ $json.fuentes_count }} (peso_max={{ $json.peso_fuente_max }})`,
    },
  },
  ...(CRED_ID ? {
    credentials: {
      hubspotAppToken: { id: CRED_ID, name: 'HubSpot Radar Matec' },
    },
  } : {}),
};

// ── Nodo HubSpot: Create Task ────────────────────────────────────────────────
const HUBSPOT_TASK_NODE = {
  id:          'wf02-hubspot-task',
  name:        'HubSpot: Create Task Seguimiento',
  type:        'n8n-nodes-base.hubspot',
  typeVersion:  2,
  position:    [0, 0],
  parameters: {
    resource:   'engagement',
    operation:  'create',
    additionalFields: {
      type:    'TASK',
      subject: '=Prospectar: {{ $json.empresa }} (Score={{ $json.score_radar }})',
      body:    '=Radar detectó señal CAPEX en {{ $json.empresa }}. Tier={{ $json.tier_compuesto }}. Asignar a Paola Vaquero para prospección Apollo.',
      status:  'NOT_STARTED',
    },
  },
  ...(CRED_ID ? {
    credentials: {
      hubspotAppToken: { id: CRED_ID, name: 'HubSpot Radar Matec' },
    },
  } : {}),
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix B.3 — HubSpot Deal + Task desde WF02 Radar                ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');

  if (!CRED_ID) {
    console.log('');
    console.log('⚠️  BLOQUEADOR: HubSpot Private App Token no configurado.');
    console.log('   Este script requiere aprobación de Felipe Gaviria (MAOA §12.3).');
    console.log('');
    console.log('   Pasos para desbloquear:');
    console.log('   1. HubSpot → Settings → Integrations → Private Apps → Create');
    console.log('      Permisos: crm.objects.deals.write, crm.objects.contacts.write,');
    console.log('                crm.objects.notes.write, sales.tasks.write');
    console.log('   2. n8n → Credentials → New → HubSpot API (Token)');
    console.log('      Name: "HubSpot Radar Matec"');
    console.log('   3. Crear pipeline "Radar" en HubSpot CRM → copiar IDs');
    console.log('   4. Ejecutar:');
    console.log('      node fix_b3_hubspot_deal.js <credId> <pipelineId> <stageId>');
    console.log('');
    if (!DRY_RUN) {
      console.log('Abortando (sin credentialId). Usar --dry-run para previsualizar los nodos.');
      process.exit(0);
    }
  } else {
    console.log(`Credential ID: ${CRED_ID}`);
    console.log(`Pipeline ID:   ${PIPELINE_ID}`);
    console.log(`Stage ID:      ${STAGE_ID}`);
  }
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf02_pre_b3_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // Posicionar nodos
  const anchor = wf.nodes.find(n => n.name === INSERT_AFTER);
  const basePos = anchor ? [anchor.position[0] + 250, anchor.position[1]] : [1000, 1200];

  IF_HUBSPOT_NODE.position       = [basePos[0],        basePos[1]];
  HUBSPOT_DEAL_NODE.position      = [basePos[0] + 250,  basePos[1] - 100];
  HUBSPOT_TASK_NODE.position      = [basePos[0] + 500,  basePos[1] - 100];

  const nodesToAdd = [IF_HUBSPOT_NODE, HUBSPOT_DEAL_NODE, HUBSPOT_TASK_NODE];
  for (const n of nodesToAdd) {
    const ex = wf.nodes.find(e => e.name === n.name);
    if (ex) {
      Object.assign(ex, n);
      console.log(`~ Nodo actualizado: "${n.name}"`);
    } else {
      wf.nodes.push(n);
      console.log(`+ Nodo agregado: "${n.name}"`);
    }
  }

  // Conexiones:
  // anchor → IF_HUBSPOT (branch true=0) → DEAL → TASK
  //        → (branch false=1) sigue flujo normal

  const addConn = (from, to, outputBranch = 0) => {
    if (!wf.connections[from]) wf.connections[from] = { main: [[], []] };
    while (wf.connections[from].main.length <= outputBranch) wf.connections[from].main.push([]);
    if (!wf.connections[from].main[outputBranch].find(c => c.node === to)) {
      wf.connections[from].main[outputBranch].push({ node: to, type: 'main', index: 0 });
    }
  };

  // anchor → IF node (branch 0 del anchor)
  if (anchor) {
    if (!wf.connections[INSERT_AFTER]) wf.connections[INSERT_AFTER] = { main: [[]] };
    if (!wf.connections[INSERT_AFTER].main[0].find(c => c.node === IF_HUBSPOT_NODE.name)) {
      wf.connections[INSERT_AFTER].main[0].push({ node: IF_HUBSPOT_NODE.name, type: 'main', index: 0 });
    }
  }
  // IF true (branch 0) → Deal
  addConn(IF_HUBSPOT_NODE.name, HUBSPOT_DEAL_NODE.name, 0);
  // Deal → Task
  addConn(HUBSPOT_DEAL_NODE.name, HUBSPOT_TASK_NODE.name, 0);
  // IF false (branch 1) → continúa flujo hacia WF01 (sin HubSpot)

  console.log(`\nFlujo HubSpot:`);
  console.log(`  ${INSERT_AFTER} → IF(score>=8 && convergencia) → [true]  → HubSpot Deal → HubSpot Task`);
  console.log(`  ${INSERT_AFTER} → IF(score>=8 && convergencia) → [false] → (flujo normal, sin HubSpot)`);

  if (!DRY_RUN && CRED_ID) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('\n✔ Workflow actualizado en n8n');
  } else {
    console.log('\nDRY RUN / sin credencial — sin cambios en n8n');
  }

  console.log('');
  console.log('✅ Fix B.3 preparado');
  console.log('   Ejecutar con credentialId real cuando Felipe apruebe HubSpot.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
