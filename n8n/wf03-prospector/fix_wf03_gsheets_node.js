const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'n8n.event2flow.com', path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Columns from Code: Expand to Rows output
// Using defineBelow to avoid autoMap schema fetch issue
const GSHEETS_COLUMNS = [
  { id: 'EMPRESA', displayName: 'EMPRESA', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string' },
  { id: 'PAIS', displayName: 'PAIS', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'LINEA_NEGOCIO', displayName: 'LINEA_NEGOCIO', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'TIER', displayName: 'TIER', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'SCORE_CAL', displayName: 'SCORE_CAL', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'SCORE_RADAR', displayName: 'SCORE_RADAR', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'COMPOSITE', displayName: 'COMPOSITE', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'NOMBRE_CONTACTO', displayName: 'NOMBRE_CONTACTO', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'TITULO', displayName: 'TITULO', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'EMPRESA_CONTACTO', displayName: 'EMPRESA_CONTACTO', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'EMAIL', displayName: 'EMAIL', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'LINKEDIN', displayName: 'LINKEDIN', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'SENIORITY', displayName: 'SENIORITY', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'APOLLO_ID', displayName: 'APOLLO_ID', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'STATUS', displayName: 'STATUS', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
  { id: 'FECHA_PROSPECCION', displayName: 'FECHA_PROSPECCION', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string' },
];

async function main() {
  const res = await api('GET', '/api/v1/workflows/RLUDpi3O5Rb6WEYJ');
  const wf = JSON.parse(res.body);

  const logNode = wf.nodes.find(n => n.name === 'Log Prospeccion GSheets');
  if (!logNode) { console.log('Node not found'); return; }

  // Update to defineBelow with explicit schema
  logNode.parameters = {
    resource: 'sheet',
    operation: 'append',
    documentId: {
      __rl: true,
      value: '1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo',
      mode: 'id',
    },
    sheetName: {
      __rl: true,
      value: 'Prospection_Log',
      mode: 'name',
    },
    columns: {
      mappingMode: 'autoMapInputData',
      value: {},
      matchingColumns: [],
      schema: GSHEETS_COLUMNS,
    },
    options: {},
  };

  const putRes = await api('PUT', '/api/v1/workflows/RLUDpi3O5Rb6WEYJ', {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {}
  });
  console.log('PUT status:', putRes.status);
  if (putRes.status !== 200) {
    console.error('ERROR:', putRes.body.substring(0, 300));
  } else {
    console.log('WF03 Log Prospeccion GSheets fixed — schema defined explicitly, autoMapInputData mode');
  }
}
main().catch(e => console.error('FATAL:', e));
