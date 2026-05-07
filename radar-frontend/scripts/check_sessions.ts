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
  console.log('=== Sesiones en prospector_v2_sessions ===');
  const sessions = await q(`
    SELECT id, modo, sublineas, empresas_count, total_contacts, credits_used,
           created_at, finished_at, cancelled
    FROM matec_radar.prospector_v2_sessions
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(sessions, null, 2));

  console.log('\n=== Contactos persistidos en matec_radar.contactos ===');
  const contactos = await q(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE prospector_session_id IS NOT NULL) AS con_sesion,
           COUNT(DISTINCT prospector_session_id) AS sesiones_distintas
    FROM matec_radar.contactos
  `);
  console.log(JSON.stringify(contactos));

  console.log('\n=== Últimos 5 contactos creados (cualquier fuente) ===');
  const recientes = await q(`
    SELECT id, first_name, last_name, email, prospector_session_id, created_at
    FROM matec_radar.contactos
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log(JSON.stringify(recientes, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
