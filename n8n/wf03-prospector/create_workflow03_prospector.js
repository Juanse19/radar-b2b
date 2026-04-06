const https = require('https');
const crypto = require('crypto');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const APOLLO_API_KEY = '3mm4e6elHMoCRqcbQnqtyw';
const GSHEETS_CRED_ID = 'Yv0pMNMe4juimTet';
const PROSPECTION_SHEET_ID = '1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo';

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'n8n.event2flow.com', path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const PARSE_INPUT_CODE = [
  "// WF03 Prospector - Parse webhook input",
  "const raw = $input.all()[0].json;",
  "const body = raw.body || raw;",
  "let empresas = [];",
  "if (body.empresas && Array.isArray(body.empresas)) {",
  "  empresas = body.empresas;",
  "} else if (body.empresa) {",
  "  empresas = [body];",
  "}",
  "if (!empresas.length) {",
  "  throw new Error('WF03: No empresas found. Expected { empresa, tier, linea_negocio }');",
  "}",
  "return empresas.map(e => {",
  "  const tier = (e.tier_calculado || e.tier || 'MONITOREO').toUpperCase();",
  "  const maxContacts = tier === 'ORO' ? 5 : tier === 'MONITOREO' ? 2 : 0;",
  "  if (maxContacts === 0) return null;",
  "  return { json: {",
  "    empresa:            e.empresa || e.company_name || '',",
  "    pais:               e.pais || 'Colombia',",
  "    linea_negocio:      e.linea_negocio || '',",
  "    tier:               tier,",
  "    company_domain:     e.company_domain || '',",
  "    score_calificacion: e.score_calificacion || 0,",
  "    score_radar:        e.score_radar || 0,",
  "    composite_score:    e.composite_score || 0,",
  "    max_contacts:       maxContacts,",
  "    fecha_prospeccion:  new Date().toISOString().split('T')[0],",
  "  }};",
  "}).filter(Boolean);"
].join("\n");

const BUILD_QUERY_CODE = [
  "const e = $input.all()[0].json;",
  "const linea = (e.linea_negocio || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');",
  "const TITLES = {",
  "  bhs: ['Director de Operaciones Aeroportuarias','Airport Operations Director','VP Terminal',",
  "        'Gerente de Infraestructura Aeroportuaria','Director de Ingenieria Aeroportuaria',",
  "        'Chief Operations Officer','Gerente General','Director de Proyectos'],",
  "  carton: ['Director de Planta','Gerente de Produccion','VP Manufacturing',",
  "           'Director de Manufactura','Gerente de Operaciones','Plant Manager','Director Industrial'],",
  "  intra: ['Director de Logistica','Gerente Supply Chain','Director CEDI',",
  "          'VP Operations','Gerente de Almacen','Logistics Director','Supply Chain Director'],",
  "};",
  "let titles = TITLES.intra;",
  "if (linea.includes('bhs') || linea.includes('aeropuerto')) titles = TITLES.bhs;",
  "else if (linea.includes('cart') || linea.includes('corrugado')) titles = TITLES.carton;",
  "const searchBody = {",
  "  page: 1, per_page: 25,",
  "  q_organization_name: e.empresa,",
  "  person_seniorities: ['c_suite','vp','director','manager'],",
  "  person_titles: titles,",
  "};",
  "if (e.company_domain) searchBody.q_organization_domains_list = [e.company_domain];",
  "return [{ json: { ...e, apollo_search_body: searchBody } }];"
].join("\n");

const MERGE_RESPONSE_CODE = [
  "const apolloResp = $input.all()[0].json;",
  "const ctx = $('Code: Build Apollo Query').first().json;",
  "return [{ json: { ...ctx, apollo_response: apolloResp } }];"
].join("\n");

const FILTER_FORMAT_CODE = [
  "const ctx = $input.all()[0].json;",
  "const resp = ctx.apollo_response || {};",
  "const raw = resp.people || resp.contacts || resp.results || resp.data || [];",
  "const maxContacts = ctx.max_contacts || 2;",
  "const seniorityScore = { c_suite: 4, vp: 3, director: 2, manager: 1 };",
  "const scored = raw.map(p => ({",
  "  ...p,",
  "  _score: (p.email || p.has_email ? 3 : 0) + (seniorityScore[(p.seniority||'').toLowerCase()] || 0)",
  "})).sort((a, b) => b._score - a._score);",
  "const selected = scored.slice(0, maxContacts);",
  "if (!selected.length) {",
  "  return [{ json: { ...ctx, contacts_found: 0, contacts: [], prospection_status: 'NO_CONTACTS_FOUND' } }];",
  "}",
  "const contacts = selected.map(p => ({",
  "  nombre:    (p.first_name||'') + ' ' + (p.last_name || p.last_name_obfuscated || '***'),",
  "  titulo:    p.title || p.headline || '',",
  "  empresa:   p.organization ? p.organization.name : ctx.empresa,",
  "  email:     p.email || p.work_email || (p.has_email ? '- disponible en Apollo' : ''),",
  "  linkedin:  p.linkedin_url || '',",
  "  seniority: p.seniority || '',",
  "  apollo_id: p.id || '',",
  "  has_email: !!(p.email || p.has_email),",
  "}));",
  "return [{ json: { ...ctx, contacts_found: contacts.length, contacts, prospection_status: 'CONTACTS_FOUND' } }];"
].join("\n");

const EXPAND_ROWS_CODE = [
  "const data = $input.all()[0].json;",
  "const contacts = data.contacts || [];",
  "if (!contacts.length) {",
  "  return [{ json: {",
  "    EMPRESA: data.empresa, PAIS: data.pais, LINEA_NEGOCIO: data.linea_negocio,",
  "    TIER: data.tier, SCORE_CAL: data.score_calificacion, SCORE_RADAR: data.score_radar,",
  "    COMPOSITE: data.composite_score, NOMBRE_CONTACTO: '', TITULO: '',",
  "    EMPRESA_CONTACTO: '', EMAIL: '', LINKEDIN: '', SENIORITY: '', APOLLO_ID: '',",
  "    STATUS: 'SIN_CONTACTOS', FECHA: data.fecha_prospeccion,",
  "  }}];",
  "}",
  "return contacts.map(c => ({ json: {",
  "  EMPRESA: data.empresa, PAIS: data.pais, LINEA_NEGOCIO: data.linea_negocio,",
  "  TIER: data.tier, SCORE_CAL: data.score_calificacion, SCORE_RADAR: data.score_radar,",
  "  COMPOSITE: data.composite_score,",
  "  NOMBRE_CONTACTO: c.nombre, TITULO: c.titulo, EMPRESA_CONTACTO: c.empresa,",
  "  EMAIL: c.email, LINKEDIN: c.linkedin, SENIORITY: c.seniority, APOLLO_ID: c.apollo_id,",
  "  STATUS: c.has_email ? 'CON_EMAIL' : 'SIN_EMAIL', FECHA: data.fecha_prospeccion,",
  "}}));"
].join("\n");

const WEBHOOK_ID = crypto.randomUUID();
const nodeIds = Array.from({ length: 11 }, () => crypto.randomUUID());

const workflow = {
  name: 'Agent 03 - Prospector v1.0',
  nodes: [
    {
      id: nodeIds[0], name: 'Webhook Prospector',
      type: 'n8n-nodes-base.webhook', typeVersion: 2.1,
      position: [120, 300], webhookId: WEBHOOK_ID,
      parameters: { httpMethod: 'POST', path: 'prospector', responseMode: 'responseNode', options: {} }
    },
    {
      id: nodeIds[1], name: 'Respond 200',
      type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1,
      position: [340, 500],
      parameters: {
        respondWith: 'json',
        responseBody: '{"message":"Prospector started"}',
        options: {}
      }
    },
    {
      id: nodeIds[2], name: 'Code: Parse Input',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [560, 300],
      parameters: { jsCode: PARSE_INPUT_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: nodeIds[3], name: 'Loop Over Items1',
      type: 'n8n-nodes-base.splitInBatches', typeVersion: 3,
      position: [780, 300],
      parameters: { options: {} }
    },
    {
      id: nodeIds[4], name: 'Code: Build Apollo Query',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [1000, 300],
      parameters: { jsCode: BUILD_QUERY_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: nodeIds[5], name: 'HTTP: Apollo People Search',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [1220, 300],
      parameters: {
        method: 'POST',
        url: 'https://api.apollo.io/api/v1/mixed_people/api_search',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'x-api-key', value: APOLLO_API_KEY },
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Accept', value: 'application/json' }
          ]
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.apollo_search_body) }}',
        options: { response: { response: { neverError: true } } }
      }
    },
    {
      id: nodeIds[6], name: 'Code: Merge Apollo Response',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [1440, 300],
      parameters: { jsCode: MERGE_RESPONSE_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: nodeIds[7], name: 'Code: Filter & Format',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [1660, 300],
      parameters: { jsCode: FILTER_FORMAT_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: nodeIds[8], name: 'Code: Expand to Rows',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [1880, 300],
      parameters: { jsCode: EXPAND_ROWS_CODE, mode: 'runOnceForAllItems' }
    },
    {
      id: nodeIds[9], name: 'Log Prospeccion GSheets',
      type: 'n8n-nodes-base.googleSheets', typeVersion: 4.4,
      position: [2100, 300],
      credentials: { googleSheetsOAuth2Api: { id: GSHEETS_CRED_ID, name: 'Google Sheets account 3' } },
      parameters: {
        resource: 'sheet',
        operation: 'append',
        documentId: { __rl: true, value: PROSPECTION_SHEET_ID, mode: 'id' },
        sheetName: { __rl: true, value: 'Prospection_Log', mode: 'name' },
        dataMode: 'autoMap',
        options: {}
      }
    },
    {
      id: nodeIds[10], name: 'Wait Between Companies',
      type: 'n8n-nodes-base.wait', typeVersion: 1.1,
      position: [2320, 300],
      parameters: { unit: 'seconds', amount: 2 }
    }
  ],
  connections: {
    'Webhook Prospector': {
      main: [[
        { node: 'Respond 200', type: 'main', index: 0 },
        { node: 'Code: Parse Input', type: 'main', index: 0 }
      ]]
    },
    'Code: Parse Input': {
      main: [[{ node: 'Loop Over Items1', type: 'main', index: 0 }]]
    },
    'Loop Over Items1': {
      main: [
        [],
        [{ node: 'Code: Build Apollo Query', type: 'main', index: 0 }]
      ]
    },
    'Code: Build Apollo Query': {
      main: [[{ node: 'HTTP: Apollo People Search', type: 'main', index: 0 }]]
    },
    'HTTP: Apollo People Search': {
      main: [[{ node: 'Code: Merge Apollo Response', type: 'main', index: 0 }]]
    },
    'Code: Merge Apollo Response': {
      main: [[{ node: 'Code: Filter & Format', type: 'main', index: 0 }]]
    },
    'Code: Filter & Format': {
      main: [[{ node: 'Code: Expand to Rows', type: 'main', index: 0 }]]
    },
    'Code: Expand to Rows': {
      main: [[{ node: 'Log Prospeccion GSheets', type: 'main', index: 0 }]]
    },
    'Log Prospeccion GSheets': {
      main: [[{ node: 'Wait Between Companies', type: 'main', index: 0 }]]
    },
    'Wait Between Companies': {
      main: [[{ node: 'Loop Over Items1', type: 'main', index: 0 }]]
    }
  },
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    callerPolicy: 'workflowsFromSameOwner'
  }
};

async function main() {
  console.log('Creating WF03 - Prospector v1.0...');
  const res = await api('POST', '/api/v1/workflows', workflow);
  console.log('POST status:', res.status);

  if (res.status !== 200) {
    console.error('ERROR:', res.body.substring(0, 800));
    return;
  }

  const created = JSON.parse(res.body);
  console.log('WF03 created! ID:', created.id);
  console.log('Name:', created.name);
  console.log('Nodes:', created.nodes?.length);

  const actRes = await api('POST', '/api/v1/workflows/' + created.id + '/activate');
  console.log('Activate status:', actRes.status);
  const activated = JSON.parse(actRes.body);
  console.log('Active:', activated.active);
  console.log('\nWF03 Webhook: https://n8n.event2flow.com/webhook/prospector');
  console.log('WF03 ID:', created.id);
}

main().catch(e => console.error('FATAL:', e));
