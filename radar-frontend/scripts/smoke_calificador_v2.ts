/**
 * Live smoke test for Calificador V2 — uses /api/dev-login + SSE.
 *
 * Calls the calificar endpoint with Grupo Bimbo + OpenAI provider, parses
 * the SSE stream and reports:
 *   - empresa_started
 *   - profiling_web
 *   - dim_scored events (expects 9, with valor + justificacion)
 *   - tier_assigned (with scoreTotal + tier)
 *   - empresa_done (with cost)
 *   - session_done
 *
 * Run: npx tsx scripts/smoke_calificador_v2.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3002';
const SESSION_ID = randomUUID();
const EMPRESA = { name: 'Grupo Bimbo', country: 'Mexico', domain: 'grupobimbo.com' };
const LINEA = 'BHS';

interface DimEvent {
  empresa: string;
  dim:     string;
  value:   number;
  valor?:  string;
  justificacion?: string;
}

async function main() {
  console.log(`▶  Smoke test Calificador V2 — ${BASE}`);

  // 1. Dev login → get session cookie
  console.log('1. POST /api/dev-login …');
  const loginRes = await fetch(`${BASE}/api/dev-login`);
  if (!loginRes.ok) throw new Error(`dev-login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie');
  if (!cookie) throw new Error('No cookie returned');
  const sessionCookie = cookie.split(';')[0]; // "matec_session=…"
  console.log(`   ✓ Authenticated (cookie len=${sessionCookie.length})`);

  // 2. Open SSE stream to /api/comercial/calificar
  const params = new URLSearchParams({
    sessionId: SESSION_ID,
    linea:     LINEA,
    provider:  'openai',
    ragEnabled:'false',  // skip RAG to keep test fast
    empresas:  JSON.stringify([EMPRESA]),
  });
  const url = `${BASE}/api/comercial/calificar?${params.toString()}`;
  console.log(`2. GET ${url.slice(0, 90)}…`);

  const res = await fetch(url, { headers: { Cookie: sessionCookie, Accept: 'text/event-stream' } });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '<no body>');
    throw new Error(`SSE failed ${res.status}: ${errText}`);
  }
  console.log(`   ✓ SSE stream open (status ${res.status})`);

  // 3. Parse SSE
  const decoder = new TextDecoder();
  const dimEvents: DimEvent[] = [];
  let tierEvent: any = null;
  let doneEvent: any = null;
  let sessionDone = false;
  let companyError: any = null;
  let buffer = '';
  let currentEvent = '';

  const startMs = Date.now();
  const reader  = res.body.getReader();

  while (!sessionDone) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx;
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nlIdx).trim();
      buffer = buffer.slice(nlIdx + 1);
      if (!line) { currentEvent = ''; continue; }
      if (line.startsWith('event: ')) { currentEvent = line.slice(7); continue; }
      if (line.startsWith('data: ')) {
        let payload: any = null;
        try { payload = JSON.parse(line.slice(6)); } catch { /* ignore */ }
        const ev = currentEvent || 'message';

        if (ev === 'empresa_started') {
          console.log(`   • empresa_started: ${payload?.empresa}`);
        } else if (ev === 'profiling_web') {
          console.log(`   • profiling_web …`);
        } else if (ev === 'dim_scored') {
          dimEvents.push(payload as DimEvent);
          console.log(`   • dim_scored ${dimEvents.length}/9 — ${payload.dim.padEnd(22)} = ${payload.valor ?? '?'} (score ${payload.value})`);
        } else if (ev === 'tier_assigned') {
          tierEvent = payload;
          console.log(`   • tier_assigned — scoreTotal=${payload.scoreTotal}  tier=${payload.tier}`);
        } else if (ev === 'empresa_done') {
          doneEvent = payload;
          console.log(`   • empresa_done — duration=${payload.durationMs}ms cost=$${payload.costUsd?.toFixed?.(4) ?? '?'}`);
        } else if (ev === 'session_done') {
          sessionDone = true;
          console.log(`   • session_done`);
        } else if (ev === 'company_error') {
          companyError = payload;
          console.log(`   ✗ company_error: ${payload.error}`);
        } else if (ev === 'error') {
          throw new Error(`SSE error: ${JSON.stringify(payload)}`);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n3. Stream closed after ${elapsed}s`);

  // 4. Assertions
  console.log('\n=== ASSERTIONS ===');
  const checks: Array<[string, boolean]> = [
    ['9 dim_scored events',                      dimEvents.length === 9],
    ['all dim_scored have valor (categórico)',   dimEvents.every(d => typeof d.valor === 'string' && d.valor.length > 0)],
    ['all dim_scored have justificacion',        dimEvents.every(d => typeof d.justificacion === 'string')],
    ['tier_assigned received',                    tierEvent !== null],
    ['tier ∈ {A,B,C,D}',                          ['A','B','C','D'].includes(tierEvent?.tier)],
    ['scoreTotal in [0,10]',                      typeof tierEvent?.scoreTotal === 'number' && tierEvent.scoreTotal >= 0 && tierEvent.scoreTotal <= 10],
    ['empresa_done received',                     doneEvent !== null],
    ['session_done received',                     sessionDone],
    ['no company_error',                          companyError === null],
  ];
  let pass = 0, fail = 0;
  for (const [name, ok] of checks) {
    console.log(`   ${ok ? '✓' : '✗'} ${name}`);
    ok ? pass++ : fail++;
  }
  console.log(`\n${pass}/${checks.length} checks passed`);

  // 5. Verify Supabase persistence
  console.log('\n=== SUPABASE ===');
  const supaUrl = process.env.SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const q = `SELECT id, provider, score_total, tier_calculado, score_cuenta_estrategica, score_tier,
                    jsonb_array_length(dimensiones) AS n_dims, is_v2
             FROM matec_radar.calificaciones
             WHERE session_id = '${SESSION_ID}'
             ORDER BY created_at DESC LIMIT 1`;
  const dbRes = await fetch(`${supaUrl}/pg/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', apikey: supaKey },
    body: JSON.stringify({ query: q }),
  });
  if (!dbRes.ok) {
    console.log(`   ✗ DB query failed: ${dbRes.status}`);
  } else {
    const rows = await dbRes.json() as any[];
    if (rows.length === 0) {
      console.log('   ✗ no row persisted');
      fail++;
    } else {
      console.log(`   row: ${JSON.stringify(rows[0], null, 2)}`);
      const r = rows[0];
      const dbChecks: Array<[string, boolean]> = [
        ['provider = openai',          r.provider === 'openai'],
        ['is_v2 = true',                r.is_v2 === true],
        ['n_dims = 9',                  r.n_dims === 9],
        ['score_total numeric',         typeof r.score_total === 'string' || typeof r.score_total === 'number'],
        ['tier_calculado set',          ['A','B','C','D'].includes(r.tier_calculado)],
        ['score_cuenta_estrategica set',r.score_cuenta_estrategica !== null],
        ['score_tier set',              r.score_tier !== null],
      ];
      for (const [name, ok] of dbChecks) {
        console.log(`   ${ok ? '✓' : '✗'} ${name}`);
        ok ? pass++ : fail++;
      }
    }
  }

  console.log(`\n=== RESULT ===\n${fail === 0 ? '✅ ALL PASS' : `❌ ${fail} FAIL`}  (${pass} ok)`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
