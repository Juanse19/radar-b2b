/**
 * Identifica empresas reales para el plan de pruebas:
 *  - 1× Tier A (con dominio, sin contactos importados aún)
 *  - 1× Tier B (con dominio, sin contactos)
 *  - 1× Tier C (con dominio, sin contactos)
 *  - 1× Tier D (con dominio, sin contactos)
 *  - 2× con contactos ya importados (para test de dedup)
 */
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
  console.log('\n=== Empresa Tier A · con dominio · sin contactos importados ===');
  for (const tier of ['A', 'B', 'C', 'D']) {
    const rows = await q(`
      SELECT e.id, e.company_name, e.company_domain, e.pais::TEXT AS pais, e.tier_actual::TEXT AS tier,
             sln.codigo AS sub_linea
      FROM matec_radar.empresas e
      LEFT JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
      LEFT JOIN matec_radar.sub_lineas_negocio sln ON sln.id = esl.sub_linea_id
      WHERE e.tier_actual = '${tier}'
        AND e.company_domain IS NOT NULL AND e.company_domain != ''
        AND NOT EXISTS (SELECT 1 FROM matec_radar.contactos c WHERE c.empresa_id = e.id)
      ORDER BY random() LIMIT 3
    `);
    console.log(`\nTier ${tier}: ${(rows as unknown[]).length} candidatas`);
    for (const r of rows as Array<Record<string, unknown>>) {
      console.log(`  #${r.id}  ${r.company_name}  · ${r.pais}  · ${r.sub_linea ?? '—'}  · ${r.company_domain}`);
    }
  }

  console.log('\n=== Empresas con contactos ya importados (para dedup test) ===');
  const conContactos = await q(`
    SELECT e.id, e.company_name, e.company_domain, e.pais::TEXT AS pais, e.tier_actual::TEXT AS tier,
           sln.codigo AS sub_linea, COUNT(c.id) AS n_contactos
    FROM matec_radar.empresas e
    JOIN matec_radar.contactos c ON c.empresa_id = e.id
    LEFT JOIN matec_radar.empresa_sub_lineas esl ON esl.empresa_id = e.id
    LEFT JOIN matec_radar.sub_lineas_negocio sln ON sln.id = esl.sub_linea_id
    WHERE e.company_domain IS NOT NULL
      AND c.notas LIKE '[IMPORT-EXCEL-2026-05-07]%'
    GROUP BY e.id, e.company_name, e.company_domain, e.pais, e.tier_actual, sln.codigo
    ORDER BY n_contactos DESC LIMIT 5
  `);
  for (const r of conContactos as Array<Record<string, unknown>>) {
    console.log(`  #${r.id}  ${r.company_name}  · tier=${r.tier}  · ${r.n_contactos} contactos importados  · ${r.company_domain}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
