/**
 * scripts/test_apollo_api.ts
 *
 * Smoke test directo contra api.apollo.io para validar que APOLLO_API_KEY
 * funciona antes de probar el flujo completo del wizard.
 *
 * Uso: npx tsx scripts/test_apollo_api.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const key = process.env.APOLLO_API_KEY;
if (!key) {
  console.error('❌  APOLLO_API_KEY missing in .env.local');
  process.exit(1);
}

console.log('APOLLO_API_KEY length:', key.length);
console.log('APOLLO_API_KEY preview:', key.slice(0, 6) + '…');

interface UsersMeResponse {
  user?: {
    name?: string;
    email?: string;
    organization?: { name?: string };
  };
  is_logged_in?: boolean;
}

interface SearchResponse {
  people?: Array<{ id: string; name?: string; title?: string }>;
}

(async () => {
  console.log('\n[1] api/v1/users/me — verificación de auth');
  try {
    const r = await fetch('https://api.apollo.io/api/v1/users/me', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body:    JSON.stringify({}),
    });
    console.log('   HTTP', r.status);
    const j = await r.json().catch(() => null) as UsersMeResponse | null;
    if (j?.user) {
      console.log('   ✓ user:', j.user.name ?? j.user.email);
      console.log('   ✓ org:', j.user.organization?.name);
    } else {
      console.log('   body:', JSON.stringify(j).slice(0, 300));
    }
  } catch (e) {
    console.error('   ✗', (e as Error).message);
  }

  console.log('\n[2] mixed_people/api_search — Grupo Bimbo, México (gratis)');
  try {
    const r = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        q_organization_domains_list: ['grupobimbo.com'],
        person_titles:                ['CEO', 'Director de Operaciones', 'Plant Manager'],
        person_locations:             ['Mexico'],
        per_page:                     5,
        page:                         1,
      }),
    });
    console.log('   HTTP', r.status);
    const j = await r.json().catch(() => null) as SearchResponse | null;
    if (j?.people) {
      console.log(`   ✓ ${j.people.length} candidatos`);
      j.people.slice(0, 3).forEach((p, i) => {
        console.log(`     ${i + 1}. ${p.name} — ${p.title}`);
      });
    } else {
      console.log('   body:', JSON.stringify(j).slice(0, 300));
    }
  } catch (e) {
    console.error('   ✗', (e as Error).message);
  }
})();
