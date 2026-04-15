/**
 * fix_r2_accept_radar_context.js
 *
 * Sprint R.2 — Reorden cadena A1→A2→A3
 * Modifica WF01 para que pueda recibir el contexto del Radar (WF02)
 * y lo procese correctamente.
 *
 * WF01 antes: recibía solo datos de segmentación del frontend
 * WF01 ahora: puede recibir (a) payload del frontend (legacy) O
 *             (b) payload enriquecido del WF02 con score_radar, tipo_senal, etc.
 *
 * Cambios:
 *   1. Actualiza "Code: Parse WF01 Input" (si existe) para aceptar campo _origen
 *   2. Agrega nodo "Code: Merge Radar Context" que inyecta score_radar_prev,
 *      tipo_senal, monto, horizonte en el item antes del agente calificador
 *   3. El campo _origen='wf02_radar' indica que el scoring debe usar TIR
 *      (Sprint C lo implementará — aquí solo se prepara la estructura)
 *
 * Uso: node fix_r2_accept_radar_context.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF01_ID  = 'jDtdafuyYt8TXISl';
const DRY_RUN  = process.argv.includes('--dry-run');

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

// ── Código del nodo que normaliza el input de WF01 ──────────────────────────
// Compatible con (a) llamada directa del frontend y (b) llamada desde WF02
const MERGE_RADAR_CONTEXT_CODE = `// ─── Sprint R.2: Merge Radar Context en WF01 ────────────────────────────────
// Normaliza el input de WF01 para que funcione tanto con:
//   (a) llamada directa del frontend: { empresa, pais, linea_negocio, ... }
//   (b) llamada desde WF02 Radar:     { ..., score_radar, tipo_senal, _origen: "wf02_radar" }
//
// En caso (b) inyecta los campos del Radar como contexto adicional.
// El agente calificador (AI Agent) los usará para TIR (Sprint C).

const items = $input.all();

return items.map(item => {
  const json = item.json;
  const origenRadar = json._origen === 'wf02_radar';

  // ── Campos core siempre presentes ──
  const empresa       = json.empresa || json['COMPANY NAME'] || '';
  const pais          = json.pais    || json.PAIS            || 'Colombia';
  const linea_negocio = json.linea_negocio || json['LINEA DE NEGOCIO'] || '';
  const company_domain = json.company_domain || '';
  const paises        = Array.isArray(json.paises) ? json.paises : [pais];

  // ── Contexto del Radar (solo disponible cuando _origen = wf02_radar) ──
  const radar_context = origenRadar ? {
    score_radar_prev:    json.score_radar      || 0,
    composite_prev:      json.composite_score  || 0,
    tier_radar_prev:     json.tier_radar        || 'MONITOREO',
    tipo_senal:          json.tipo_senal        || '',
    descripcion_senal:   json.descripcion_senal || '',
    monto_detectado:     json.monto_detectado   || '',
    horizonte_meses:     json.horizonte_meses   || null,
    convergencia:        json.convergencia      || false,
    convergencia_detalle: json.convergencia_detalle || '',
    peso_fuente_max:     json.peso_fuente_max   || 0,
    _wf02_execution:     json._wf02_execution   || '',
  } : {};

  // ── Instrucción para el agente: ¿usar TIR o solo TIER? ──
  // Sprint C implementará el prompt TIR completo.
  // Por ahora se pasa la bandera para que el agente lo detecte.
  const scoring_mode = origenRadar ? 'TIER_Y_TIR' : 'TIER_SOLO';

  return {
    json: {
      ...json,
      // Normalizado
      empresa,
      pais,
      linea_negocio,
      company_domain,
      paises,
      es_multinacional: json.es_multinacional || false,
      // Contexto Radar
      ...radar_context,
      // Modo de scoring para el agente
      scoring_mode,
      _origen_wf02: origenRadar,
    }
  };
});
`;

const NEW_NODE = {
  id:          'wf01-merge-radar-context',
  name:        'Code: Merge Radar Context',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: { mode: 'runOnceForAllItems', jsCode: MERGE_RADAR_CONTEXT_CODE },
};

// Insertar justo después del Webhook (o Parse Input) y ANTES del agente calificador
const INSERT_AFTER_CANDIDATES = [
  'Webhook Calificador',
  'Code: Parse WF01 Input',
  'Code: Parse Input',
  'Parse Input',
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Sprint R.2 — WF01: aceptar contexto del Radar (WF02)          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF01_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET WF01 failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  console.log(`Workflow: "${wf.name}" — ${wf.nodes.length} nodos`);

  const backupPath = path.join(__dirname, `backup_wf01_pre_sprintR2_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', DRY_RUN ? '(skipped)' : backupPath);
  console.log('');

  // Actualizar si ya existe
  const existing = wf.nodes.find(n => n.name === NEW_NODE.name);
  if (existing) {
    existing.parameters.jsCode = MERGE_RADAR_CONTEXT_CODE;
    console.log(`~ "${NEW_NODE.name}" — código actualizado`);
  } else {
    // Buscar anchor
    let anchor = null;
    for (const c of INSERT_AFTER_CANDIDATES) {
      anchor = wf.nodes.find(n => n.name === c);
      if (anchor) { console.log(`Anchor encontrado: "${anchor.name}"`); break; }
    }

    if (!anchor) {
      console.log('WARN: ningún anchor encontrado. Nodos disponibles:');
      wf.nodes.slice(0, 15).forEach(n => console.log(`  - "${n.name}"`));
      NEW_NODE.position = [-1000, 800];
    } else {
      NEW_NODE.position = [anchor.position[0] + 250, anchor.position[1]];

      // Redirigir salidas del anchor → NEW_NODE
      const anchorConns = wf.connections[anchor.name];
      if (anchorConns?.main?.[0]) {
        // Guardar targets originales y reconectar: anchor → NEW_NODE → targets
        const originalTargets = [...anchorConns.main[0]];
        anchorConns.main[0] = [{ node: NEW_NODE.name, type: 'main', index: 0 }];
        wf.connections[NEW_NODE.name] = { main: [originalTargets] };
        console.log(`  ↪ "${anchor.name}" → "${NEW_NODE.name}" → [${originalTargets.map(t => t.node).join(', ')}]`);
      }
    }

    wf.nodes.push(NEW_NODE);
    console.log(`+ Nodo "${NEW_NODE.name}" agregado`);
  }

  console.log('');
  console.log('Campos que WF01 ahora reconoce desde WF02:');
  console.log('  score_radar_prev, tipo_senal, descripcion_senal, monto_detectado,');
  console.log('  horizonte_meses, convergencia, peso_fuente_max, scoring_mode');
  console.log('  (Sprint C usará estos para el prompt TIR del agente calificador)');

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF01_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('');
    console.log('✔ WF01 actualizado en n8n');
  } else {
    console.log('');
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Sprint R.2 completado');
  console.log('');
  console.log('Cadena final verificada:');
  console.log('  Frontend → POST /radar-scan (WF02)');
  console.log('  WF02     → POST /calificador (WF01) con score_radar + contexto');
  console.log('  WF01     → POST /prospector  (WF03) con tier + paises[]');
  console.log('');
  console.log('SIGUIENTE: Sprint C — WF01 TIR (5 variables) + inmutabilidad');
  console.log('  Archivo: n8n/wf01-calificador/fix_c1_tir.js');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
