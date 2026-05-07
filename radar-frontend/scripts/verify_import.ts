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

const TAG = '[IMPORT-EXCEL-2026-05-07]';

(async () => {
  console.log(`\n${'='.repeat(80)}\nVERIFICACIÓN POST-IMPORT — ${TAG}\n${'='.repeat(80)}`);

  const total = await q(`SELECT COUNT(*) AS n FROM matec_radar.contactos WHERE notas LIKE '${TAG}%'`);
  console.log(`\nTotal contactos importados: ${(total as Array<{n:number}>)[0].n}`);

  console.log('\nPor nivel jerárquico:');
  const byNivel = await q(`
    SELECT nivel_jerarquico, COUNT(*) AS n
    FROM matec_radar.contactos
    WHERE notas LIKE '${TAG}%'
    GROUP BY nivel_jerarquico
    ORDER BY n DESC
  `);
  for (const r of byNivel as Array<{nivel_jerarquico: string; n: number}>) {
    console.log(`  ${(r.nivel_jerarquico ?? 'NULL').padEnd(10)} ${r.n}`);
  }

  console.log('\nPor país (top 10):');
  const byCountry = await q(`
    SELECT country::TEXT AS country, COUNT(*) AS n
    FROM matec_radar.contactos
    WHERE notas LIKE '${TAG}%'
    GROUP BY country ORDER BY n DESC LIMIT 10
  `);
  for (const r of byCountry as Array<{country: string; n: number}>) {
    console.log(`  ${(r.country ?? 'NULL').padEnd(8)} ${r.n}`);
  }

  console.log('\nTop 15 empresas con más contactos importados:');
  const byEmpresa = await q(`
    SELECT e.id, e.company_name, e.tier_actual::TEXT AS tier, COUNT(c.id) AS n
    FROM matec_radar.contactos c
    LEFT JOIN matec_radar.empresas e ON e.id = c.empresa_id
    WHERE c.notas LIKE '${TAG}%'
    GROUP BY e.id, e.company_name, e.tier_actual
    ORDER BY n DESC LIMIT 15
  `);
  for (const r of byEmpresa as Array<{id:number;company_name:string;tier:string;n:number}>) {
    console.log(`  ${String(r.n).padStart(4)}× ${(r.tier ?? '—').padEnd(15)} ${r.company_name} (#${r.id})`);
  }

  console.log('\nMuestra (5 contactos):');
  const sample = await q(`
    SELECT c.first_name || ' ' || c.last_name AS nombre, c.title, c.email, c.linkedin_url IS NOT NULL AS has_li, c.phone_mobile IS NOT NULL AS has_tel, e.company_name
    FROM matec_radar.contactos c LEFT JOIN matec_radar.empresas e ON e.id = c.empresa_id
    WHERE c.notas LIKE '${TAG}%' ORDER BY c.id DESC LIMIT 5
  `);
  for (const r of sample as Array<{nombre:string;title:string;email:string;has_li:boolean;has_tel:boolean;company_name:string}>) {
    console.log(`  ${r.nombre} · ${r.title} · ${r.email} · LI=${r.has_li ? '✓' : '–'} · Tel=${r.has_tel ? '✓' : '–'} · @ ${r.company_name}`);
  }

  console.log('\nCompletitud:');
  const compl = await q(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE email IS NOT NULL)        AS con_email,
      COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL) AS con_linkedin,
      COUNT(*) FILTER (WHERE phone_mobile IS NOT NULL) AS con_tel,
      COUNT(*) FILTER (WHERE email_status = 'verified') AS verified
    FROM matec_radar.contactos WHERE notas LIKE '${TAG}%'
  `);
  console.log('  ', JSON.stringify((compl as unknown[])[0]));
})().catch(e => { console.error(e); process.exit(1); });
