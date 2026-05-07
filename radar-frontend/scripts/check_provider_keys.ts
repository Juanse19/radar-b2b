import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function pg(sql: string) {
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  // 1. Inspect ai_provider_configs schema + rows
  const schema = await pg(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='matec_radar' AND table_name='ai_provider_configs'
    ORDER BY ordinal_position
  `);
  console.log('=== ai_provider_configs schema ===');
  console.log(JSON.stringify(schema, null, 2));

  const rows = await pg(`SELECT * FROM matec_radar.ai_provider_configs`);
  console.log('=== ai_provider_configs rows ===');
  console.log(JSON.stringify(rows, null, 2));

  // 2. Check verification of dim_valores migration
  const cols = await pg(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'matec_radar' AND table_name = 'calificaciones'
      AND column_name IN ('dimensiones', 'score_cuenta_estrategica', 'score_tier', 'is_v2', 'sub_linea_id')
    ORDER BY column_name
  `);
  console.log('=== V2 columns present ===');
  console.log(JSON.stringify(cols, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
