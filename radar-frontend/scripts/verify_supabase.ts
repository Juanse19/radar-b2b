/**
 * scripts/verify_supabase.ts
 * Sanity check: connects to Supabase, counts rows in each matec_radar table.
 *
 * Usage: npx tsx scripts/verify_supabase.ts
 *
 * Requirements:
 *   - SUPABASE_URL set in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY set in .env.local (real value, not placeholder)
 *   - 'matec_radar' added to Settings → API → Exposed schemas in Supabase dashboard
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the project root
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const url    = process.env.SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.SUPABASE_DB_SCHEMA ?? 'matec_radar';

if (!url || !key || key === 'FILL_IN_SERVICE_ROLE_KEY') {
  console.error(
    '❌  Missing credentials.\n' +
    '    Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

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
  console.log(`\n🔍  Verifying Supabase connection (schema: ${schema})\n`);

  let allOk = true;

  for (const table of TABLES) {
    const { count, error } = await db
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`  ❌  ${table}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✅  ${table}: ${count ?? 0} rows`);
    }
  }

  console.log('');

  if (allOk) {
    console.log('✅  All tables reachable. Supabase connection is healthy.\n');
  } else {
    console.error(
      '❌  Some tables failed.\n' +
      '    Make sure:\n' +
      '    1. You ran supabase/migrations/20260408_000_init_matec_radar.sql\n' +
      '    2. You added "matec_radar" to Settings → API → Exposed schemas\n',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
