/**
 * scripts/verify_supabase.ts
 * Verifies Supabase connectivity and table availability.
 * Usage: npx tsx scripts/verify_supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url    = process.env.SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.SUPABASE_DB_SCHEMA ?? 'public';

if (!url || !key || key === 'FILL_IN_SERVICE_ROLE_KEY') {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log(`\n🔧  Supabase Diagnostics`);
console.log(`    URL:    ${url}`);
console.log(`    Schema: ${schema}\n`);

const db = createClient(url, key, {
  db:   { schema },
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'empresas',
  'ejecuciones',
  'senales',
  'contactos',
  'prospeccion_logs',
] as const;

async function main() {
  let allOk   = true;
  let needsMigration = false;

  for (const table of TABLES) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });

    if (error) {
      const detail = error.message || error.details || JSON.stringify(error);
      console.error(`  ❌  ${table.padEnd(22)} ERROR: ${detail}`);
      allOk = false;
      needsMigration = true;
    } else {
      console.log(`  ✅  ${table.padEnd(22)} ${count ?? 0} rows`);
    }
  }

  console.log('');

  if (allOk) {
    console.log('✅  All tables reachable. Supabase is ready.\n');
    console.log('Next step → migrate SQLite data:');
    console.log('  npx tsx scripts/migrate_sqlite_to_supabase.ts\n');
    return;
  }

  if (needsMigration) {
    console.error('❌  One or more tables are missing.\n');
    console.error('  Run this SQL in supabase.valparaiso.cafe → SQL Editor:');
    console.error('  → radar-frontend/supabase/migrations/20260408_001_public_schema.sql\n');
    console.error('  Then re-run: npx tsx scripts/verify_supabase.ts\n');
  }

  process.exit(1);
}

main().catch(e => { console.error('Unexpected error:', e); process.exit(1); });
