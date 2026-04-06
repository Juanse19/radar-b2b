const https = require('https');
const crypto = require('crypto');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const EXCEL_CRED_ID = 'aXCgjM196D6Oj5tf';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'n8n.event2flow.com', path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
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

// SharePoint Excel files: one per business line
const EXCEL_FILES = [
  { key: 'BHS',         name: 'Upsert Cal. BHS',         wb: '01CHRD7MI2LRIRYZAIK5G2QTYYNYTPOU5G', ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}' },
  { key: 'CARTON',      name: 'Upsert Cal. Carton',       wb: '01CHRD7MJBC4AES3EUS5GIKVOV7JIGSXYF', ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}' },
  { key: 'INTRA',       name: 'Upsert Cal. Intralogist',  wb: '01CHRD7MI2LRIRYZAIK5G2QTYYNYTPOU5G', ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}' },
  { key: 'CARGO',       name: 'Upsert Cal. Cargo',        wb: '01CHRD7MM4HC4J3FOXRZDKDAVXCWR4A34F', ws: '{00000000-0001-0000-0000-000000000000}' },
  { key: 'MOTOS',       name: 'Upsert Cal. Motos',        wb: '01CHRD7MK7PMC7YDFXTFBLUSEEFQNP7WJM', ws: '{00000000-0001-0000-0000-000000000000}' },
  { key: 'FINAL_LINEA', name: 'Upsert Cal. Final Linea',  wb: '01CHRD7MNJNKKN2JPSDZEYRS5VPXA6TZNN', ws: '{A218B808-FA24-4FB7-ABDC-842095DDD631}' },
];

function makeExcelNode(cfg, x, y) {
  return {
    id: crypto.randomUUID(),
    name: cfg.name,
    type: 'n8n-nodes-base.microsoftExcel',
    typeVersion: 2,
    position: [x, y],
    credentials: { microsoftExcelOAuth2Api: { id: EXCEL_CRED_ID, name: 'Microsoft Excel account 2' } },
    parameters: {
      resource: 'table',
      operation: 'upsert',
      workbook: { __rl: true, value: cfg.wb, mode: 'list' },
      worksheet: { __rl: true, value: cfg.ws, mode: 'list' },
      columns: { mappingMode: 'autoMapInputData', matchingColumns: ['COMPANY NAME'], options: {} },
      options: { continueOnFail: true }
    }
  };
}

// Code node to normalize linea and prepare Excel row
const NORMALIZE_LINEA_CODE = [
  "const item = $input.all()[0].json;",
  "const linea = (item.linea_negocio || '').toLowerCase()",
  "  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');",
  "let linea_key = 'FINAL_LINEA';",
  "if (linea.includes('bhs') || linea.includes('aeropuerto') || linea.includes('terminal')) linea_key = 'BHS';",
  "else if (linea.includes('cart') || linea.includes('papel') || linea.includes('corrugado')) linea_key = 'CARTON';",
  "else if (linea.includes('intra') || linea.includes('logist') || linea.includes('cedi') || linea.includes('supply')) linea_key = 'INTRA';",
  "else if (linea.includes('cargo') || linea.includes('uld')) linea_key = 'CARGO';",
  "else if (linea.includes('moto')) linea_key = 'MOTOS';",
  "return [{ json: {",
  "  ...item,",
  "  _linea_key: linea_key,",
  "  'COMPANY NAME':         item.empresa,",
  "  'PAIS':                 item.pais,",
  "  'LINEA DE NEGOCIO':     item.linea_negocio,",
  "  'SCORE_CAL':            item.score_calificacion,",
  "  'TIER_CAL':             item.tier_calculado,",
  "  'IMPACTO PRESUPUESTO':  item['IMPACTO EN EL PRESUPUESTO'] || '',",
  "  'MULTIPLANTA':          item['MULTIPLANTA'] || '',",
  "  'RECURRENCIA':          item['RECURRENCIA'] || '',",
  "  'REFERENTE MERCADO':    item['REFERENTE DEL MERCADO'] || '',",
  "  'ANIO OBJETIVO':        item['ANIO OBJETIVO'] || '',",
  "  'TICKET ESTIMADO':      item['TICKET ESTIMADO'] || '',",
  "  'PRIORIDAD COMERCIAL':  item['PRIORIDAD COMERCIAL'] || '',",
  "  'FECHA_CAL':            item.fecha_calificacion || new Date().toISOString().split('T')[0],",
  "} }];"
].join('\n');

async function main() {
  const wf01Res = await api('GET', '/api/v1/workflows/jDtdafuyYt8TXISl');
  const wf01 = JSON.parse(wf01Res.body);

  // Add: Code: Prepare Excel Row (normalizes linea + maps columns)
  const prepareId = crypto.randomUUID();
  const prepareNode = {
    id: prepareId,
    name: 'Code: Prepare Excel Row',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1200, 300],
    parameters: { jsCode: NORMALIZE_LINEA_CODE, mode: 'runOnceForAllItems' }
  };

  // Add Switch node
  const switchId = crypto.randomUUID();
  const switchNode = {
    id: switchId,
    name: 'Switch Linea Cal.',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3,
    position: [1420, 300],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { conditions: { options: { version: 3, caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: crypto.randomUUID(), leftValue: '={{ $json._linea_key }}', rightValue: 'BHS', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'BHS' },
          { conditions: { options: { version: 3, caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: crypto.randomUUID(), leftValue: '={{ $json._linea_key }}', rightValue: 'CARTON', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'CARTON' },
          { conditions: { options: { version: 3, caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: crypto.randomUUID(), leftValue: '={{ $json._linea_key }}', rightValue: 'INTRA', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'INTRA' },
          { conditions: { options: { version: 3, caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: crypto.randomUUID(), leftValue: '={{ $json._linea_key }}', rightValue: 'CARGO', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'CARGO' },
          { conditions: { options: { version: 3, caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: crypto.randomUUID(), leftValue: '={{ $json._linea_key }}', rightValue: 'MOTOS', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'MOTOS' },
        ]
      },
      fallbackOutput: 'extra',
      options: { continueOnFail: true }
    }
  };

  // 6 Excel nodes + Merge
  const excels = EXCEL_FILES.map((cfg, i) => makeExcelNode(cfg, 1640, i * 140));
  const mergeId = crypto.randomUUID();
  const mergeNode = {
    id: mergeId,
    name: 'Merge Cal. Results',
    type: 'n8n-nodes-base.merge',
    typeVersion: 3,
    position: [1860, 300],
    parameters: { mode: 'combine', combinationMode: 'mergeByPosition', options: { includeUnpaired: true } }
  };

  // Add all new nodes to WF01
  wf01.nodes.push(prepareNode, switchNode, ...excels, mergeNode);

  // Rewire:
  // Code: Calcular Score + Tier -> Code: Prepare Excel Row (was -> Log Calificacion)
  wf01.connections['Code: Calcular Score + Tier'] = {
    main: [[{ node: 'Code: Prepare Excel Row', type: 'main', index: 0 }]]
  };

  // Code: Prepare Excel Row -> Switch
  wf01.connections['Code: Prepare Excel Row'] = {
    main: [[{ node: 'Switch Linea Cal.', type: 'main', index: 0 }]]
  };

  // Switch -> 6 excels (output 0..4 + fallback output 5)
  const switchOutputs = excels.map(e => [{ node: e.name, type: 'main', index: 0 }]);
  wf01.connections['Switch Linea Cal.'] = { main: switchOutputs };

  // Each Excel -> Merge (each uses a different input index to Merge)
  excels.forEach((e, i) => {
    wf01.connections[e.name] = { main: [[{ node: 'Merge Cal. Results', type: 'main', index: i }]] };
  });

  // Merge -> Log Calificacion (disabled) -> IF: Score >= 5 (existing chain)
  wf01.connections['Merge Cal. Results'] = {
    main: [[{ node: 'Log Calificacion', type: 'main', index: 0 }]]
  };

  console.log('WF01 total nodes:', wf01.nodes.length);
  console.log('New connections added: Code:Prepare, Switch, 6x Excel, Merge');

  const putRes = await api('PUT', '/api/v1/workflows/jDtdafuyYt8TXISl', {
    name: wf01.name,
    nodes: wf01.nodes,
    connections: wf01.connections,
    settings: wf01.settings || {}
  });
  console.log('PUT status:', putRes.status);
  if (putRes.status !== 200) {
    console.error('ERROR:', putRes.body.substring(0, 500));
  } else {
    console.log('WF01 updated with SharePoint writes for all 6 lineas');
  }
}
main().catch(e => console.error('FATAL:', e));
