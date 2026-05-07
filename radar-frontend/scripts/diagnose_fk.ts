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
  console.log('1) Foreign keys en prospector_v2_sessions:');
  const fks = await q(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'matec_radar.prospector_v2_sessions'::regclass
      AND contype = 'f'
  `);
  console.log(JSON.stringify(fks.body, null, 2));

  console.log('\n2) Sesión 1598df93-... existe?');
  const sess = await q(`SELECT id, user_id, created_at FROM matec_radar.prospector_v2_sessions WHERE id = '1598df93-b002-454c-86fc-0ed465ee9227'::uuid`);
  console.log(JSON.stringify(sess.body));

  console.log('\n3) Cuenta total de sesiones en prospector_v2_sessions:');
  const cnt = await q(`SELECT COUNT(*) FROM matec_radar.prospector_v2_sessions`);
  console.log(JSON.stringify(cnt.body));

  console.log('\n4) Test INSERT sin user_id (NULL) — debería funcionar:');
  const testNull = await q(`
    INSERT INTO matec_radar.prospector_v2_sessions (id, modo, sublineas, empresas_count)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000001'::uuid, 'auto', ARRAY['test']::TEXT[], 0)
    RETURNING id
  `);
  console.log(JSON.stringify(testNull));

  console.log('\n5) Test INSERT con user_id random — fallará si FK existe:');
  const testFk = await q(`
    INSERT INTO matec_radar.prospector_v2_sessions (id, user_id, modo, sublineas, empresas_count)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000002'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'auto', ARRAY['test']::TEXT[], 0)
    RETURNING id
  `);
  console.log(JSON.stringify(testFk));

  console.log('\n6) Cleanup');
  await q(`DELETE FROM matec_radar.prospector_v2_sessions WHERE id IN ('aaaaaaaa-bbbb-cccc-dddd-000000000001'::uuid, 'aaaaaaaa-bbbb-cccc-dddd-000000000002'::uuid)`);
})().catch(e => { console.error(e); process.exit(1); });
