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
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

(async () => {
  const cols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='matec_radar' AND table_name='contactos'
      AND column_name IN ('phone_unlocked','phone_unlocked_at','fase2_done','nivel_jerarquico','prospector_session_id','es_principal')
    ORDER BY column_name
  `);
  console.log('Nuevas columnas en contactos:', cols);

  const tbl = await q(`SELECT to_regclass('matec_radar.prospector_v2_sessions') AS exists`);
  console.log('prospector_v2_sessions:', tbl);

  const tree = await q(`
    SELECT l.codigo AS linea, COUNT(s.id) AS sublineas
    FROM matec_radar.lineas_negocio l
    LEFT JOIN matec_radar.sub_lineas_negocio s ON s.linea_id = l.id
    WHERE l.activo = TRUE
    GROUP BY l.codigo, l.orden
    ORDER BY l.orden
  `);
  console.log('Árbol líneas:', tree);

  const empresaCols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='matec_radar' AND table_name='empresas'
    ORDER BY ordinal_position
  `);
  console.log('Columnas empresas:', empresaCols);

  const allContactCols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='matec_radar' AND table_name='contactos'
    ORDER BY ordinal_position
  `);
  console.log('Todas las columnas de contactos:', allContactCols);
})().catch(e => { console.error(e); process.exit(1); });
