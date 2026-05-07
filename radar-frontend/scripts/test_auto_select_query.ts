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
  const subs = await q(`SELECT id, codigo, nombre FROM matec_radar.sub_lineas_negocio ORDER BY id`);
  console.log('Sub-lineas:', subs);

  const ids = (subs as Array<{ id: number }>).map(r => r.id).join(',');
  if (!ids) return console.log('No sub-lineas in DB');

  const result = await q(`
    SELECT *
    FROM (
      SELECT DISTINCT ON (e.id)
        e.id,
        e.company_name        AS nombre,
        e.company_domain      AS dominio,
        e.pais::TEXT          AS pais,
        e.tier_actual::TEXT   AS tier,
        esl.sub_linea_id,
        sln.codigo            AS sub_linea_codigo
      FROM matec_radar.empresas e
      JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
      JOIN matec_radar.sub_lineas_negocio sln ON sln.id = esl.sub_linea_id
      WHERE esl.sub_linea_id IN (${ids})
        AND e.tier_actual::TEXT IN ('A','B','C','D','sin_calificar')
      ORDER BY e.id
    ) AS sub
    ORDER BY random()
    LIMIT 5
  `);
  console.log('Sample auto-select result (5 random):');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
