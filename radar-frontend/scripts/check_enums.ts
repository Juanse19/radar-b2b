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
  const enumVals = await q(`SELECT unnest(enum_range(NULL::matec_radar.pais_iso_enum))::TEXT AS v`);
  console.log('pais_iso_enum:'); console.log(JSON.stringify(enumVals));

  const empresasPais = await q(`
    SELECT pais::TEXT AS pais, COUNT(*) AS n FROM matec_radar.empresas
    GROUP BY pais ORDER BY n DESC LIMIT 20
  `);
  console.log('\nempresas.pais distribución:'); console.log(JSON.stringify(empresasPais));

  // Comprobar columnas existentes en contactos
  const cols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'matec_radar' AND table_name = 'contactos'
      AND column_name IN ('fuente', 'departamento', 'notas')
  `);
  console.log('\ncols extra check:'); console.log(JSON.stringify(cols));

  // Email status enum
  const emailStatus = await q(`
    SELECT DISTINCT email_status FROM matec_radar.contactos LIMIT 10
  `);
  console.log('\nemail_status distinct:'); console.log(JSON.stringify(emailStatus));
})().catch(e => { console.error(e); process.exit(1); });
