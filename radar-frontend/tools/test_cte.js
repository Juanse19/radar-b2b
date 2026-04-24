/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
require('dotenv').config({ path: '.env.local' });
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(sql) {
  return new Promise(resolve => {
    const body = JSON.stringify({ query: sql });
    const u = new URL(url + '/pg/query');
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { apikey: key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ ok: res.statusCode < 300, status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ ok: false, raw: d.slice(0,300) }); } });
    });
    req.on('error', e => resolve({ ok: false, err: e.message }));
    req.write(body); req.end();
  });
}

const esc = v => v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";

async function main() {
  // Test CTE approach (no DO blocks, handles partial unique index)
  const empresa = 'TEST EMPRESA CTE';
  const cteSql = [
    'WITH emp_upsert AS (',
    '  INSERT INTO matec_radar.empresas (company_name, company_domain, pais_nombre)',
    "  VALUES ('TEST EMPRESA CTE', 'test.com', 'Colombia')",
    '  ON CONFLICT (company_name_norm) WHERE owner_id IS NULL',
    '  DO UPDATE SET',
    '    company_domain = COALESCE(EXCLUDED.company_domain, matec_radar.empresas.company_domain),',
    '    updated_at = NOW()',
    '  RETURNING id',
    '),',
    'cal_insert AS (',
    '  INSERT INTO matec_radar.calificaciones',
    '    (empresa_id, score_total, tier_calculado, prompt_version, modelo_llm)',
    "  SELECT id, 8.5, 'A'::matec_radar.tier_enum, 'wf01-test', 'gpt-4.1-mini'",
    '  FROM emp_upsert',
    '  RETURNING id',
    ')',
    "SELECT 'ok' AS result"
  ].join('\n');

  console.log('SQL preview:', cteSql.slice(0, 200));
  const r = await query(cteSql);
  console.log('CTE result:', r.ok ? 'OK' : 'FAIL', r.status, JSON.stringify(r.data).slice(0, 300));

  if (r.ok) {
    const v = await query("SELECT e.company_name, c.score_total FROM matec_radar.empresas e JOIN matec_radar.calificaciones c ON c.empresa_id = e.id WHERE e.company_name = 'TEST EMPRESA CTE'");
    console.log('Verified:', JSON.stringify(v.data));

    // Also test radar_scan CTE
    const radarSql = [
      'WITH emp AS (',
      "  SELECT id FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE' LIMIT 1",
      ')',
      'INSERT INTO matec_radar.radar_scans',
      '  (empresa_id, score_radar, radar_activo, ventana_compra, prompt_version)',
      "SELECT id, 75, TRUE, 'desconocida'::matec_radar.ventana_compra_enum, 'wf02-test'",
      'FROM emp',
      'RETURNING id'
    ].join('\n');
    const r2 = await query(radarSql);
    console.log('Radar scan CTE:', r2.ok ? 'OK' : 'FAIL', JSON.stringify(r2.data).slice(0,200));

    // Also test contactos CTE
    const contactoSql = [
      'WITH emp AS (',
      "  SELECT id FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE' LIMIT 1",
      ')',
      'INSERT INTO matec_radar.contactos',
      "  (empresa_id, first_name, last_name, title, email, hubspot_status)",
      "SELECT id, 'Juan', 'Perez', 'CEO', 'juan@test.com', 'pendiente'::matec_radar.hubspot_status_enum",
      'FROM emp',
      'RETURNING id'
    ].join('\n');
    const r3 = await query(contactoSql);
    console.log('Contacto CTE:', r3.ok ? 'OK' : 'FAIL', JSON.stringify(r3.data).slice(0,200));

    // Cleanup
    await query("DELETE FROM matec_radar.contactos WHERE empresa_id = (SELECT id FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE')");
    await query("DELETE FROM matec_radar.radar_scans WHERE empresa_id = (SELECT id FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE')");
    await query("DELETE FROM matec_radar.calificaciones WHERE empresa_id = (SELECT id FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE')");
    await query("DELETE FROM matec_radar.empresas WHERE company_name = 'TEST EMPRESA CTE'");
    console.log('All cleanup done');
  }
}

main().catch(console.error);
