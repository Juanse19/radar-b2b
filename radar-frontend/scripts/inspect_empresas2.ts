import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function q(sql: string): Promise<unknown> {
  const r = await fetch(`${url}/pg/query`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
(async () => {
  const a = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='matec_radar' AND table_name='empresas' AND column_name IN ('activo','active','is_active','status','enabled')`);
  console.log('Activo-like:', a);

  const total = await q(`SELECT COUNT(*) AS c FROM matec_radar.empresas`);
  console.log('Total empresas:', total);

  const conDominio = await q(`SELECT COUNT(*) AS c FROM matec_radar.empresas WHERE company_domain IS NOT NULL AND company_domain != ''`);
  console.log('Con dominio:', conDominio);

  const tiers = await q(`SELECT tier_actual::TEXT AS tier, COUNT(*) FROM matec_radar.empresas GROUP BY tier_actual ORDER BY tier_actual`);
  console.log('Distribución tiers:', tiers);

  const sample = await q(`SELECT id, company_name, company_domain, pais::TEXT AS pais, tier_actual::TEXT AS tier FROM matec_radar.empresas WHERE company_domain IS NOT NULL AND tier_actual IN ('a_oro','a','A-ORO','A','tier_a','tier_a_oro') LIMIT 5`);
  console.log('Sample tier alto:', sample);
})().catch(e => { console.error(e); process.exit(1); });
