/** Smoke test directo de las queries SQL que usan los endpoints */
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
  console.log('=== empresas-search query: search="bimbo" ===');
  const search = 'bimbo';
  const safeSearch = search.replace(/'/g, "''").replace(/[%_]/g, ch => `\\${ch}`);
  const empresas = await q(`
    SELECT *
    FROM (
      SELECT DISTINCT ON (e.id)
        e.id,
        e.company_name AS nombre,
        e.company_domain AS dominio,
        e.pais::TEXT AS pais,
        e.tier_actual::TEXT AS tier,
        esl.sub_linea_id,
        sln.codigo AS sub_linea_codigo
      FROM matec_radar.empresas e
      LEFT JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
      LEFT JOIN matec_radar.sub_lineas_negocio sln ON sln.id = esl.sub_linea_id
      WHERE 1=1
        AND (
          LOWER(e.company_name) LIKE LOWER('%${safeSearch}%') OR
          LOWER(COALESCE(e.company_domain, '')) LIKE LOWER('%${safeSearch}%') OR
          LOWER(COALESCE(e.pais_nombre, '')) LIKE LOWER('%${safeSearch}%')
        )
      ORDER BY e.id
    ) AS sub
    ORDER BY LOWER(nombre)
    LIMIT 20
  `);
  console.log(`Resultados (${(empresas as unknown[]).length}):`);
  (empresas as Array<{ nombre: string; dominio: string|null; pais: string; tier: string; sub_linea_codigo: string|null }>).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.nombre} · ${e.pais} · ${e.tier} · sub=${e.sub_linea_codigo} · dom=${e.dominio ?? 'NO DOMAIN'}`);
  });
})().catch(e => { console.error(e); process.exit(1); });
