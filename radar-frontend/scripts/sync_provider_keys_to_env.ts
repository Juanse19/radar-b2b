/**
 * Reads ai_provider_configs from Supabase and appends OPENAI_API_KEY,
 * ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_MODEL, etc. to .env.local
 * if the corresponding lines are missing.
 *
 * Idempotent — only adds missing entries; never overwrites existing ones.
 *
 * Usage: npx tsx scripts/sync_provider_keys_to_env.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function pg(sql: string) {
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

interface Row { provider: string; api_key_enc: string; model: string }

const ENV_FILE = resolve(process.cwd(), '.env.local');

async function main() {
  const rows = (await pg(`SELECT provider, api_key_enc, model FROM matec_radar.ai_provider_configs`)) as Row[];
  if (!existsSync(ENV_FILE)) {
    console.error('.env.local does not exist — aborting');
    process.exit(1);
  }
  const current = readFileSync(ENV_FILE, 'utf8');

  const additions: string[] = [];
  function addIfMissing(envVar: string, value: string | null | undefined) {
    if (!value) return;
    const re = new RegExp(`^${envVar}=`, 'm');
    if (!re.test(current) && !additions.find(a => a.startsWith(`${envVar}=`))) {
      additions.push(`${envVar}=${value}`);
    } else {
      console.log(`  - ${envVar} already present, skipping`);
    }
  }

  for (const row of rows) {
    if (row.provider === 'openai') {
      addIfMissing('OPENAI_API_KEY', row.api_key_enc);
      addIfMissing('OPENAI_MODEL', row.model);
      addIfMissing('OPENAI_CALIFICADOR_MODEL', row.model);
    }
    if (row.provider === 'anthropic') {
      addIfMissing('ANTHROPIC_API_KEY', row.api_key_enc);
      addIfMissing('ANTHROPIC_MODEL', row.model);
    }
    if (row.provider === 'google') {
      addIfMissing('GEMINI_API_KEY', row.api_key_enc);
      addIfMissing('GEMINI_MODEL', row.model);
    }
  }

  if (additions.length === 0) {
    console.log('Nothing to add — all keys already present in .env.local');
    return;
  }

  const block = `\n# Provider keys synced from matec_radar.ai_provider_configs (${new Date().toISOString()})\n${additions.join('\n')}\n`;
  writeFileSync(ENV_FILE, current + block, 'utf8');
  console.log(`Added ${additions.length} entries to .env.local:`);
  for (const a of additions) {
    const [k] = a.split('=');
    console.log(`  + ${k}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
