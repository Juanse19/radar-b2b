const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const EXCEL_CRED_ID = 'aXCgjM196D6Oj5tf';

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

// Correct config for each file - using typeVersion 2.2 and resource:'worksheet' as in working WF02 nodes
const EXCEL_CORRECT_CONFIG = [
  {
    name: 'Upsert Cal. BHS',
    wb: '01CHRD7MI2LRIRYZAIK5G2QTYYNYTPOU5G',
    wbName: 'BASE DE DATOS AEROPUERTOS FINAL',
    ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}',
    wsName: 'Base de Datos',
  },
  {
    name: 'Upsert Cal. Carton',
    wb: '01CHRD7MJBC4AES3EUS5GIKVOV7JIGSXYF',
    wbName: 'BASE DE DATOS CARTON Y PAPEL',
    ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}',
    wsName: 'Base de Datos',
  },
  {
    name: 'Upsert Cal. Intralogist',
    wb: '01CHRD7MI2LRIRYZAIK5G2QTYYNYTPOU5G',
    wbName: 'BASE DE DATOS AEROPUERTOS FINAL',
    ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}',
    wsName: 'Base de Datos',
  },
  {
    name: 'Upsert Cal. Cargo',
    wb: '01CHRD7MM4HC4J3FOXRZDKDAVXCWR4A34F',
    wbName: 'BASE DE DATOS CARGO LATAM',
    ws: '{00000000-0001-0000-0000-000000000000}',
    wsName: 'CRM_Cargo_ULD_LATAM',
  },
  {
    name: 'Upsert Cal. Motos',
    wb: '01CHRD7MK7PMC7YDFXTFBLUSEEFQNP7WJM',
    wbName: 'BASE DE DATOS ENSAMBLADORAS MOTOS LATAM',
    ws: '{00000000-0001-0000-0000-000000000000}',
    wsName: 'CRM_Motos_LATAM',
  },
  {
    name: 'Upsert Cal. Final Linea',
    wb: '01CHRD7MNJNKKN2JPSDZEYRS5VPXA6TZNN',
    wbName: 'BASE DE DATOS FINAL DE LINEA',
    ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}',
    wsName: 'Base de Datos',
  },
];

async function main() {
  const wf01Res = await api('GET', '/api/v1/workflows/jDtdafuyYt8TXISl');
  const wf01 = JSON.parse(wf01Res.body);

  let fixed = 0;
  wf01.nodes.forEach(node => {
    const cfg = EXCEL_CORRECT_CONFIG.find(c => c.name === node.name);
    if (!cfg) return;

    // Apply correct typeVersion and parameters
    node.typeVersion = 2.2;
    node.type = 'n8n-nodes-base.microsoftExcel';
    node.credentials = { microsoftExcelOAuth2Api: { id: EXCEL_CRED_ID, name: 'Microsoft Excel account 2' } };
    node.parameters = {
      resource: 'worksheet',
      operation: 'upsert',
      workbook: {
        __rl: true,
        value: cfg.wb,
        mode: 'list',
        cachedResultName: cfg.wbName,
      },
      worksheet: {
        __rl: true,
        value: cfg.ws,
        mode: 'list',
        cachedResultName: cfg.wsName,
      },
      dataMode: 'autoMap',
      columnToMatchOn: 'COMPANY NAME',
      options: { updateAll: false }
    };
    fixed++;
    console.log('Fixed:', node.name);
  });

  console.log('Total fixed:', fixed, 'Excel nodes');

  const putRes = await api('PUT', '/api/v1/workflows/jDtdafuyYt8TXISl', {
    name: wf01.name,
    nodes: wf01.nodes,
    connections: wf01.connections,
    settings: wf01.settings || {}
  });
  console.log('PUT status:', putRes.status);
  if (putRes.status !== 200) {
    console.error('ERROR:', putRes.body.substring(0, 400));
  } else {
    console.log('WF01 Excel nodes fixed — typeVersion 2.2, resource: worksheet, dataMode: autoMap');
  }
}
main().catch(e => console.error('FATAL:', e));
