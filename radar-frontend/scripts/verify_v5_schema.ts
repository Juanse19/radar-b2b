/**
 * scripts/verify_v5_schema.ts — Verifica que la migración v5 esté aplicada.
 * Uso: npx tsx scripts/verify_v5_schema.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function q(sql: string) {
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) return { error: await r.text() };
  return r.json();
}

(async () => {
  console.log('\n📋 Tablas v5 nuevas:');
  console.log(await q(`SELECT tablename FROM pg_tables WHERE schemaname='matec_radar' AND tablename IN ('radar_signals','notificaciones') ORDER BY tablename`));

  console.log('\n🔧 Funciones RPC:');
  console.log(await q(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='matec_radar' AND proname IN ('match_signals','match_empresa_by_name') ORDER BY proname`));

  console.log('\n🆕 Columnas v5:');
  console.log(await q(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='matec_radar' AND column_name IN ('modo','provider','nivel_confianza','embedding','empresa_es_nueva','tipo','leida') ORDER BY table_name, column_name`));

  console.log('\n📦 Extensión pgvector:');
  console.log(await q(`SELECT extname FROM pg_extension WHERE extname='vector'`));

  console.log('\n📈 Índices ivfflat (vector):');
  console.log(await q(`SELECT indexname, tablename FROM pg_indexes WHERE schemaname='matec_radar' AND indexname LIKE '%embedding%' ORDER BY indexname`));
})();
