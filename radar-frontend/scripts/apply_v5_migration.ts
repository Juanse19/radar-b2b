/**
 * scripts/apply_v5_migration.ts
 *
 * Aplica la migración 20260427_001_v5_signals_notifications_pgvector.sql
 * a Supabase producción usando el endpoint /pg/query (pg-meta HTTP API).
 *
 * Idempotente: el SQL usa IF NOT EXISTS / IF EXISTS, se puede correr varias veces.
 *
 * Uso:
 *   npx tsx scripts/apply_v5_migration.ts            # aplica
 *   npx tsx scripts/apply_v5_migration.ts --dry-run  # solo lista qué se aplicaría
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

const dryRun = process.argv.includes('--dry-run');

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260427_001_v5_signals_notifications_pgvector.sql',
);

async function pgExec(sql: string): Promise<unknown> {
  const res = await fetch(`${url!.replace(/\/$/, '')}/pg/query`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      apikey:         key!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  return res.json();
}

/**
 * Split SQL into top-level statements respecting:
 *  - quoted strings ('...' and "...")
 *  - dollar-quoted blocks ($$...$$ used by CREATE FUNCTION bodies and DO blocks)
 *  - line comments (-- to end of line)
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];
    const next2 = sql.slice(i, i + 2);
    const next4 = sql.slice(i, i + 4);

    // Line comment
    if (!inSingle && !inDouble && !inDollar && next2 === '--') {
      const eol = sql.indexOf('\n', i);
      if (eol === -1) { buf += sql.slice(i); break; }
      buf += sql.slice(i, eol + 1);
      i = eol + 1;
      continue;
    }

    // Dollar-quoted start/end (matches $$ or $tag$)
    if (!inSingle && !inDouble) {
      if (!inDollar && c === '$') {
        // Look for $tag$ where tag is empty or [a-zA-Z_]+
        const m = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          inDollar = true;
          dollarTag = m[0];
          buf += dollarTag;
          i += dollarTag.length;
          continue;
        }
      } else if (inDollar && sql.slice(i).startsWith(dollarTag)) {
        buf += dollarTag;
        i += dollarTag.length;
        inDollar = false;
        dollarTag = '';
        continue;
      }
    }

    if (!inDollar && !inDouble && c === "'") inSingle = !inSingle;
    else if (!inDollar && !inSingle && c === '"') inDouble = !inDouble;

    if (c === ';' && !inSingle && !inDouble && !inDollar) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

(async function main() {
  console.log(`\n🔧  v5 Migration Runner`);
  console.log(`    Target: ${url}`);
  console.log(`    File:   ${MIGRATION_PATH}`);
  console.log(`    Mode:   ${dryRun ? 'DRY RUN (no changes)' : 'APPLY'}\n`);

  let sql: string;
  try {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  } catch (err) {
    console.error('❌  Cannot read migration file:', err);
    process.exit(1);
  }

  const statements = splitStatements(sql);
  console.log(`📑  ${statements.length} statements parsed\n`);

  if (dryRun) {
    statements.forEach((s, i) => {
      const head = s.split('\n')[0].slice(0, 80);
      console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${head}${s.split('\n')[0].length > 80 ? '…' : ''}`);
    });
    console.log('\n✅  Dry run complete — no changes applied.');
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const head = stmt.split('\n')[0].slice(0, 80);
    process.stdout.write(`  ${(i + 1).toString().padStart(2, ' ')}/${statements.length}  ${head}…  `);
    try {
      await pgExec(stmt);
      console.log('✓');
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Tratar como skip si el objeto ya existe (idempotente)
      if (msg.includes('already exists') || msg.includes('duplicate_object')) {
        console.log('⊙ (already exists)');
        skipped++;
      } else {
        console.log('✗');
        console.error(`     ${msg.slice(0, 300)}`);
        failed++;
      }
    }
  }

  console.log(`\n📊  ${ok} ok  ·  ${skipped} skipped  ·  ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
