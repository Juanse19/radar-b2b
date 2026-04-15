/**
 * fix_a4_horizonte.js
 *
 * Sprint A.4 — Radar v1.1
 * Agrega nodo "Code: Filtrar Horizonte" después del Agente Validador.
 * Descarta señales con fecha_evento > hoy + 180 días (365 para países foco).
 * También corrige Bug D: asegura que paises[] se propague en el payload a WF03.
 *
 * Uso: node fix_a4_horizonte.js [--dry-run]
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const N8N_HOST     = 'n8n.event2flow.com';
const API_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const WF02_ID      = 'fko0zXYYl5X4PtHz';
// Insertar DESPUÉS del validador determinístico
const INSERT_AFTER = 'AI Agente Validador';   // ajustar si el nombre es diferente en n8n
const DRY_RUN      = process.argv.includes('--dry-run');

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

const FILTRAR_HORIZONTE_CODE = `// ─── A.4: Filtrar Horizonte + Bug D fix (paises[]) ────────────────────────
// Descarta señales con fecha_evento fuera del horizonte permitido:
//   - Países foco (CO, MX, BR, CL): horizonte 12 meses (365 días)
//   - Resto: horizonte 6 meses (180 días)
// Bug D fix: garantiza que paises[] se incluya en el output.

const PAISES_FOCO = new Set(['CO', 'MX', 'BR', 'CL', 'Colombia', 'Mexico', 'México',
                              'Brasil', 'Brazil', 'Chile']);

const HOY = new Date();

const items = $input.all();
const resultado = [];

for (const item of items) {
  const json = item.json;

  // Determinar horizonte en días
  const pais = json.pais_iso || json.PAIS || json.pais || '';
  const esFocoPais = PAISES_FOCO.has(pais);
  const horizonte_dias = esFocoPais ? 365 : 180;

  // Parsear fecha_evento (puede venir en varias formas)
  let fechaEvento = null;
  const fechaRaw = json.fecha_evento || json.fecha_senal || json.fecha || null;
  if (fechaRaw) {
    fechaEvento = new Date(fechaRaw);
  }

  // Filtrar si fecha_evento está fuera del horizonte
  if (fechaEvento && !isNaN(fechaEvento.getTime())) {
    const diasDiff = (fechaEvento - HOY) / (1000 * 60 * 60 * 24);
    if (diasDiff > horizonte_dias) {
      // Señal fuera de horizonte → marcar como descartada pero no cortar el flujo
      resultado.push({
        json: {
          ...json,
          descartado_horizonte: true,
          motivo_descarte: \`Fecha evento (\${fechaRaw}) supera horizonte de \${horizonte_dias} días para país \${pais}\`,
          horizonte_meses: Math.round(diasDiff / 30),
        }
      });
      continue;
    }
  }

  // Calcular horizonte_meses para señales válidas
  let horizonte_meses = null;
  if (fechaEvento && !isNaN(fechaEvento.getTime())) {
    horizonte_meses = Math.max(0, Math.round((fechaEvento - HOY) / (1000 * 60 * 60 * 24 * 30)));
  }

  // Bug D fix: construir paises[] desde paises input o pais único
  let paises = json.paises;
  if (!Array.isArray(paises) || paises.length === 0) {
    paises = pais ? [pais] : [];
  }

  resultado.push({
    json: {
      ...json,
      paises,
      horizonte_meses,
      descartado_horizonte: false,
    }
  });
}

return resultado;
`;

const NEW_NODE = {
  id:          'wf02-filtrar-horizonte',
  name:        'Code: Filtrar Horizonte',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: {
    mode:   'runOnceForAllItems',
    jsCode: FILTRAR_HORIZONTE_CODE,
  },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Fix A.4 — Filtro horizonte 6M + Bug D fix paises[]            ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);

  if (!DRY_RUN) {
    const bp = path.join(__dirname, `backup_wf02_pre_a4_${Date.now()}.json`);
    fs.writeFileSync(bp, JSON.stringify(wf, null, 2));
    console.log('Backup:', bp);
  }

  // Already exists? Update code only
  const existing = wf.nodes.find(n => n.name === NEW_NODE.name);
  if (existing) {
    existing.parameters.jsCode = FILTRAR_HORIZONTE_CODE;
    console.log('Nodo existente → código actualizado');
  } else {
    const anchor = wf.nodes.find(n => n.name === INSERT_AFTER);
    if (anchor) {
      NEW_NODE.position = [anchor.position[0] + 250, anchor.position[1]];
    } else {
      console.log(`WARN: anchor "${INSERT_AFTER}" no encontrado. Nodos disponibles:`);
      wf.nodes.forEach(n => console.log('  -', n.name));
      NEW_NODE.position = [500, 700];
    }
    wf.nodes.push(NEW_NODE);

    if (anchor) {
      if (!wf.connections[INSERT_AFTER]) wf.connections[INSERT_AFTER] = { main: [[]] };
      (wf.connections[INSERT_AFTER].main[0] = wf.connections[INSERT_AFTER].main[0] || [])
        .push({ node: NEW_NODE.name, type: 'main', index: 0 });
    }
    console.log(`Nodo "${NEW_NODE.name}" agregado`);
  }

  if (!DRY_RUN) {
    const upRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, wf);
    if (upRes.status !== 200) throw new Error(`PUT failed: ${upRes.status} ${upRes.body}`);
    console.log('✔ Workflow actualizado');
  } else {
    console.log('DRY RUN — sin cambios');
  }

  console.log('');
  console.log('✅ Fix A.4 completado');
  console.log('   Señales con fecha > horizonte marcadas como descartado_horizonte=true');
  console.log('   paises[] garantizado en output para WF03');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
