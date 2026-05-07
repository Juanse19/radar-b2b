import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function pg(sql: string) {
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      apikey: key,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const cols = await pg(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'matec_radar' AND table_name = 'calificaciones'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(cols, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
