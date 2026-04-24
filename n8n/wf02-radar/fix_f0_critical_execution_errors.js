#!/usr/bin/env node
/**
 * fix_f0_critical_execution_errors.js
 * Sprint MAOA — Fix errores críticos que causaban fallo en ~2 segundos en WF02
 *
 * Fixes aplicados:
 *  1. Determinar Sub-Línea: regex /̀-ͯ/g → /[u0300-u036f]/g (character class correcta)
 *  2. Buscar Tavily General1: +onError:continueRegularOutput (igual que Fuentes Primarias)
 *  3. Filtro Menciones Empresa: reescritura completa v6 — return explícito sin spread de item
 *     (evita contaminación de clave 'json' que causa "A json property isn't an object")
 *  4. Parse RADAR1 Output: $input.first() → $input.item (modo runOnceForEachItem)
 *
 * Ejecutar: node n8n/wf02-radar/fix_f0_critical_execution_errors.js
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID = 'fko0zXYYl5X4PtHz';

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(N8N_HOST + '/api/v1' + path, opts);
  return r.json();
}

const FILTRO_MENCIONES_V6 = `// === FILTRO MENCIONES EMPRESA v6 — MAOA Sprint (Fix json validation) ===
// v6: Elimina ...spread de item para evitar contaminación de claves en validación n8n
// v6: Return explícito sin wrapping en array extra, sin keys anidadas 'json'
const item = $input.item.json;
const empresa  = (item.empresa || item.company_name || '').trim();
const organic  = Array.isArray(item.organic) ? item.organic : [];
const fromGov  = item._from_gov === true;

const ALIASES = {
  'dhl':    ['dhl express','dhl supply chain','deutsche post dhl','dhl logistics','dhl global','dhl freight'],
  'fedex':  ['federal express','fedex express','fedex ground','fedex freight','tnt express'],
  'ups':    ['united parcel service','ups supply chain','ups logistics','ups freight'],
  'amazon': ['amazon logistics','amazon fulfillment','amazon distribution'],
  'maersk': ['maersk logistics','maersk supply chain','damco'],
};

function normalizar(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
}

const empNorm = normalizar(empresa);
const alias = ALIASES[empNorm] || [];
const searchTerms = [empNorm, ...alias.map(normalizar)];
const firstWord = empNorm.split(' ')[0];
if (firstWord && firstWord.length >= 4) searchTerms.push(firstWord);

function matchesEmpresa(text) {
  const norm = normalizar(text || '');
  return searchTerms.some(t => t && norm.includes(t));
}

const menciones = [];
const sinMencion = [];

for (const r of organic) {
  const fullText = (r.title || '') + ' ' + (r.snippet || '') + ' ' + (r.link || '');
  const entry = {
    title: String(r.title || ''),
    link: String(r.link || ''),
    snippet: String(r.snippet || ''),
    source: String(r.source || ''),
    score: Number(r.score || 0),
    _stage: String(r._stage || ''),
    _domain_priority: Number(r._domain_priority || 0),
    _mentions_empresa: Boolean(r._mentions_empresa)
  };
  if (matchesEmpresa(fullText)) {
    menciones.push({ ...entry, _match_type: 'direct' });
  } else if (fromGov) {
    sinMencion.push({ ...entry, _match_type: 'gov_indirect' });
  } else {
    sinMencion.push({ ...entry, _match_type: 'no_match' });
  }
}

let finalResults;
if (menciones.length >= 2) {
  finalResults = menciones;
} else if (menciones.length === 1) {
  const govIndir = sinMencion.filter(r => r._match_type === 'gov_indirect').slice(0, 3);
  finalResults = [...menciones, ...govIndir];
} else if (fromGov && sinMencion.length > 0) {
  finalResults = sinMencion.slice(0, 5);
} else {
  finalResults = organic.slice(0, 8).map(r => ({
    title: String(r.title || ''), link: String(r.link || ''),
    snippet: String(r.snippet || ''), source: String(r.source || ''),
    score: Number(r.score || 0), _stage: String(r._stage || ''),
    _domain_priority: Number(r._domain_priority || 0), _match_type: 'fallback'
  }));
}

// Retorno EXPLÍCITO — sin spread de item para evitar claves 'json' anidadas
return {
  json: {
    empresa: empresa,
    pais: String(item.pais || ''),
    linea_negocio: String(item.linea_negocio || ''),
    tier: String(item.tier || ''),
    company_domain: String(item.company_domain || ''),
    score_calificacion: Number(item.score_calificacion || 0),
    paises: Array.isArray(item.paises) ? item.paises.map(String) : [],
    _linea: String(item._linea || ''),
    _sub_linea: String(item._sub_linea || ''),
    tavily_query: String(item.tavily_query || ''),
    tavily_answer: String(item.tavily_answer || item.answer || ''),
    organic: finalResults,
    _menciones: menciones.length,
    _total: organic.length,
    _fallback: menciones.length === 0,
    _from_gov: fromGov
  }
};`;

async function main() {
  const dry = process.argv.includes('--dry');
  console.log('Fetching WF02...');
  const wf = await api('/workflows/' + WF02_ID);
  console.log('Nodes:', wf.nodes.length);

  let fixes = 0;

  for (const node of wf.nodes) {
    // Fix 1: Determinar Sub-Línea — garbled diacritic regex
    if (node.name === 'Determinar Sub-Línea') {
      const pk = node.parameters.jsCode !== undefined ? 'jsCode' : 'functionCode';
      const oldCode = node.parameters[pk];
      const newCode = oldCode.replace(
        /function norm\(s\) \{[\s\S]*?\}/,
        "function norm(s) {\n  return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\n}"
      );
      if (newCode !== oldCode) {
        node.parameters[pk] = newCode;
        console.log('✅ Fix 1: Determinar Sub-Línea regex corrected');
        fixes++;
      }
    }

    // Fix 2: Buscar Tavily General1 — add onError
    if (node.name === 'Buscar Tavily General1' && !node.onError) {
      node.onError = 'continueRegularOutput';
      console.log('✅ Fix 2: Buscar Tavily General1 onError added');
      fixes++;
    }

    // Fix 3: Filtro Menciones Empresa — full rewrite v6
    if (node.name === 'Filtro Menciones Empresa') {
      node.parameters.jsCode = FILTRO_MENCIONES_V6;
      node.onError = 'continueRegularOutput';
      console.log('✅ Fix 3: Filtro Menciones Empresa rewritten v6');
      fixes++;
    }

    // Fix 4: Parse RADAR1 Output — replace .first() with .item
    if (node.name === 'Parse RADAR1 Output') {
      const pk = node.parameters.jsCode !== undefined ? 'jsCode' : 'functionCode';
      const oldCode = node.parameters[pk] || '';
      const newCode = oldCode.replace(/\$input\.first\(\)/g, '$input.item');
      if (newCode !== oldCode) {
        node.parameters[pk] = newCode;
        node.onError = 'continueRegularOutput';
        console.log('✅ Fix 4: Parse RADAR1 Output .first() → .item');
        fixes++;
      }
    }
  }

  console.log(`\n${fixes} fix(es) applied${dry ? ' (DRY RUN — not saved)' : ''}`);
  if (dry || fixes === 0) return;

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  const result = await api('/workflows/' + WF02_ID, 'PUT', payload);
  if (result.id) {
    console.log('✅ WF02 updated in production. Nodes:', result.nodes.length);
  } else {
    console.error('❌ PUT failed:', JSON.stringify(result).substring(0, 300));
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
