import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function q(sql: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${url}/pg/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
(async () => {
  console.log('1) Drop constraint prospector_v2_sessions_user_id_fkey');
  const drop = await q(`ALTER TABLE matec_radar.prospector_v2_sessions DROP CONSTRAINT IF EXISTS prospector_v2_sessions_user_id_fkey`);
  console.log('  status:', drop.status);

  console.log('\n2) FKs restantes (esperado: ninguno):');
  const fks = await q(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'matec_radar.prospector_v2_sessions'::regclass AND contype = 'f'
  `);
  console.log('  ', JSON.stringify(fks.body));

  console.log('\n3) Test INSERT con user_id arbitrario:');
  const test = await q(`
    INSERT INTO matec_radar.prospector_v2_sessions (id, user_id, modo, sublineas, empresas_count)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000099'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'auto', ARRAY['test']::TEXT[], 0)
    RETURNING id
  `);
  console.log('  status:', test.status, 'body:', JSON.stringify(test.body));

  await q(`DELETE FROM matec_radar.prospector_v2_sessions WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-000000000099'::uuid`);
  console.log('\n4) Cleanup OK');
})().catch(e => { console.error(e); process.exit(1); });
