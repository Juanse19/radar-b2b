import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function q(sql: string): Promise<unknown> {
  const r = await fetch(`${url}/pg/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
(async () => {
  console.log('=== Empresas con "bimbo" en el nombre ===');
  const bimbos = await q(`
    SELECT e.id, e.company_name, e.company_domain, e.pais::TEXT AS pais, e.tier_actual::TEXT AS tier
    FROM matec_radar.empresas e
    WHERE LOWER(e.company_name) LIKE '%bimbo%'
    ORDER BY e.company_name
  `);
  console.log(JSON.stringify(bimbos, null, 2));

  console.log('\n=== Sub-líneas asociadas a Bimbo ===');
  const links = await q(`
    SELECT e.company_name, sln.codigo AS sub_linea
    FROM matec_radar.empresas e
    LEFT JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
    LEFT JOIN matec_radar.sub_lineas_negocio sln ON sln.id = esl.sub_linea_id
    WHERE LOWER(e.company_name) LIKE '%bimbo%'
    ORDER BY e.company_name
  `);
  console.log(JSON.stringify(links, null, 2));

  console.log('\n=== Total empresas SIN sub-línea (no aparecerán en wizard) ===');
  const orphan = await q(`
    SELECT COUNT(*) AS sin_sublinea
    FROM matec_radar.empresas e
    WHERE NOT EXISTS (SELECT 1 FROM matec_radar.empresa_sub_lineas esl WHERE esl.empresa_id = e.id)
  `);
  console.log(JSON.stringify(orphan));

  console.log('\n=== Total empresas CON sub-línea (visibles en wizard) ===');
  const conSub = await q(`
    SELECT COUNT(DISTINCT e.id) AS con_sublinea
    FROM matec_radar.empresas e
    JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
  `);
  console.log(JSON.stringify(conSub));
})().catch(e => { console.error(e); process.exit(1); });
