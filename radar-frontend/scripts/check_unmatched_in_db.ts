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

const candidates = [
  'Coppel', 'Cemex', 'Sodimac', 'Walmart', 'Prefeitura de Guarulhos',
  'GAP', 'PPG', 'Pernod Ricard', 'OMA', 'Aerocivil', 'Aeronáutica',
  'General Motors', 'AJE', 'Cinépolis', 'Mercedes-Benz', 'H-E-B', '3M',
  'Pilgrim', 'Johnson', 'MSD', 'Famsa', 'FPC', 'Odebrecht', 'Construcap',
  'ICA', 'COSAPI', 'SalfaCorp',
];

(async () => {
  for (const term of candidates) {
    const safe = term.replace(/'/g, "''");
    const rows = await q(`
      SELECT id, company_name FROM matec_radar.empresas
      WHERE LOWER(company_name) LIKE LOWER('%${safe}%')
      LIMIT 5
    `);
    const arr = rows as Array<{ id: number; company_name: string }>;
    if (arr.length === 0) {
      console.log(`✗ "${term}" — NO existe en DB`);
    } else {
      console.log(`✓ "${term}" → ${arr.length} match(es): ${arr.map(r => `${r.company_name} (#${r.id})`).join(' · ')}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
