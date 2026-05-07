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
  const c = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='matec_radar' AND table_name='empresas' ORDER BY ordinal_position`);
  console.log('All empresas columns:'); console.log(JSON.stringify(c, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
