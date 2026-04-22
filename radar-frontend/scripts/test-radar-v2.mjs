#!/usr/bin/env node
/**
 * test-comercial.mjs — Prueba directa del Agente 1 RADAR contra Claude API.
 * No requiere desplegar la Edge Function.
 *
 * Uso:
 *   node scripts/test-comercial.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '..');

// ── Leer .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const ENV = { ...loadEnv(), ...process.env };
const CLAUDE_API_KEY    = ENV.CLAUDE_API_KEY;
const SUPABASE_URL      = ENV.SUPABASE_URL;
const SUPABASE_SRV_KEY  = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!CLAUDE_API_KEY)   { console.error('❌ CLAUDE_API_KEY no definida en .env.local'); process.exit(1); }
if (!SUPABASE_URL)     { console.error('❌ SUPABASE_URL no definida'); process.exit(1); }
if (!SUPABASE_SRV_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY no definida'); process.exit(1); }

// ── Empresas a testear ───────────────────────────────────────────────────────
const EMPRESAS = [
  { id: 441,  name: 'DHL Supply Chain México',  country: 'México' },
  { id: 643,  name: 'FedEx Corp',               country: 'México' },
  { id: 644,  name: 'UPS Inc',                  country: 'México' },
];
const LINE = 'Intralogística';

// ── System prompt (idéntico al de la Edge Function) ──────────────────────────
const RADAR_SYSTEM_PROMPT = `Eres el Agente 1 del sistema MAOA de Matec S.A.S.: el RADAR de Inversiones.

Tu ÚNICA misión es DETECTAR señales de inversión futura en LATAM.
NO calificas. NO puntúas. NO priorizas. Eso lo hace el Agente 2.

Tu trabajo es responder UNA pregunta: ¿Existe una señal REAL y FUTURA
de inversión relevante para las líneas de negocio de Matec?

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 1 — METODOLOGÍA DE INVESTIGACIÓN (MULTI-PASO)            ║
╚══════════════════════════════════════════════════════════════════════╝

Para CADA empresa o proyecto recibido, ejecuta estos 4 pasos en orden:

PASO 1 · DESCOMPOSICIÓN
Formula 3-5 sub-preguntas concretas:
  - ¿Tiene proyectos de expansión logística/aeroportuaria/industrial
    en LATAM anunciados para 2026-2028?
  - ¿Ha publicado licitaciones, RFPs o concursos de automatización?
  - ¿Cuál es su CAPEX declarado para los próximos 2 años en la región?
  - ¿Hay anuncios de nuevos CEDIs, plantas, terminales o corrugadoras
    en construcción o planificación?
  - ¿Existen concesiones o permisos gubernamentales en proceso?

PASO 2 · BÚSQUEDA PROFUNDA
Para cada sub-pregunta realiza búsquedas web dirigidas.
Jerarquía de fuentes (de mayor a menor confiabilidad):
  Peso 5: Autoridades / Planes Maestros (Aerocivil, ANI, DGAC, gobiernos)
  Peso 4: Operadores / Empresas (newsroom, press releases, 10-K, 20-F)
  Peso 3: Asociaciones CORE (ACI-LAC, FEFCO, CORRUCOL)
  Peso 2: Prensa especializada (T21, Logistec, Air Cargo World)
  Peso 1: Noticias / RSS generales
⛔ Evita: blogs personales, agregadores genéricos, foros, opinión.

PASO 3 · LECTURA COMPLETA
Lee las fuentes en su totalidad. Extrae datos específicos:
  - Montos de inversión (cifra + moneda + fuente del dato)
  - Fechas (inicio, finalización estimada, hitos)
  - Nombres de proyectos, códigos de licitación, referencias oficiales
  - Ubicaciones exactas (ciudad, aeropuerto, parque industrial)
  - Estado actual (fase conceptual → ingeniería → ejecución → completado)

PASO 4 · SÍNTESIS
Cruza la información contra TODAS las reglas de este prompt.
Si las fuentes se contradicen, repórtalo en 'observaciones'.
No presentes incertidumbre como certeza.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 2 — LÍNEAS DE NEGOCIO DE MATEC                           ║
╚══════════════════════════════════════════════════════════════════════╝

┌─ Intralogística ────────────────────────────────────────────────────
│  Automatización de CEDI/DC:
│  sortation, WMS, ASRS, conveyor systems, final de línea industrial,
│  picking automatizado, clasificación de paquetería, robótica de
│  almacén, sistemas de transporte interno.
└──────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 3 — EVALUACIÓN TEMPORAL (OBLIGATORIO)                     ║
╚══════════════════════════════════════════════════════════════════════╝

AÑO BASE: 2026.

🔴 DESCARTE INMEDIATO: verbos en pasado completivo, inauguró, abrió
   sus puertas, ya está en operación, inversión 2024-2025 sin fases
   futuras.

🟢 VÁLIDO: licitación ABIERTA 2026+, CAPEX aprobado sin ejecutar,
   "planea invertir", concesión otorgada sin obras iniciadas,
   construcción en curso con fases futuras.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 4 — REGLAS DE INCLUSIÓN Y DESCARTE                        ║
╚══════════════════════════════════════════════════════════════════════╝

✅ INCLUIR (radar_activo: "Sí"): inversión FUTURA 6-36 meses,
   proyecto específico, licitación/RFP abierto, CAPEX sin ejecutar.

❌ DESCARTAR (radar_activo: "No"): obra inaugurada, noticia antes
   2025 sin actualización, nota genérica sin proyecto.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 7 — ANTI-ALUCINACIÓN (OBLIGATORIO — NO NEGOCIABLE)       ║
╚══════════════════════════════════════════════════════════════════════╝

REGLA 7A: fuente_link → SOLO URLs reales. Si no hay URL → "No disponible".
REGLA 7B: fecha_senal → SOLO si aparece explícitamente. Si no → "No disponible".
REGLA 7C: Si monto NO aparece en la fuente → "No reportado".
REGLA 7D: motivo_descarte → OBLIGATORIO cuando radar_activo = "No", específico.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 10 — FORMATO DE SALIDA (JSON)                             ║
╚══════════════════════════════════════════════════════════════════════╝

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto antes
ni después.

{
  "empresa_evaluada": "nombre exacto",
  "radar_activo": "Sí" | "No",
  "linea_negocio": "Intralogística",
  "tipo_senal": "uno de los tipos válidos",
  "pais": "país del proyecto",
  "empresa_o_proyecto": "nombre del proyecto específico",
  "descripcion_resumen": "mín 80 palabras si Sí; motivo conciso si No",
  "criterios_cumplidos": ["criterio1"],
  "total_criterios": 0,
  "ventana_compra": "0-6 Meses | 6-12 Meses | 12-18 Meses | 18-24 Meses | > 24 Meses | Sin señal",
  "monto_inversion": "cifra exacta o No reportado",
  "fuente_link": "URL exacta o No disponible",
  "fuente_nombre": "tipo de fuente con peso",
  "fecha_senal": "DD/MM/AAAA o No disponible",
  "evaluacion_temporal": "🔴 Descarte | 🟡 Ambiguo | 🟢 Válido",
  "observaciones": null,
  "motivo_descarte": ""
}`;

// ── Parser de respuesta Claude ───────────────────────────────────────────────
function parseAgente1Response(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in Claude response');
  const obj = JSON.parse(match[0]);
  if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Expected a JSON object');
  if (!obj.empresa_evaluada) throw new Error('Missing field: empresa_evaluada');
  return {
    empresa_evaluada:    String(obj.empresa_evaluada),
    radar_activo:        obj.radar_activo === 'Sí' ? 'Sí' : 'No',
    linea_negocio:       obj.linea_negocio    ?? null,
    tipo_senal:          obj.tipo_senal       ?? null,
    pais:                obj.pais             ?? null,
    empresa_o_proyecto:  obj.empresa_o_proyecto ?? null,
    descripcion_resumen: obj.descripcion_resumen ?? null,
    criterios_cumplidos: Array.isArray(obj.criterios_cumplidos) ? obj.criterios_cumplidos : [],
    total_criterios:     typeof obj.total_criterios === 'number' ? obj.total_criterios : 0,
    ventana_compra:      obj.ventana_compra   ?? null,
    monto_inversion:     obj.monto_inversion  ?? 'No reportado',
    fuente_link:         obj.fuente_link      ?? 'No disponible',
    fuente_nombre:       obj.fuente_nombre    ?? null,
    fecha_senal:         obj.fecha_senal      ?? 'No disponible',
    evaluacion_temporal: obj.evaluacion_temporal ?? null,
    observaciones:       obj.observaciones    ?? null,
    motivo_descarte:     obj.motivo_descarte  ?? '',
  };
}

// ── Llamada a Claude con multi-turn web_search ───────────────────────────────
async function callClaude(company, line) {
  const userMessage = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}

Ejecuta los 4 pasos de investigación para esta empresa.`;

  const baseBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text', text: RADAR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  };

  let messages = [{ role: 'user', content: userMessage }];
  let lastData;
  let totalInput = 0, totalOutput = 0;

  for (let turn = 0; turn < 10; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05,prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...baseBody, messages }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${err.slice(0, 400)}`);
    }

    lastData = await resp.json();
    totalInput  += lastData.usage?.input_tokens  ?? 0;
    totalOutput += lastData.usage?.output_tokens ?? 0;

    process.stdout.write(` [turn ${turn + 1}, stop=${lastData.stop_reason}]`);

    if (lastData.stop_reason === 'end_turn') break;

    if (lastData.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: lastData.content });
      const toolResults = lastData.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: [] }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  const textBlocks = (lastData?.content ?? []).filter(b => b.type === 'text');
  const rawText = textBlocks[textBlocks.length - 1]?.text ?? '';
  if (!rawText) throw new Error('No text block in Claude response');

  const result = parseAgente1Response(rawText);
  return { result, tokens_input: totalInput, tokens_output: totalOutput };
}

// ── Insertar en Supabase ─────────────────────────────────────────────────────
async function insertResult(sessionId, companyId, result, tokens_input, tokens_output, cost_usd) {
  const PRICE_INPUT  = 3.0;
  const PRICE_OUTPUT = 15.0;
  const computedCost = cost_usd ?? (tokens_input * PRICE_INPUT / 1e6 + tokens_output * PRICE_OUTPUT / 1e6);

  const row = {
    session_id:          sessionId,
    empresa_id:          companyId,
    empresa_evaluada:    result.empresa_evaluada,
    radar_activo:        result.radar_activo,
    linea_negocio:       result.linea_negocio,
    tipo_senal:          result.tipo_senal,
    pais:                result.pais,
    empresa_o_proyecto:  result.empresa_o_proyecto,
    descripcion_resumen: result.descripcion_resumen,
    criterios_cumplidos: result.criterios_cumplidos,
    total_criterios:     result.total_criterios,
    ventana_compra:      result.ventana_compra,
    monto_inversion:     result.monto_inversion,
    fuente_link:         result.fuente_link,
    fuente_nombre:       result.fuente_nombre,
    fecha_senal:         result.fecha_senal,
    evaluacion_temporal: result.evaluacion_temporal,
    observaciones:       result.observaciones,
    motivo_descarte:     result.motivo_descarte,
    raw_json:            result,
    tokens_input,
    tokens_output,
    cost_usd:            parseFloat(computedCost.toFixed(6)),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/radar_v2_results`, {
    method: 'POST',
    headers: {
      'apikey':           SUPABASE_SRV_KEY,
      'Authorization':    `Bearer ${SUPABASE_SRV_KEY}`,
      'Content-Type':     'application/json',
      'Accept-Profile':   'matec_radar',
      'Content-Profile':  'matec_radar',
      'Prefer':           'return=representation',
    },
    body: JSON.stringify(row),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`DB insert failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

// ── Crear sesión ─────────────────────────────────────────────────────────────
async function createSession(line, count) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/radar_v2_sessions`, {
    method: 'POST',
    headers: {
      'apikey':           SUPABASE_SRV_KEY,
      'Authorization':    `Bearer ${SUPABASE_SRV_KEY}`,
      'Content-Type':     'application/json',
      'Accept-Profile':   'matec_radar',
      'Content-Profile':  'matec_radar',
      'Prefer':           'return=representation',
    },
    body: JSON.stringify({ linea_negocio: line, empresas_count: count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Session create failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('═'.repeat(60));
console.log(' PRUEBA CANÓNICA — Agente 1 RADAR (Claude Sonnet 4.6)');
console.log(`  Empresas: ${EMPRESAS.map(e => e.name).join(', ')}`);
console.log(`  Línea: ${LINE}`);
console.log('═'.repeat(60));

let sessionId;
try {
  const sess = await createSession(LINE, EMPRESAS.length);
  sessionId = sess.id;
  console.log(`\n✅ Sesión creada: ${sessionId}\n`);
} catch (e) {
  console.warn(`⚠️  No se pudo crear sesión (${e.message}) — continuando sin sesión`);
  sessionId = null;
}

const results = [];
let totalCost = 0;

for (let i = 0; i < EMPRESAS.length; i++) {
  const empresa = EMPRESAS[i];
  // Espera 65s entre escaneos para respetar el rate limit de 10K tokens/min
  if (i > 0) {
    process.stdout.write(`\n⏳ Esperando 65s (rate limit)...`);
    await new Promise(r => setTimeout(r, 65_000));
  }
  process.stdout.write(`\n🔍 Escaneando: ${empresa.name}`);
  const t0 = Date.now();

  try {
    const { result, tokens_input, tokens_output } = await callClaude(empresa, LINE);
    const cost = (tokens_input * 3.0 / 1e6) + (tokens_output * 15.0 / 1e6);
    totalCost += cost;

    console.log(`\n   ✅ ${result.empresa_evaluada}`);
    console.log(`      radar_activo  : ${result.radar_activo}`);
    console.log(`      tipo_senal    : ${result.tipo_senal ?? '—'}`);
    console.log(`      ventana_compra: ${result.ventana_compra ?? '—'}`);
    console.log(`      fuente_link   : ${result.fuente_link}`);
    console.log(`      monto         : ${result.monto_inversion}`);
    console.log(`      costo         : $${cost.toFixed(4)} USD (in=${tokens_input} out=${tokens_output})`);
    console.log(`      tiempo        : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (result.motivo_descarte) console.log(`      descarte      : ${result.motivo_descarte}`);

    try {
      const inserted = await insertResult(sessionId, empresa.id, result, tokens_input, tokens_output, cost);
      console.log(`      DB id         : ${inserted?.id ?? 'n/a'}`);
    } catch (dbErr) {
      console.warn(`      ⚠️  DB insert: ${dbErr.message}`);
    }

    results.push({ empresa: empresa.name, ...result, cost_usd: cost });
  } catch (err) {
    console.log(`\n   ❌ Error: ${err.message}`);
    results.push({ empresa: empresa.name, error: err.message });
  }
}

console.log('\n' + '═'.repeat(60));
console.log(` RESUMEN — Costo total: $${totalCost.toFixed(4)} USD`);
console.log('═'.repeat(60));

const table = results.map(r => ({
  empresa:       r.empresa,
  radar_activo:  r.radar_activo ?? '—',
  tipo_senal:    r.tipo_senal   ?? r.error ?? '—',
  ventana:       r.ventana_compra ?? '—',
  costo:         r.cost_usd ? `$${r.cost_usd.toFixed(4)}` : '—',
}));
console.table(table);
