/** Apollo credits/usage discovery — busca el endpoint correcto */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const key = process.env.APOLLO_API_KEY!;

async function probe(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`https://api.apollo.io/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch {/* */}
  return { path, method, status: res.status, body: parsed };
}

(async () => {
  const probes = [
    await probe('/auth/health',                    'GET'),
    await probe('/users/me',                       'POST', {}),
    await probe('/auth/credit_usage',              'GET'),
    await probe('/credit_usage',                   'GET'),
    await probe('/users/credit_usage',             'GET'),
    await probe('/usage_stats/api_usage_stats',    'POST', {}),
  ];
  for (const p of probes) {
    const preview = JSON.stringify(p.body).slice(0, 200);
    console.log(`${p.method} ${p.path} → ${p.status} ${preview.slice(0, 180)}`);
  }

  console.log('\n--- usage_stats full response ---');
  const usage = await probe('/usage_stats/api_usage_stats', 'POST', {});
  console.log(JSON.stringify(usage.body, null, 2).slice(0, 2000));
})().catch(e => { console.error(e); process.exit(1); });
