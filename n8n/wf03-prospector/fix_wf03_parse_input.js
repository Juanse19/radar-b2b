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

// Fixed code: handles both WF02 format (COMPANY NAME, LÍNEA DE NEGOCIO)
// and WF01/manual format (empresa, linea_negocio)
const NEW_PARSE_CODE = [
  '// WF03 Prospector - Parse webhook input',
  '// Handles two formats:',
  '//   WF01/manual: { empresa, pais, linea_negocio, tier }',
  '//   WF02 format: { COMPANY NAME, PAÍS, LÍNEA DE NEGOCIO, TIER, score_calificacion, ... }',
  'const raw = $input.all()[0].json;',
  'const body = raw.body || raw;',
  '',
  'let empresas = [];',
  'if (body.empresas && Array.isArray(body.empresas)) {',
  '  empresas = body.empresas;',
  '} else if (body.empresa || body["COMPANY NAME"]) {',
  '  empresas = [body];',
  '}',
  'if (!empresas.length) {',
  '  throw new Error("WF03: No empresas found. Expected { empresa, tier, linea_negocio }");',
  '}',
  '',
  'return empresas.map(e => {',
  '  const tier = (e.tier_calculado || e.tier || e["TIER"] || "MONITOREO").toUpperCase();',
  '  const maxContacts = tier === "ORO" ? 5 : tier === "MONITOREO" ? 2 : 0;',
  '  if (maxContacts === 0) return null;',
  '  return { json: {',
  '    empresa:            e.empresa || e.company_name || e["COMPANY NAME"] || "",',
  '    pais:               e.pais || e["PAÍS"] || "Colombia",',
  '    linea_negocio:      e.linea_negocio || e["LÍNEA DE NEGOCIO"] || e["LINEA DE NEGOCIO"] || "",',
  '    tier:               tier,',
  '    company_domain:     e.company_domain || e["DOMINIO"] || "",',
  '    score_calificacion: e.score_calificacion || e["SCORE_CAL"] || 0,',
  '    score_radar:        e.score_radar || e["SCORE_RADAR"] || 0,',
  '    composite_score:    e.composite_score || e["COMPOSITE"] || 0,',
  '    max_contacts:       maxContacts,',
  '    fecha_prospeccion:  new Date().toISOString().split("T")[0],',
  '  }};',
  '}).filter(Boolean);',
].join('\n');

async function main() {
  const res = await api('GET', '/api/v1/workflows/RLUDpi3O5Rb6WEYJ');
  const wf = JSON.parse(res.body);

  const parseNode = wf.nodes.find(n => n.name === 'Code: Parse Input');
  if (!parseNode) { console.log('Node not found'); return; }

  parseNode.parameters.jsCode = NEW_PARSE_CODE;

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
    console.log('WF03 Code:Parse Input fixed — handles COMPANY NAME + LÍNEA DE NEGOCIO from WF02');
  }
}
main().catch(e => console.error('FATAL:', e));
