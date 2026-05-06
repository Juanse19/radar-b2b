/**
 * scripts/apply_migration.ts
 *
 * Aplica una migración SQL específica a Supabase producción usando el endpoint
 * /pg/query (pg-meta HTTP API). Pensado para migraciones simples (ALTER TABLE,
 * CREATE INDEX, etc.) que no necesitan el splitter avanzado de apply_v5_migration.ts.
 *
 * Uso:
 *   npx tsx scripts/apply_migration.ts <ruta-relativa-al-archivo-sql>
 *   npx tsx scripts/apply_migration.ts supabase/migrations/20260505_001_radar_v2_raw_llm_audit.sql
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/apply_migration.ts <sql-file-path>');
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), file);
const sql = readFileSync(sqlPath, 'utf-8');

async function pgExec(query: string): Promise<unknown> {
  const res = await fetch(`${url!.replace(/\/$/, '')}/pg/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  return res.json();
}

(async () => {
  console.log(`▶  Aplicando migración: ${file}`);
  try {
    await pgExec(sql);
    console.log('✓  Migración aplicada con éxito');
  } catch (err) {
    console.error('❌  Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
