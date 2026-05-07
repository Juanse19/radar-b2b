/**
 * V3 / Fase A1 multi-empresa smoke test.
 *
 * Calificica 3 empresas en una sesión y compara resultados:
 *   (a) Grupo Bimbo / México        — esperado Tier A   (referente internacional)
 *   (b) Coordinadora / Colombia     — esperado B-Alta o B-Baja (regional)
 *   (c) Tiendas D1 / Colombia       — esperado C        (retailer pequeño, fit bajo)
 *
 * Uses dev-login + SSE + Supabase verification.
 *
 * Run: npx tsx scripts/smoke_calificador_v3_multi.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3002';
const SESSION_ID = randomUUID();
const LINEA = 'BHS';

const EMPRESAS = [
  { name: 'Grupo Bimbo',  country: 'Mexico',   domain: 'grupobimbo.com',   expectedTier: 'A' },
  { name: 'Coordinadora', country: 'Colombia', domain: 'coordinadora.com', expectedTier: 'B-Alta' },
  { name: 'Tiendas D1',   country: 'Colombia', domain: 'tiendasd1.com',    expectedTier: 'C' },
];

interface DimEvent { empresa: string; dim: string; value: number; valor?: string; justificacion?: string }
interface CompanyResult {
  name: string;
  expected: string;
  dims: DimEvent[];
  scoreTotal?: number;
  tier?: string;
  duration?: number;
  cost?: number;
  error?: string;
}

async function pg(sql: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log(`▶  V3 Smoke Test — sessionId=${SESSION_ID}`);
  console.log(`   Base: ${BASE}\n`);

  // 1. Login
  const loginRes = await fetch(`${BASE}/api/dev-login`);
  if (!loginRes.ok) throw new Error(`dev-login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];

  // 2. Calificar las 3 empresas
  const params = new URLSearchParams({
    sessionId: SESSION_ID,
    linea:     LINEA,
    provider:  'openai',
    ragEnabled:'false',
    empresas:  JSON.stringify(EMPRESAS.map(e => ({ name: e.name, country: e.country, domain: e.domain }))),
  });
  const url = `${BASE}/api/comercial/calificar?${params.toString()}`;

  const res = await fetch(url, { headers: { Cookie: cookie, Accept: 'text/event-stream' } });
  if (!res.ok || !res.body) throw new Error(`SSE failed ${res.status}: ${await res.text()}`);
  console.log(`   ✓ SSE stream open\n`);

  const decoder = new TextDecoder();
  const results: Map<string, CompanyResult> = new Map(
    EMPRESAS.map(e => [e.name, { name: e.name, expected: e.expectedTier, dims: [] }]),
  );
  const startTimes: Map<string, number> = new Map();

  let buffer = '';
  let currentEvent = '';
  let sessionDone = false;
  const reader = res.body.getReader();

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
      if (!line.startsWith('data: ')) continue;
      let payload: any;
      try { payload = JSON.parse(line.slice(6)); } catch { continue; }
      const ev = currentEvent || 'message';
      const empresa = payload?.empresa as string | undefined;
      const r = empresa ? results.get(empresa) : null;

      if (ev === 'empresa_started' && empresa) {
        startTimes.set(empresa, Date.now());
        console.log(`▶  ${empresa} — escaneando…`);
      } else if (ev === 'dim_scored' && r) {
        r.dims.push(payload as DimEvent);
        process.stdout.write('.');
      } else if (ev === 'tier_assigned' && r) {
        r.scoreTotal = payload.scoreTotal;
        r.tier       = payload.tier;
        console.log(`\n   → ${empresa}: tier=${payload.tier} score=${payload.scoreTotal}`);
      } else if (ev === 'empresa_done' && r) {
        r.duration = payload.durationMs;
        r.cost     = payload.costUsd;
      } else if (ev === 'company_error' && r) {
        r.error = payload.error;
        console.log(`\n   ✗ ${empresa}: ${payload.error}\n`);
      } else if (ev === 'session_done') {
        sessionDone = true;
        console.log(`\n   ✓ session_done\n`);
      }
    }
  }

  // 3. Reporte comparativo
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  REPORTE COMPARATIVO');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  for (const r of results.values()) {
    console.log(`\n${r.name}`);
    console.log(`  Esperado: tier ${r.expected}`);
    console.log(`  Obtenido: tier ${r.tier ?? 'N/A'}  score=${r.scoreTotal ?? 'N/A'}  duration=${r.duration ?? 'N/A'}ms  cost=$${r.cost?.toFixed(4) ?? 'N/A'}`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
      continue;
    }
    console.log(`  Dimensiones (${r.dims.length}/8):`);
    for (const d of r.dims) {
      console.log(`    • ${d.dim.padEnd(22)} = ${(d.valor ?? '?').padEnd(34)} (score ${d.value})`);
    }
  }

  // 4. Verificar persistencia
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  VERIFICACIÓN SUPABASE');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  const rows = await pg(`
    SELECT
      e.company_name AS empresa,
      c.tier_calculado::TEXT AS tier,
      c.score_total,
      c.score_acceso_al_decisor,
      c.score_cuenta_estrategica,
      jsonb_array_length(c.dimensiones) AS n_dims,
      c.is_v2
    FROM matec_radar.calificaciones c
    LEFT JOIN matec_radar.empresas e ON e.id = c.empresa_id
    WHERE c.session_id = '${SESSION_ID}'
    ORDER BY c.created_at
  `);
  console.log(JSON.stringify(rows, null, 2));

  // 5. Resumen de aciertos
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  let pass = 0;
  for (const r of results.values()) {
    const dimsOk     = r.dims.length === 8;
    const tierIsKnown = ['A','B-Alta','B-Baja','C','D'].includes(r.tier ?? '');
    const persisted  = (rows as any[]).some(x => x.empresa === r.name);
    const ok = dimsOk && tierIsKnown && persisted && !r.error;
    console.log(`  ${ok ? '✓' : '✗'} ${r.name}: dims=${r.dims.length}/8, tier=${r.tier}, persisted=${persisted}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.size} empresas calificadas correctamente`);
  process.exit(pass === results.size ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
