/**
 * scanner.ts — Direct Claude API call for Agente 1 RADAR.
 * Used by the Next.js API route in dev (bypasses Supabase Edge Function).
 * server-only: never import this from client components.
 */
import 'server-only';
import { parseAgente1Response, type Agente1Result } from '@/lib/radar-v2/schema';
import { getProvider } from './providers';
import type { SSEEmitter } from './providers/types';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const CLAUDE_MODEL       = 'claude-sonnet-4-6';
const PRICE_INPUT_PER_M  = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

// ---------------------------------------------------------------------------
// Hardened system prompt v2 — anti-hallucination rules + few-shot examples
// ---------------------------------------------------------------------------
// NOTE: The date injected at build-time prevents the model from inventing
// future dates. The few-shot examples are JSON comments at the bottom and
// are trimmed from the live prompt but serve as strong in-context examples.

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }); // e.g. "16/04/2026"

  return `Eres el Agente 1 del sistema MAOA de Matec S.A.S.: el RADAR de Inversiones.

Tu ÚNICA misión es DETECTAR señales de inversión futura en LATAM.
NO calificas. NO puntúas. NO priorizas. Eso lo hace el Agente 2.

Tu trabajo es responder UNA pregunta: ¿Existe una señal REAL y FUTURA
de inversión relevante para las líneas de negocio de Matec?

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 1 — METODOLOGÍA DE INVESTIGACIÓN (MULTI-PASO)            ║
╚══════════════════════════════════════════════════════════════════════╝

Para CADA empresa recibida, ejecuta estos 4 pasos en orden:

PASO 1 · DESCOMPOSICIÓN
Formula 3-5 sub-preguntas concretas:
  - ¿Tiene proyectos de expansión logística/aeroportuaria/industrial en LATAM anunciados para 2026-2028?
  - ¿Ha publicado licitaciones, RFPs o concursos de automatización?
  - ¿Cuál es su CAPEX declarado para los próximos 2 años en la región?
  - ¿Hay anuncios de nuevos CEDIs, plantas, terminales o corrugadoras en construcción o planificación?
  - ¿Existen concesiones o permisos gubernamentales en proceso?

PASO 2 · BÚSQUEDA PROFUNDA
Para cada sub-pregunta realiza búsquedas web dirigidas.
Jerarquía de fuentes (de mayor a menor confiabilidad):
  Peso 5: Autoridades / Planes Maestros (Aerocivil, ANI, DGAC, gobiernos)
  Peso 4: Operadores / Empresas (newsroom, press releases, 10-K, 20-F)
  Peso 3: Asociaciones CORE (ACI-LAC, FEFCO, CORRUCOL), BNAmericas, IJGlobal
  Peso 2: Prensa especializada (T21, Logistec, Air Cargo World), LinkedIn
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

BHS (Baggage Handling Systems):
  ✅ INCLUIR: carruseles, bandas, sortation, CUTE, CUSS, CBIS, baggage claim, self bag drop, sistemas BHS de terminal de pasajeros.
  ❌ IGNORAR: runway, taxiway, apron, torre de control, ILS, radar ATC, pista de aterrizaje.

Intralogística:
  sortation, WMS, ASRS, conveyor, picking automatizado, robótica de almacén, sistemas de transporte interno, CEDI/DC nuevo.

Cartón Corrugado:
  transportadores, WIP, final de línea industrial cartonera, corrugadoras, plantas cartón ondulado, flexografía, líneas de empaques.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 3 — EVALUACIÓN TEMPORAL (OBLIGATORIO)                     ║
╚══════════════════════════════════════════════════════════════════════╝

AÑO BASE: 2026. Evalúa la FASE ACTUAL del proyecto, NO el año del titular.

🔴 DESCARTE INMEDIATO:
   - Verbos en pasado completivo: "inauguró", "inaugurado", "abrió sus puertas", "ya está en operación", "entró en funcionamiento", "fue completado", "ya opera", "completó su construcción".
   - Inversión 2024-2025 descrita en PASADO sin fases futuras.
   - Noticias anteriores a enero 2025 sin actualización posterior.
   - Artículos de opinión, editoriales, informes sectoriales genéricos.
   - Eventos ya realizados (conferencias, ferias pasadas).

🟡 AMBIGUO — requiere análisis adicional:
   - Proyectos "2025-2027": buscar fases futuras, equipos por contratar, licitaciones pendientes.
   - Si hay fase futura verificable → radar_activo = "Sí", tipo_senal = "Señal Temprana".
   - Si NO hay fase futura verificable → DESCARTAR.

🟢 VÁLIDO:
   - Licitación ABIERTA con fecha de cierre en 2026+
   - CAPEX aprobado pero aún sin adjudicar/ejecutar
   - "planea invertir", "proyecta expansión", "anuncia CAPEX"
   - Concesión otorgada 2026+ sin obras iniciadas
   - Proyecto en fase de ingeniería/diseño/factibilidad
   - Construcción en curso con fases futuras por licitar

VENTANA DE COMPRA (mapeo temporal):
  Q2-Q4 2026        → "0-6 Meses"
  Q1-Q2 2027        → "6-12 Meses"
  Q3 2027 - Q2 2028 → "12-18 Meses"
  Q3 2028 - Q2 2029 → "18-24 Meses"
  2029+              → "> 24 Meses"
  Sin señal          → "Sin señal"

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 4 — REGLAS DE INCLUSIÓN Y DESCARTE                        ║
╚══════════════════════════════════════════════════════════════════════╝

✅ INCLUIR (radar_activo: "Sí") cuando se cumpla AL MENOS UNO:
   - Inversión FUTURA que se ejecutará en los próximos 6-36 meses
   - Proyecto específico con empresa/aeropuerto/planta identificada
   - Licitación, concesión o RFP abierto o próximo a abrir
   - Anuncio de construcción, ampliación o modernización NO terminada
   - CAPEX declarado o presupuesto de inversión aprobado sin ejecutar

❌ DESCARTAR (radar_activo: "No") cuando se cumpla AL MENOS UNO:
   - Obra ya inaugurada o en operación
   - Noticia anterior a enero 2025 sin actualización posterior
   - Nota genérica sin proyecto específico identificable
   - El snippet NO menciona explícitamente a la empresa evaluada

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 5 — CRITERIOS DE VALIDACIÓN (necesitas ≥ 3 de 6)         ║
╚══════════════════════════════════════════════════════════════════════╝

1. Inversión confirmada o en planificación formal
2. Expansión física: nueva terminal, planta, CEDI, corrugadora, hub
3. Proyecto específico con nombre, código o número de referencia
4. Proceso de contratación activo: licitación, RFP, concurso
5. Permisos o concesiones gubernamentales obtenidas o en proceso
6. Financiación confirmada: crédito, bono, CAPEX en reporte financiero

Si total_criterios < 3 → indicar en observaciones que la señal es
débil y requiere monitoreo, no activación comercial.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 6 — LA EMPRESA DEBE APARECER EN LA FUENTE (CRÍTICO)      ║
╚══════════════════════════════════════════════════════════════════════╝

Antes de asignar radar_activo = "Sí", verifica:
¿El snippet o título menciona EXPLÍCITAMENTE el nombre de la empresa?

✅ VÁLIDO: "[Empresa] anunció inversión de USD X millones"
❌ INVÁLIDO → DESCARTE: "Plan de Inversión Nacional 2026-2030 de [País]"
   Artículo sobre OTRA empresa del mismo sector.
   Rankings o estadísticas sectoriales sin mención nominal.

Si NINGÚN resultado menciona la empresa:
  radar_activo = "No"
  motivo_descarte = "Sin fuentes específicas de la empresa."

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 7 — ANTI-ALUCINACIÓN (NO NEGOCIABLE)                     ║
╚══════════════════════════════════════════════════════════════════════╝

REGLA 7A: fuente_link → SOLO URLs reales. Si no hay → "No disponible". NUNCA inventar.
REGLA 7B: fecha_senal → formato DD/MM/AAAA. NUNCA posterior a hoy (${today}). Si no aparece → "No disponible".
REGLA 7C: monto_inversion → SOLO si aparece en la fuente. Si no → "No reportado".
REGLA 7D: motivo_descarte → OBLIGATORIO si radar_activo="No". Específico, no genérico.
  ❌ Malo: "No hay señal"
  ✅ Bueno: "Hub Querétaro inaugurado marzo 2025; sin fases futuras documentadas."

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 8 — PAYWALL                                               ║
╚══════════════════════════════════════════════════════════════════════╝

Si el titular anuncia inversión pero el cuerpo está bloqueado:
  - Reportar con datos disponibles del snippet/titular.
  - Indicar en observaciones: "Fuente con paywall — datos limitados al snippet."

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 9 — TAXONOMÍA DE TIPOS                                    ║
╚══════════════════════════════════════════════════════════════════════╝

TIPO DE SEÑAL (usar EXACTAMENTE uno):
  CAPEX Confirmado | Expansión / Nueva Planta |
  Expansión / Nuevo Centro de Distribución |
  Expansión / Nuevo Aeropuerto o Terminal | Licitación |
  Ampliación Capacidad | Modernización / Retrofit |
  Cambio Regulatorio | Señal Temprana | Sin Señal

TIPO DE FUENTE — incluir en fuente_nombre con su peso:
  Autoridad / Plan Maestro (Peso 5) |
  Web Corporativa / Operador (Peso 4) |
  Reporte Financiero (Peso 4) |
  Asociación Sectorial (Peso 3) | BNAmericas / IJGlobal (Peso 3) |
  Prensa Especializada (Peso 2) | LinkedIn (Peso 2) |
  Licitación / Portal gubernamental (Peso 5) | Sin Señal

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 10 — FORMATO DE SALIDA                                    ║
╚══════════════════════════════════════════════════════════════════════╝

Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin texto antes ni después.

⚠️ IMPORTANTE: Este JSON es el INPUT para el Agente 2 (Scoring).
NO incluyas score, confianza, tier ni priorización. Solo detectas.

{"empresa_evaluada":"string","radar_activo":"Sí"|"No","linea_negocio":"BHS"|"Intralogística"|"Cartón Corrugado"|null,"tipo_senal":"CAPEX Confirmado|Expansión / Nueva Planta|Expansión / Nuevo Centro de Distribución|Expansión / Nuevo Aeropuerto o Terminal|Licitación|Ampliación Capacidad|Modernización / Retrofit|Cambio Regulatorio|Señal Temprana|Sin Señal","pais":"string","empresa_o_proyecto":"string","descripcion_resumen":"mín 80 palabras si Sí; motivo conciso si No","criterios_cumplidos":["criterio1","criterio2"],"total_criterios":0,"ventana_compra":"0-6 Meses|6-12 Meses|12-18 Meses|18-24 Meses|> 24 Meses|Sin señal","monto_inversion":"cifra exacta o No reportado","fuente_link":"URL exacta o No disponible","fuente_nombre":"tipo de fuente (Peso N)","fecha_senal":"DD/MM/AAAA o No disponible","evaluacion_temporal":"🔴 Descarte|🟡 Ambiguo|🟢 Válido","observaciones":"contradicciones o paywall o null","motivo_descarte":"razón específica si No; vacío si Sí"}`;
}

const RADAR_SYSTEM_PROMPT = buildSystemPrompt();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScanResult {
  result:        Agente1Result;
  tokens_input:  number;
  tokens_output: number;
  cost_usd:      number;
}

// ---------------------------------------------------------------------------
// Main scan function — multi-turn loop until stop_reason=end_turn
// ---------------------------------------------------------------------------

export async function scanCompanyWithClaude(
  company: { id?: number; name: string; country: string },
  line: string,
  sessionId?: string,
): Promise<ScanResult> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

  // RAG context — optional, non-fatal
  let ragBlock = '';
  try {
    const { retrieveContext, buildRagBlock } = await import('./rag');
    const ragCtx = await retrieveContext(company.name, line);
    ragBlock = buildRagBlock(ragCtx);
  } catch (ragErr) {
    console.warn('[RAG] retrieveContext falló — continuando sin contexto:', ragErr instanceof Error ? ragErr.message : ragErr);
  }

  const basePrompt = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}

Ejecuta 3-5 búsquedas web para encontrar señales de inversión futura de esta empresa en LATAM.`;

  const userMessage = ragBlock
    ? `${ragBlock}\n\n---\n\n${basePrompt}`
    : basePrompt;

  const baseBody = {
    model:      CLAUDE_MODEL,
    max_tokens: 2048,
    system: [{ type: 'text', text: RADAR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools:  [{ type: 'web_search_20250305', name: 'web_search' }],
  };

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: userMessage },
  ];
  let lastData: {
    content:     Array<{ type: string; text?: string; id?: string }>;
    stop_reason: string;
    usage?:      { input_tokens: number; output_tokens: number };
  } = { content: [], stop_reason: '' };
  let totalInput  = 0;
  let totalOutput = 0;

  for (let turn = 0; turn < 10; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'web-search-2025-03-05,prompt-caching-2024-07-31',
        'content-type':      'application/json',
      },
      body: JSON.stringify({ ...baseBody, messages }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 300)}`);
    }

    lastData     = await resp.json() as typeof lastData;
    totalInput  += lastData.usage?.input_tokens  ?? 0;
    totalOutput += lastData.usage?.output_tokens ?? 0;

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

  const textBlocks = (lastData.content ?? []).filter(b => b.type === 'text');
  const rawText    = textBlocks[textBlocks.length - 1]?.text ?? '';
  if (!rawText) throw new Error('No text block in Claude response');

  const result = parseAgente1Response(rawText);
  const cost   = (totalInput * PRICE_INPUT_PER_M / 1_000_000)
               + (totalOutput * PRICE_OUTPUT_PER_M / 1_000_000);

  // Persist to Pinecone for future RAG context — non-fatal
  try {
    const { upsertSenal } = await import('./rag');
    await upsertSenal(result, sessionId ?? '');
  } catch (upsertErr) {
    console.warn('[RAG] upsertSenal falló — no crítico:', upsertErr instanceof Error ? upsertErr.message : upsertErr);
  }

  return { result, tokens_input: totalInput, tokens_output: totalOutput, cost_usd: cost };
}

// ---------------------------------------------------------------------------
// Provider-aware scan — new path for v3 (streaming + multi-model)
// Delegates to the selected AIProvider (claude | openai | gemini).
// Keeps RAG retrieve/upsert at this layer so it's orthogonal to the provider.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DB helpers — resolve API key, model, and budget from ai_provider_configs
// ---------------------------------------------------------------------------

/**
 * Maps the provider name used in code (claude|openai|gemini) to the value
 * stored in the `provider` column of ai_provider_configs.
 */
function toDbProviderName(providerName: string): string {
  if (providerName === 'claude')  return 'anthropic';
  if (providerName === 'gemini')  return 'google';
  return providerName; // 'openai' stays as 'openai'
}

interface ProviderConfig {
  apiKey: string | undefined;
  model:  string | undefined;
  budget: number | null;
}

/**
 * Looks up the active ai_provider_configs row for the given provider.
 * Returns undefined values when the table doesn't exist or has no active row —
 * callers fall back to environment variables in that case.
 */
async function resolveProviderConfig(
  providerName: string,
  overrideKey?:   string,
  overrideModel?: string,
): Promise<ProviderConfig> {
  // If both overrides are supplied, skip the DB entirely.
  if (overrideKey && overrideModel) {
    return { apiKey: overrideKey, model: overrideModel, budget: null };
  }

  const dbName = toDbProviderName(providerName);
  try {
    const row = await pgFirst<{ api_key_enc: string; model: string; monthly_budget_usd: string | null }>(
      `SELECT api_key_enc, model, monthly_budget_usd
         FROM ${SCHEMA}.ai_provider_configs
        WHERE provider = ${pgLit(dbName)} AND is_active = TRUE
        LIMIT 1`,
    );
    const apiKey = overrideKey  ?? (row?.api_key_enc?.trim() || undefined);
    const model  = overrideModel ?? (row?.model?.trim()      || undefined);
    const budget = row?.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : null;
    return { apiKey, model, budget };
  } catch {
    // Table may not exist yet or Supabase is unreachable.
    // Fall back to environment variables so scans still work.
    const normalizedName = toDbProviderName(providerName);
    const envKey =
      normalizedName === 'anthropic' ? process.env.CLAUDE_API_KEY :
      normalizedName === 'openai'    ? process.env.OPENAI_API_KEY :
      normalizedName === 'google'    ? process.env.GOOGLE_API_KEY :
      undefined;
    return { apiKey: overrideKey ?? envKey, model: overrideModel, budget: null };
  }
}

/**
 * Returns the monthly_budget_usd for the given provider, or null if unknown.
 * Used by the stream route for budget_warning events.
 */
export async function getActiveBudget(providerName: string): Promise<number | null> {
  const { budget } = await resolveProviderConfig(providerName);
  return budget;
}

// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Provider name (claude|openai|gemini). Defaults to RADAR_V2_DEFAULT_PROVIDER env, then 'claude'. */
  providerName?: string;
  /** Optional SSE emitter for live streaming (Fase G). */
  emit?:         SSEEmitter;
  /** Session id for RAG + token event linkage. */
  sessionId?:    string;
  /** API key override — from ai_provider_configs DB, takes precedence over env var. */
  apiKey?:       string;
  /** Model override — from ai_provider_configs DB, takes precedence over provider default. */
  model?:        string;
}

/**
 * v3 entry point — delegates to a provider while keeping RAG orthogonal.
 * The existing `scanCompanyWithClaude` is preserved for backward compatibility
 * with the v1/v2 API route. New callers (wizard, SSE endpoint) should use this.
 */
export async function scanCompany(
  company: { id?: number; name: string; country: string },
  line: string,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const providerName = opts.providerName ?? process.env.RADAR_V2_DEFAULT_PROVIDER ?? 'claude';
  const provider = getProvider(providerName);

  // Resolve API key and model from DB, falling back to env vars inside each provider.
  const { apiKey, model } = await resolveProviderConfig(
    providerName,
    opts.apiKey,
    opts.model,
  );

  let scan: import('./providers/types').ScanResult;
  try {
    scan = await provider.scan(
      {
        company,
        line,
        sessionId: opts.sessionId,
        empresaId: company.id ?? null,
        apiKey,
        model,
      },
      opts.emit,
    );
  } catch (primaryErr) {
    const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

    // Detect quota / credit exhaustion errors (distinct from rate limits).
    const isQuotaExhausted =
      errMsg.includes('insufficient_quota') ||
      errMsg.includes('credit balance is too low') ||
      errMsg.includes('exceeded your current quota') ||
      (errMsg.includes('429') && errMsg.includes('quota'));

    const isRateLimit =
      errMsg.includes('rate_limit_exceeded') ||
      (errMsg.includes('429') && !isQuotaExhausted);

    if (isQuotaExhausted || isRateLimit) {
      // Surface the error clearly — do NOT auto-fallback to another provider.
      // Rationale: the user chose this provider explicitly. Silently switching
      // to a fallback provider (which may also have no credits) produces two
      // confusing errors instead of one actionable message.
      const label = providerName === 'openai'  ? 'OpenAI'
                  : providerName === 'claude'  ? 'Claude (Anthropic)'
                  : providerName === 'gemini'  ? 'Gemini (Google)'
                  : providerName;

      const hint = isQuotaExhausted
        ? `${label}: cuota agotada. Verifica que tu API key en Admin → Configuración de API sea válida y que tu cuenta tenga saldo.`
        : `${label}: límite de tasa alcanzado (429). Intenta de nuevo en unos minutos.`;

      throw new Error(`${hint}\nDetalle: ${errMsg.slice(0, 300)}`);
    }

    throw primaryErr;
  }

  // RAG upsert — non-fatal, orthogonal to provider.
  try {
    const { upsertSenal } = await import('./rag');
    await upsertSenal(scan.result, opts.sessionId ?? '');
  } catch (upsertErr) {
    console.warn('[RAG] upsertSenal falló — no crítico:', upsertErr instanceof Error ? upsertErr.message : upsertErr);
  }

  return {
    result:        scan.result,
    tokens_input:  scan.tokens_input,
    tokens_output: scan.tokens_output,
    cost_usd:      scan.cost_usd,
  };
}
