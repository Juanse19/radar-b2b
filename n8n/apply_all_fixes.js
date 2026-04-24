/**
 * apply_all_fixes.js
 *
 * Script maestro que aplica TODOS los cambios de Sprint A + B + R
 * a WF02 (Radar) y WF01 (Calificador) en una sola ejecución.
 *
 * Orden de aplicación:
 *   WF02:
 *     1. Bug E  — Remover headers Tavily hardcodeados
 *     2. A.1    — Dual-query Tavily (gov include_domains + general)
 *     3. A.2    — Nodo "Code: Clasificar Fuente" (peso_fuente 1–5)
 *     4. A.3    — Keywords fetch chain desde Supabase
 *     5. A.4    — Filtro horizonte 6M (+ asegurar paises[])
 *     6. B.1    — Convergencia de señales
 *     7. R.1    — WF02 → /calificador (WF01) en vez de /prospector (WF03)
 *
 *   WF01:
 *     8. Bug D  — Build paises[] antes de llamar a WF02
 *     9. R.2    — Nodo "Code: Merge Radar Context"
 *
 * Uso: node apply_all_fixes.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID  = 'fko0zXYYl5X4PtHz';
const WF01_ID  = 'jDtdafuyYt8TXISl';
const DRY_RUN  = process.argv.includes('--dry-run');

// ── Sólo estos campos acepta el PUT de n8n ──────────────────────────────────
// Probado: staticData y pinData causan 400. Solo name+nodes+connections+settings.
const PUT_ALLOWED = ['name', 'nodes', 'connections', 'settings'];
function stripForPut(wf) {
  const out = {};
  for (const k of PUT_ALLOWED) if (k in wf) out[k] = wf[k];
  return out;
}

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

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function err(msg)  { console.log(`  ✗ ${msg}`); }

// ══════════════════════════════════════════════════════════════════════════════
// ── WF02 FIXES ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Bug E: Remover headers Tavily hardcodeados ────────────────────────────────
function applyBugE(wf) {
  log('\n[Bug E] Remover Authorization header hardcodeado de nodos Tavily');
  let changed = 0;
  for (const node of wf.nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;
    const url = node.parameters?.url || '';
    if (!url.includes('tavily.com')) continue;

    const sendHeaders = node.parameters?.sendHeaders;
    const params = node.parameters?.headerParameters?.parameters || [];
    const authIdx = params.findIndex(h => (h.name || '').toLowerCase() === 'authorization');

    if (authIdx >= 0) {
      node.parameters.headerParameters.parameters.splice(authIdx, 1);
      if (node.parameters.headerParameters.parameters.length === 0) {
        node.parameters.sendHeaders = false;
      }
      ok(`"${node.name}" — Authorization header removido`);
      changed++;
    }
  }
  if (changed === 0) warn('No se encontraron headers Authorization en nodos Tavily');
  return changed;
}

// ── A.1: Reescribir nodo "Construir Query Tavily" ─────────────────────────────
const QUERY_TAVILY_CODE = `// ─── Sprint A.1: Dual-Query Tavily (GOV + General) ─────────────────────────
// Genera 2 queries por empresa:
//   1. Query GOV: busca en dominios institucionales LATAM (include_domains)
//   2. Query GEN: keywords por línea sin restricción de dominio

const item = $input.first().json;
const empresa       = item['COMPANY NAME'] || item.empresa || '';
const pais          = item.PAIS || item.pais || 'Colombia';
const lineaNegocio  = item['LINEA DE NEGOCIO'] || item.linea_negocio || '';
const domain        = item.company_domain || '';
const paises        = Array.isArray(item.paises) ? item.paises : [pais];

// ── Dominios institucionales por país ────────────────────────────────────────
const GOV_DOMAINS = {
  Colombia:     ['secop.gov.co','colombiacompra.gov.co','ani.gov.co','aerocivil.gov.co','andi.com.co','dnp.gov.co'],
  Mexico:       ['afac.gob.mx','compranet.hacienda.gob.mx','asur.com.mx','aeropuertosgap.com.mx','oma.aero','canainpa.com.mx','economia.gob.mx'],
  Chile:        ['mercadopublico.cl','chilecompra.cl','dgac.gob.cl','mop.gob.cl','corfo.cl'],
  Brasil:       ['anac.gov.br','bndes.gov.br','portaltransparencia.gov.br','gov.br','klabin.com.br','suzano.com.br'],
  Peru:         ['seace.gob.pe','ositran.gob.pe','proinversion.gob.pe'],
  Argentina:    ['argentinacompra.gov.ar','aeropuertos-argentina.gob.ar'],
};

// ── Keywords por línea de negocio ────────────────────────────────────────────
const KEYWORDS_LINEA = {
  BHS:              'sistema manejo equipaje licitación aeropuerto BHS conveyor carrusel CAPEX terminal',
  CARTON_PAPEL:     'corrugadora cartón ondulado planta papel expansión CAPEX licitación empaque',
  INTRALOGISTICA:   'CEDI automatización WMS conveyor ASRS picking intralogística inversión',
  FINAL_LINEA:      'final de línea empaque automatización robot paletizador licitación CAPEX',
  MOTOS:            'ensambladora motocicletas expansión planta producción licitación CAPEX',
  SOLUMAT:          'soluciones materiales plásticos expansión inversión CAPEX licitación',
};

// Mapear línea a key interna
function resolveLinea(l) {
  const s = (l || '').toUpperCase();
  if (s.includes('BHS') || s.includes('AEROPUERTO') || s.includes('CARGO') || s.includes('ULD')) return 'BHS';
  if (s.includes('CART') || s.includes('CORRUGADO') || s.includes('PAPEL')) return 'CARTON_PAPEL';
  if (s.includes('INTRA') || s.includes('CEDI') || s.includes('WMS')) return 'INTRALOGISTICA';
  if (s.includes('FINAL') || s.includes('ALIMENTO') || s.includes('BEBIDA')) return 'FINAL_LINEA';
  if (s.includes('MOTO')) return 'MOTOS';
  if (s.includes('SOLUMAT') || s.includes('PLÁS')) return 'SOLUMAT';
  return 'BHS';
}

const lineaKey  = resolveLinea(lineaNegocio);
const keywords  = item._keywords_db || KEYWORDS_LINEA[lineaKey] || '';

// ── Construir dominios GOV para todos los países del cliente ─────────────────
let govDomains = [];
for (const p of paises) {
  const key = Object.keys(GOV_DOMAINS).find(k => p.toLowerCase().includes(k.toLowerCase()));
  if (key) govDomains = [...new Set([...govDomains, ...GOV_DOMAINS[key]])];
}
if (govDomains.length === 0 && GOV_DOMAINS[pais]) govDomains = GOV_DOMAINS[pais];

// ── Queries ──────────────────────────────────────────────────────────────────
const queryGov = \`\${empresa} \${keywords} CAPEX licitación inversión\`;
const queryGen = \`\${empresa} \${keywords} expansión proyecto 2025 2026\`;

return [
  {
    json: {
      ...item,
      _query_gov:     queryGov,
      _query_gen:     queryGen,
      _gov_domains:   govDomains,
      _linea_key:     lineaKey,
      _keywords_used: keywords,
      _paises_search: paises,
    }
  }
];
`;

function applyA1(wf) {
  log('\n[A.1] Reescribir "Code: Construir Query Tavily" con dual-query GOV + General');
  const node = wf.nodes.find(n => n.name === 'Code: Construir Query Tavily' || n.name === 'Construir Query Tavily');
  if (!node) {
    warn('Nodo "Construir Query Tavily" no encontrado. Nodos Code disponibles:');
    wf.nodes.filter(n => n.type === 'n8n-nodes-base.code').forEach(n => warn(`  - "${n.name}"`));
    return 0;
  }
  node.parameters.jsCode = QUERY_TAVILY_CODE;
  node.parameters.mode   = 'runOnceForAllItems';
  ok(`"${node.name}" — código dual-query actualizado`);
  return 1;
}

// ── A.2: Nodo "Code: Clasificar Fuente" (peso_fuente 1–5) ────────────────────
const CLASIFICAR_FUENTE_CODE = `// ─── Sprint A.2: Clasificar Fuente → peso_fuente 1–5 ────────────────────────
// Asigna peso a cada señal según el dominio de su source_url.
// peso 5 = gov/licitación oficial
// peso 4 = operador público / IR blue-chip
// peso 3 = gremio / asociación industrial
// peso 2 = prensa especializada
// peso 1 = todo lo demás

const GOV_DOMAINS = new Set([
  'secop.gov.co','colombiacompra.gov.co','ani.gov.co','aerocivil.gov.co','dnp.gov.co',
  'afac.gob.mx','compranet.hacienda.gob.mx','economia.gob.mx',
  'mercadopublico.cl','chilecompra.cl','dgac.gob.cl','mop.gob.cl',
  'anac.gov.br','portaltransparencia.gov.br','gov.br',
  'seace.gob.pe','ositran.gob.pe','proinversion.gob.pe',
  'argentinacompra.gov.ar','aeropuertos-argentina.gob.ar',
]);

const IR_DOMAINS = new Set([
  'asur.com.mx','aeropuertosgap.com.mx','oma.aero',
  'klabin.com.br','suzano.com.br','bndes.gov.br',
  'corfo.cl','economia.gob.mx',
  'andi.com.co',  // peso 3 para ANDI
]);

const GREMIO_DOMAINS = new Set([
  'andi.com.co','canainpa.com.mx',
]);

const PRENSA_ESP = new Set([
  'aviacionline.com','aerolatinnews.com','aircargonews.net',
  'packagingnews.co.uk','revista-logistica.com',
]);

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\\./, '');
  } catch { return url || ''; }
}

function getPeso(url) {
  const d = extractDomain(url);
  if (!d) return 1;
  // Gov oficial
  if (GOV_DOMAINS.has(d)) return 5;
  // Subdominios .gov.* y .gob.*
  if (d.includes('.gov.') || d.includes('.gob.') || d.endsWith('.gov') || d.endsWith('.gob')) return 5;
  // Gremio (antes de IR, prioridad menor)
  if (GREMIO_DOMAINS.has(d)) return 3;
  // IR / operador público
  if (IR_DOMAINS.has(d)) return 4;
  // Prensa especializada
  if (PRENSA_ESP.has(d)) return 2;
  return 1;
}

return $input.all().map(item => {
  const url    = item.json.source_url || item.json.url || '';
  const peso   = getPeso(url);
  return {
    json: {
      ...item.json,
      peso_fuente: peso,
      dominio:     extractDomain(url),
    }
  };
});
`;

const CLASIFICAR_FUENTE_NODE = {
  id:          'code-clasificar-fuente',
  name:        'Code: Clasificar Fuente',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: { mode: 'runOnceForAllItems', jsCode: CLASIFICAR_FUENTE_CODE },
};

function applyA2(wf) {
  log('\n[A.2] Agregar nodo "Code: Clasificar Fuente" para peso_fuente');

  // Si ya existe, actualizar el código
  const existing = wf.nodes.find(n => n.name === 'Code: Clasificar Fuente');
  if (existing) {
    existing.parameters.jsCode = CLASIFICAR_FUENTE_CODE;
    ok('"Code: Clasificar Fuente" — código actualizado (ya existía)');
    return 1;
  }

  // Buscar anchor: nodo que procesa resultados de Tavily antes de Format Final Columns
  // Candidatos en orden de preferencia
  const ANCHOR_CANDIDATES = [
    'Buscar Tavily General1',
    'Buscar Fuentes Primarias',
    'HTTP: Tavily GOV',
    'HTTP: Tavily General',
  ];
  let anchor = null;
  for (const c of ANCHOR_CANDIDATES) {
    anchor = wf.nodes.find(n => n.name === c);
    if (anchor) break;
  }
  if (!anchor) {
    anchor = wf.nodes.find(n => n.type === 'n8n-nodes-base.httpRequest' && (n.parameters?.url || '').includes('tavily'));
  }

  if (!anchor) {
    warn('No se encontró anchor Tavily. Nodo insertado sin conexión — conectar manualmente.');
    CLASIFICAR_FUENTE_NODE.position = [-400, 600];
    wf.nodes.push(CLASIFICAR_FUENTE_NODE);
    return 1;
  }

  CLASIFICAR_FUENTE_NODE.position = [anchor.position[0] + 280, anchor.position[1]];
  // Reconectar: anchor → Clasificar Fuente → targets originales
  const anchorConns = wf.connections[anchor.name]?.main?.[0] || [];
  if (anchorConns.length > 0) {
    wf.connections[CLASIFICAR_FUENTE_NODE.name] = { main: [[...anchorConns]] };
    wf.connections[anchor.name].main[0] = [{ node: CLASIFICAR_FUENTE_NODE.name, type: 'main', index: 0 }];
    ok(`Cadena: "${anchor.name}" → "Code: Clasificar Fuente" → [${anchorConns.map(c => c.node).join(', ')}]`);
  } else {
    ok(`"${anchor.name}" → "Code: Clasificar Fuente" (sin targets previos)`);
  }

  wf.nodes.push(CLASIFICAR_FUENTE_NODE);
  ok('"Code: Clasificar Fuente" agregado');
  return 1;
}

// ── A.3: Keywords fetch chain (Supabase) ─────────────────────────────────────
const RESOLVE_SUBLINEA_CODE = `// ─── Sprint A.3: Resolver Sub-Línea desde linea_negocio ────────────────────
const item = $input.first().json;
const linea = (item['LINEA DE NEGOCIO'] || item.linea_negocio || '').toUpperCase();

const MAP = {
  BHS:           ['aeropuertos','cargo_uld'],
  CARTON_PAPEL:  ['carton_corrugado'],
  INTRALOGISTICA:['final_linea'],   // CEDI comparte sub-línea en este seed
  FINAL_LINEA:   ['final_linea'],
  MOTOS:         ['ensambladoras_motos'],
  SOLUMAT:       ['solumat'],
};

function resolveLinea(l) {
  if (l.includes('BHS') || l.includes('AEROPUERTO') || l.includes('CARGO') || l.includes('ULD')) return 'BHS';
  if (l.includes('CART') || l.includes('CORRUGADO') || l.includes('PAPEL')) return 'CARTON_PAPEL';
  if (l.includes('INTRA') || l.includes('CEDI') || l.includes('WMS')) return 'INTRALOGISTICA';
  if (l.includes('FINAL') || l.includes('ALIMENTO') || l.includes('BEBIDA')) return 'FINAL_LINEA';
  if (l.includes('MOTO')) return 'MOTOS';
  if (l.includes('SOLUMAT') || l.includes('PLÁS')) return 'SOLUMAT';
  return 'BHS';
}

const lineaKey = resolveLinea(linea);
const subLineas = MAP[lineaKey] || ['aeropuertos'];

return [{ json: { ...item, _linea_key: lineaKey, _sub_lineas: subLineas } }];
`;

const FETCH_KEYWORDS_NODE = {
  id:          'http-fetch-keywords-supabase',
  name:        'HTTP: Fetch Keywords Supabase',
  type:        'n8n-nodes-base.httpRequest',
  typeVersion:  4.2,
  position:    [0, 0],
  parameters: {
    method:   'POST',
    url:      'https://supabase.valparaiso.cafe/pg/query',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'json',
    body: {
      query: `SELECT palabra, peso, tipo, idioma FROM matec_radar.palabras_clave_por_linea WHERE activo = true AND nombre IN ({{ $json._sub_lineas.map(s => "'" + s + "'").join(',') }}) ORDER BY peso DESC LIMIT 30`,
    },
    options: { response: { response: { neverError: true } } },
  },
};

const MERGE_KEYWORDS_CODE = `// ─── Sprint A.3: Merge Keywords DB con item original ───────────────────────
// Combina las keywords de Supabase con el item previo
const items = $input.all();
const first  = items[0]?.json || {};

// Las keywords vienen como array de rows de Supabase
let keywords = '';
try {
  const rows = Array.isArray(first) ? first : (first.rows || first.data || []);
  keywords = rows.map(r => r.palabra || r[0]).filter(Boolean).join(' ');
} catch {}

// Recuperar el item original del contexto previo
const original = $('Code: Resolve Sub-Línea').first().json;

return [{ json: { ...original, _keywords_db: keywords } }];
`;

const MERGE_KEYWORDS_NODE = {
  id:          'code-merge-keywords',
  name:        'Code: Merge Keywords DB',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: { mode: 'runOnceForAllItems', jsCode: MERGE_KEYWORDS_CODE },
};

const RESOLVE_SUBLINEA_NODE = {
  id:          'code-resolve-sublinea',
  name:        'Code: Resolve Sub-Línea',
  type:        'n8n-nodes-base.code',
  typeVersion:  2,
  position:    [0, 0],
  parameters: { mode: 'runOnceForAllItems', jsCode: RESOLVE_SUBLINEA_CODE },
};

function applyA3(wf) {
  log('\n[A.3] Agregar cadena keywords Supabase antes de "Construir Query Tavily"');

  // Si ya existe alguno de los nodos, actualizar y salir
  const existingMerge   = wf.nodes.find(n => n.name === 'Code: Merge Keywords DB');
  const existingResolve = wf.nodes.find(n => n.name === 'Code: Resolve Sub-Línea');
  if (existingMerge || existingResolve) {
    if (existingResolve) { existingResolve.parameters.jsCode = RESOLVE_SUBLINEA_CODE; ok('"Code: Resolve Sub-Línea" actualizado'); }
    if (existingMerge)   { existingMerge.parameters.jsCode   = MERGE_KEYWORDS_CODE;   ok('"Code: Merge Keywords DB" actualizado'); }
    return 1;
  }

  // Buscar el nodo que debe ir ANTES de Construir Query Tavily
  const queryCandidates = ['Code: Construir Query Tavily', 'Construir Query Tavily'];
  let queryNode = null;
  for (const c of queryCandidates) {
    queryNode = wf.nodes.find(n => n.name === c);
    if (queryNode) break;
  }
  if (!queryNode) {
    warn('No se encontró nodo "Construir Query Tavily" para insertar antes. Los 3 nodos A.3 agregados sin conexión.');
  }

  // Buscar quién conecta HACIA "Construir Query Tavily"
  let predecessor = null;
  if (queryNode) {
    for (const [srcName, conns] of Object.entries(wf.connections)) {
      const main0 = conns.main?.[0] || [];
      if (main0.some(c => c.node === queryNode.name)) {
        predecessor = wf.nodes.find(n => n.name === srcName);
        break;
      }
    }
  }

  // Posicionar nodos
  const baseX = queryNode ? queryNode.position[0] - 800 : -1200;
  const baseY = queryNode ? queryNode.position[1]        : 400;

  RESOLVE_SUBLINEA_NODE.position  = [baseX,       baseY];
  FETCH_KEYWORDS_NODE.position    = [baseX + 280, baseY];
  MERGE_KEYWORDS_NODE.position    = [baseX + 560, baseY];

  // Reconectar: predecessor → Resolve → Fetch → Merge → Construir Query Tavily
  if (predecessor && queryNode) {
    const predConns = wf.connections[predecessor.name]?.main?.[0] || [];
    const predToQuery = predConns.findIndex(c => c.node === queryNode.name);
    if (predToQuery >= 0) {
      predConns[predToQuery] = { node: RESOLVE_SUBLINEA_NODE.name, type: 'main', index: 0 };
    } else {
      predConns.push({ node: RESOLVE_SUBLINEA_NODE.name, type: 'main', index: 0 });
    }
    wf.connections[RESOLVE_SUBLINEA_NODE.name]  = { main: [[{ node: FETCH_KEYWORDS_NODE.name,  type: 'main', index: 0 }]] };
    wf.connections[FETCH_KEYWORDS_NODE.name]    = { main: [[{ node: MERGE_KEYWORDS_NODE.name,   type: 'main', index: 0 }]] };
    wf.connections[MERGE_KEYWORDS_NODE.name]    = { main: [[{ node: queryNode.name,             type: 'main', index: 0 }]] };
    ok(`"${predecessor.name}" → Resolve → Fetch → Merge → "${queryNode.name}"`);
  } else if (queryNode) {
    wf.connections[RESOLVE_SUBLINEA_NODE.name]  = { main: [[{ node: FETCH_KEYWORDS_NODE.name,  type: 'main', index: 0 }]] };
    wf.connections[FETCH_KEYWORDS_NODE.name]    = { main: [[{ node: MERGE_KEYWORDS_NODE.name,   type: 'main', index: 0 }]] };
    wf.connections[MERGE_KEYWORDS_NODE.name]    = { main: [[{ node: queryNode.name,             type: 'main', index: 0 }]] };
    ok(`Resolve → Fetch → Merge → "${queryNode.name}" (sin predecessor detectado)`);
  }

  wf.nodes.push(RESOLVE_SUBLINEA_NODE, FETCH_KEYWORDS_NODE, MERGE_KEYWORDS_NODE);
  ok('3 nodos A.3 agregados: Resolve Sub-Línea, Fetch Keywords, Merge Keywords');
  return 1;
}

// ── A.4: Filtro horizonte 6M ──────────────────────────────────────────────────
const FILTRO_HORIZONTE_CODE = `// ─── Sprint A.4: Filtrar por Horizonte (6M para países normales, 12M para CO/MX/BR/CL) ──
// Descarta señales donde fecha_evento > hoy + horizonte_max_dias

const FOCO_PAISES = ['colombia', 'mexico', 'brasil', 'chile', 'co', 'mx', 'br', 'cl'];
const HOY = Date.now();

return $input.all().filter(item => {
  const json = item.json;
  const fecha = json.fecha_evento || json.date || json.published_date || '';
  if (!fecha) return true; // sin fecha → no descartar

  const ts = new Date(fecha).getTime();
  if (isNaN(ts)) return true; // fecha inválida → no descartar

  const pais = (json.pais || json.PAIS || '').toLowerCase();
  const esFoco = FOCO_PAISES.some(p => pais.includes(p));
  const maxDias = esFoco ? 365 : 180;
  const horizonte_ms = maxDias * 24 * 3600 * 1000;

  // Señal válida si fecha_evento <= hoy + horizonte
  return ts <= HOY + horizonte_ms;
});
`;

function applyA4(wf) {
  log('\n[A.4] Agregar nodo "Code: Filtrar Horizonte" para señales > 6M');

  const existing = wf.nodes.find(n => n.name === 'Code: Filtrar Horizonte');
  if (existing) {
    existing.parameters.jsCode = FILTRO_HORIZONTE_CODE;
    ok('"Code: Filtrar Horizonte" actualizado');
    return 1;
  }

  const ANCHOR_CANDIDATES = ['AI Agente Validador1', 'AI Agente Validador', 'Code: Validador', 'Validador'];
  let anchor = null;
  for (const c of ANCHOR_CANDIDATES) { anchor = wf.nodes.find(n => n.name === c); if (anchor) break; }

  const node = {
    id:          'code-filtrar-horizonte',
    name:        'Code: Filtrar Horizonte',
    type:        'n8n-nodes-base.code',
    typeVersion:  2,
    position:    anchor ? [anchor.position[0] + 280, anchor.position[1]] : [-200, 600],
    parameters: { mode: 'runOnceForAllItems', jsCode: FILTRO_HORIZONTE_CODE },
  };

  if (anchor) {
    const anchorConns = wf.connections[anchor.name]?.main?.[0] || [];
    wf.connections[node.name] = { main: [[...anchorConns]] };
    wf.connections[anchor.name].main[0] = [{ node: node.name, type: 'main', index: 0 }];
    ok(`"${anchor.name}" → "Code: Filtrar Horizonte" → [${anchorConns.map(c => c.node).join(', ')}]`);
  } else {
    warn('Anchor "AI Agente Validador1" no encontrado — nodo sin conexión');
  }

  wf.nodes.push(node);
  ok('"Code: Filtrar Horizonte" agregado');
  return 1;
}

// ── B.1: Convergencia de señales ──────────────────────────────────────────────
const CONVERGENCIA_CODE = `// ─── Sprint B.1: Calcular Convergencia de Señales ──────────────────────────
// convergencia = TRUE si:
//   - al menos 1 señal con peso_fuente >= 4 (gov/IR oficial), Y
//   - al menos 1 señal con peso_fuente >= 3 (gremio/especializada)
// O si hay >= 3 señales cualquiera (múltiples fuentes independientes)

const items = $input.all();

let maxPeso  = 0;
let cntPeso4 = 0;
let cntPeso3 = 0;

for (const item of items) {
  const p = item.json.peso_fuente || 1;
  if (p > maxPeso) maxPeso = p;
  if (p >= 4) cntPeso4++;
  if (p >= 3) cntPeso3++;
}

const convergenciaRegla1 = cntPeso4 >= 1 && cntPeso3 >= 1;
const convergenciaRegla2 = items.length >= 3;
const convergencia = convergenciaRegla1 || convergenciaRegla2;

let detalle = '';
if (convergenciaRegla1) detalle = \`R1: \${cntPeso4} fuente(s) gov/IR + \${cntPeso3} fuente(s) gremio\`;
else if (convergenciaRegla2) detalle = \`R2: \${items.length} señales independientes\`;
else detalle = 'Sin convergencia';

// Propagar convergencia a todos los items
return items.map(item => ({
  json: {
    ...item.json,
    convergencia,
    convergencia_detalle: detalle,
    peso_fuente_max: maxPeso,
    total_senales: items.length,
  }
}));
`;

function applyB1(wf) {
  log('\n[B.1] Agregar nodo "Code: Calcular Convergencia"');

  const existing = wf.nodes.find(n => n.name === 'Code: Calcular Convergencia');
  if (existing) {
    existing.parameters.jsCode = CONVERGENCIA_CODE;
    ok('"Code: Calcular Convergencia" actualizado');
    return 1;
  }

  const ANCHOR_CANDIDATES = ['Code: Calcular Composite', 'Calcular Composite'];
  let anchor = null;
  for (const c of ANCHOR_CANDIDATES) { anchor = wf.nodes.find(n => n.name === c); if (anchor) break; }

  const node = {
    id:          'code-calcular-convergencia',
    name:        'Code: Calcular Convergencia',
    type:        'n8n-nodes-base.code',
    typeVersion:  2,
    position:    anchor ? [anchor.position[0] + 280, anchor.position[1]] : [200, 600],
    parameters: { mode: 'runOnceForAllItems', jsCode: CONVERGENCIA_CODE },
  };

  if (anchor) {
    const anchorConns = wf.connections[anchor.name]?.main?.[0] || [];
    wf.connections[node.name] = { main: [[...anchorConns]] };
    wf.connections[anchor.name].main[0] = [{ node: node.name, type: 'main', index: 0 }];
    ok(`"${anchor.name}" → "Code: Calcular Convergencia" → [${anchorConns.map(c => c.node).join(', ')}]`);
  } else {
    warn('Anchor "Code: Calcular Composite" no encontrado — nodo sin conexión');
  }

  wf.nodes.push(node);
  ok('"Code: Calcular Convergencia" agregado');
  return 1;
}

// ── R.1: WF02 → /calificador (WF01) en vez de /prospector ────────────────────
const TRIGGER_CALIFICADOR_BODY = {
  empresa:             '={{ $json["COMPANY NAME"] || $json.empresa }}',
  pais:                '={{ $json.PAIS           || $json.pais }}',
  linea_negocio:       '={{ $json["LINEA DE NEGOCIO"] || $json.linea_negocio }}',
  company_domain:      '={{ $json.company_domain  || "" }}',
  paises:              '={{ $json.paises          || [$json.PAIS || $json.pais] }}',
  es_multinacional:    '={{ $json.es_multinacional || false }}',
  score_radar:         '={{ $json["SCORE RADAR"]  || $json.score_radar || 0 }}',
  composite_score:     '={{ $json.composite_score  || 0 }}',
  tier_radar:          '={{ $json.tier_compuesto   || "MONITOREO" }}',
  tipo_senal:          '={{ $json.tipo_senal        || "" }}',
  descripcion_senal:   '={{ $json.descripcion_senal || $json["DESCRIPCION SEÑAL"] || "" }}',
  monto_detectado:     '={{ $json.monto_detectado   || $json["MONTO DETECTADO"] || "" }}',
  horizonte_meses:     '={{ $json.horizonte_meses   || null }}',
  convergencia:        '={{ $json.convergencia      || false }}',
  convergencia_detalle:'={{ $json.convergencia_detalle || "" }}',
  peso_fuente_max:     '={{ $json.peso_fuente_max   || 0 }}',
  _origen:             'wf02_radar',
  _wf02_execution:     '={{ $execution.id }}',
};

function applyR1(wf) {
  log('\n[R.1] Cambiar WF02 → /calificador (WF01) en vez de /prospector (WF03)');

  const CALIFICADOR_URL = 'https://n8n.event2flow.com/webhook/calificador';

  // Buscar nodo que actualmente llama a /prospector
  let node = wf.nodes.find(n =>
    n.type === 'n8n-nodes-base.httpRequest' &&
    (n.parameters?.url || '').includes('prospector')
  );

  if (!node) {
    // Ya puede estar apuntando a calificador
    node = wf.nodes.find(n =>
      n.type === 'n8n-nodes-base.httpRequest' &&
      (n.parameters?.url || '').includes('calificador')
    );
    if (node) {
      ok(`Ya existe nodo → calificador: "${node.name}" (URL: ${node.parameters?.url})`);
      // Asegurarse que el body tiene todos los campos correctos
      node.parameters.body = TRIGGER_CALIFICADOR_BODY;
      node.parameters.contentType = 'json';
      ok('Body actualizado con campos convergencia + peso_fuente_max');
      return 1;
    }
    warn('No se encontró nodo HTTP → /prospector ni → /calificador. Nodos HTTP en WF02:');
    wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
      .forEach(n => warn(`  - "${n.name}"  url=${n.parameters?.url}`));
    return 0;
  }

  const oldName = node.name;
  const oldUrl  = node.parameters?.url;

  node.name                  = 'HTTP: Trigger Calificador WF01';
  node.parameters.url        = CALIFICADOR_URL;
  node.parameters.body       = TRIGGER_CALIFICADOR_BODY;
  node.parameters.contentType= 'json';
  node.parameters.sendBody   = true;
  node.parameters.method     = 'POST';

  ok(`"${oldName}" (${oldUrl}) → "HTTP: Trigger Calificador WF01" (${CALIFICADOR_URL})`);

  // Actualizar connections si el nombre cambió
  if (oldName !== node.name) {
    for (const [src, types] of Object.entries(wf.connections)) {
      for (const outputs of Object.values(types)) {
        for (const branch of (outputs || [])) {
          for (const conn of (branch || [])) {
            if (conn.node === oldName) conn.node = node.name;
          }
        }
      }
    }
    if (wf.connections[oldName]) {
      wf.connections[node.name] = wf.connections[oldName];
      delete wf.connections[oldName];
    }
  }

  ok('WF02 ahora dispara → /calificador (WF01) en vez de /prospector (WF03)');
  return 1;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── WF01 FIXES ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Bug D: Build paises[] en WF01 ─────────────────────────────────────────────
const BUILD_PAISES_CODE = `// ─── Bug D Fix: Construir paises[] antes de llamar a WF02/WF03 ─────────────
const item = $input.first().json;

const pais = item.pais || item.PAIS || 'Colombia';
const es_multinacional = item.es_multinacional || item['ES MULTINACIONAL'] || false;

// Tomar paises[] si ya viene como array, o construirlo desde pais
let paises = Array.isArray(item.paises) ? item.paises : [pais];

// Si es multinacional y paises sólo tiene el país origen, intentar expandir
if (es_multinacional && paises.length <= 1) {
  const paisesReg = item.paises_region || [];
  if (paisesReg.length > 0) paises = [...new Set([...paises, ...paisesReg])];
}

return [{ json: { ...item, paises, pais } }];
`;

function applyBugD(wf) {
  log('\n[Bug D] Agregar "Code: Build Paises" en WF01');

  const existing = wf.nodes.find(n => n.name === 'Code: Build Paises');
  if (existing) {
    existing.parameters.jsCode = BUILD_PAISES_CODE;
    ok('"Code: Build Paises" actualizado');
    return 1;
  }

  // Anchor: webhook o Parse Input
  const ANCHOR_CANDIDATES = ['Webhook Calificador', 'Code: Parse WF01 Input', 'Code: Parse Input', 'Parse Input'];
  let anchor = null;
  for (const c of ANCHOR_CANDIDATES) { anchor = wf.nodes.find(n => n.name === c); if (anchor) break; }

  const node = {
    id:          'code-build-paises',
    name:        'Code: Build Paises',
    type:        'n8n-nodes-base.code',
    typeVersion:  2,
    position:    anchor ? [anchor.position[0] + 280, anchor.position[1]] : [-800, 400],
    parameters: { mode: 'runOnceForAllItems', jsCode: BUILD_PAISES_CODE },
  };

  if (anchor) {
    const anchorConns = wf.connections[anchor.name]?.main?.[0] || [];
    wf.connections[node.name] = { main: [[...anchorConns]] };
    wf.connections[anchor.name].main[0] = [{ node: node.name, type: 'main', index: 0 }];
    ok(`"${anchor.name}" → "Code: Build Paises" → [${anchorConns.map(c => c.node).join(', ')}]`);
  } else {
    warn('No se encontró anchor — nodo sin conexión');
  }

  wf.nodes.push(node);
  ok('"Code: Build Paises" agregado a WF01');
  return 1;
}

// ── R.2: Merge Radar Context en WF01 ─────────────────────────────────────────
const MERGE_RADAR_CONTEXT_CODE = `// ─── Sprint R.2: Merge Radar Context en WF01 ────────────────────────────────
// Normaliza el input de WF01 para que funcione tanto con:
//   (a) llamada directa del frontend: { empresa, pais, linea_negocio, ... }
//   (b) llamada desde WF02 Radar:     { ..., score_radar, tipo_senal, _origen: "wf02_radar" }

const items = $input.all();

return items.map(item => {
  const json = item.json;
  const origenRadar = json._origen === 'wf02_radar';

  const empresa        = json.empresa || json['COMPANY NAME'] || '';
  const pais           = json.pais    || json.PAIS            || 'Colombia';
  const linea_negocio  = json.linea_negocio || json['LINEA DE NEGOCIO'] || '';
  const company_domain = json.company_domain || '';
  const paises         = Array.isArray(json.paises) ? json.paises : [pais];

  const radar_context = origenRadar ? {
    score_radar_prev:     json.score_radar      || 0,
    composite_prev:       json.composite_score  || 0,
    tier_radar_prev:      json.tier_radar        || 'MONITOREO',
    tipo_senal:           json.tipo_senal        || '',
    descripcion_senal:    json.descripcion_senal || '',
    monto_detectado:      json.monto_detectado   || '',
    horizonte_meses:      json.horizonte_meses   || null,
    convergencia:         json.convergencia      || false,
    convergencia_detalle: json.convergencia_detalle || '',
    peso_fuente_max:      json.peso_fuente_max   || 0,
    _wf02_execution:      json._wf02_execution   || '',
  } : {};

  const scoring_mode = origenRadar ? 'TIER_Y_TIR' : 'TIER_SOLO';

  return {
    json: {
      ...json,
      empresa, pais, linea_negocio, company_domain, paises,
      es_multinacional: json.es_multinacional || false,
      ...radar_context,
      scoring_mode,
      _origen_wf02: origenRadar,
    }
  };
});
`;

function applyR2(wf) {
  log('\n[R.2] Agregar "Code: Merge Radar Context" en WF01');

  const existing = wf.nodes.find(n => n.name === 'Code: Merge Radar Context');
  if (existing) {
    existing.parameters.jsCode = MERGE_RADAR_CONTEXT_CODE;
    ok('"Code: Merge Radar Context" actualizado');
    return 1;
  }

  const ANCHOR_CANDIDATES = [
    'Code: Build Paises',
    'Webhook Calificador',
    'Code: Parse WF01 Input',
    'Code: Parse Input',
  ];
  let anchor = null;
  for (const c of ANCHOR_CANDIDATES) { anchor = wf.nodes.find(n => n.name === c); if (anchor) break; }

  const node = {
    id:          'wf01-merge-radar-context',
    name:        'Code: Merge Radar Context',
    type:        'n8n-nodes-base.code',
    typeVersion:  2,
    position:    anchor ? [anchor.position[0] + 280, anchor.position[1]] : [-600, 400],
    parameters: { mode: 'runOnceForAllItems', jsCode: MERGE_RADAR_CONTEXT_CODE },
  };

  if (anchor) {
    const anchorConns = wf.connections[anchor.name]?.main?.[0] || [];
    wf.connections[node.name] = { main: [[...anchorConns]] };
    wf.connections[anchor.name].main[0] = [{ node: node.name, type: 'main', index: 0 }];
    ok(`"${anchor.name}" → "Code: Merge Radar Context" → [${anchorConns.map(c => c.node).join(', ')}]`);
  } else {
    warn('No se encontró anchor — nodo sin conexión');
  }

  wf.nodes.push(node);
  ok('"Code: Merge Radar Context" agregado a WF01');
  return 1;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN ─────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function processWorkflow(wfId, label, fixes) {
  log(`\n${'═'.repeat(64)}`);
  log(` ${label} — ${wfId}`);
  log('═'.repeat(64));

  const res = await api('GET', `/api/v1/workflows/${wfId}`);
  if (res.status !== 200) throw new Error(`GET ${label} failed: ${res.status}`);
  const wf = JSON.parse(res.body);
  log(`Nodos actuales: ${wf.nodes.length}`);

  // Backup
  const backupPath = path.join(__dirname, `backup_${wfId}_pre_apply_all_${Date.now()}.json`);
  if (!DRY_RUN) fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  log(`Backup: ${DRY_RUN ? '(skipped)' : backupPath}`);

  // Aplicar fixes
  for (const fix of fixes) fix(wf);

  // PUT (solo campos permitidos)
  if (!DRY_RUN) {
    const payload = stripForPut(wf);
    const up = await api('PUT', `/api/v1/workflows/${wfId}`, payload);
    if (up.status !== 200) {
      log(`\n✗ PUT ${label} FAILED: ${up.status}`);
      log(up.body.slice(0, 500));
      return false;
    }
    log(`\n✅ ${label} actualizado en n8n (${wf.nodes.length} nodos)`);
  } else {
    log(`\n[DRY RUN] ${label} — sin cambios`);
  }
  return true;
}

async function main() {
  log('═'.repeat(64));
  log(' apply_all_fixes.js — Sprint A + B + R (WF02 + WF01)');
  log('═'.repeat(64));
  log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);

  const wf02ok = await processWorkflow(WF02_ID, 'WF02 Radar de Inversión', [
    applyBugE, applyA1, applyA2, applyA3, applyA4, applyB1, applyR1,
  ]);

  const wf01ok = await processWorkflow(WF01_ID, 'WF01 Calificador', [
    applyBugD, applyR2,
  ]);

  log('\n═'.repeat(33) + ' RESUMEN ' + '═'.repeat(23));
  log(`WF02 Radar:      ${wf02ok ? '✅ APLICADO' : '❌ FALLÓ'}`);
  log(`WF01 Calificador:${wf01ok ? '✅ APLICADO' : '❌ FALLÓ'}`);
  log('');
  log('Pendiente (manual):');
  log('  • Sprint B.3 HubSpot — requiere token de Felipe Gaviria');
  log('  • Migración Supabase 007+008 — ejecutar supabase db push');
  log('  • Credencial "Tavily API Key" en n8n Settings → agregar Bearer token');

  if (!wf02ok || !wf01ok) process.exit(1);
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
