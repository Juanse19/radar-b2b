/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * run_migrations.js
 * Runs SQL migration files against Supabase via the pg-meta API.
 *
 * Usage:
 *   node tools/run_migrations.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) acc[k.trim()] = v.join('=').trim();
  return acc;
}, {});

const SUPA_URL = env.SUPABASE_URL || '';
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPA_URL || !SUPA_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
  process.exit(1);
}

const MIGRATIONS = [
  '../supabase/migrations/20260408_0015_drop_legacy.sql',
  '../supabase/migrations/20260408_002_business_model.sql',
  '../supabase/migrations/20260408_003_seed_catalogos.sql',
].map(p => path.resolve(__dirname, p));

function pgQuery(sql) {
  return new Promise((resolve, reject) => {
    const parsed  = url.parse(SUPA_URL);
    const payload = JSON.stringify({ query: sql });
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     '/pg/query',
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${SUPA_KEY}`,
        'apikey':         SUPA_KEY,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`Supabase: ${SUPA_URL}\n`);

  for (const migFile of MIGRATIONS) {
    const name = path.basename(migFile);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log('─'.repeat(60));

    const sql = fs.readFileSync(migFile, 'utf8');
    console.log(`  Lines: ${sql.split('\n').length}, Bytes: ${Buffer.byteLength(sql)}`);

    const { status, data } = await pgQuery(sql);

    if (status >= 200 && status < 300) {
      console.log(`  ✓ Success (HTTP ${status})`);
      if (Array.isArray(data) && data.length > 0 && data.length < 20) {
        console.log('  Result:', JSON.stringify(data));
      }
    } else {
      console.error(`  ✗ ERROR (HTTP ${status}):`);
      console.error('  ', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('All migrations completed successfully!');
  console.log('\nVerifying tables in matec_radar...');

  const { data: tables } = await pgQuery(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'matec_radar' ORDER BY table_name"
  );
  console.log(`Tables created: ${tables.length}`);
  tables.forEach(t => console.log(`  - ${t.table_name}`));
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
