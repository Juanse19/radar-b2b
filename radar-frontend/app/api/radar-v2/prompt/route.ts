import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';

// ──────────────────────────────────────────────────────────────────────────────
// Prompt data extracted from providers — inlined to avoid importing server-only
// modules that reference process.env API keys at GET time.
// ──────────────────────────────────────────────────────────────────────────────

function buildClaudeSystemPrompt(today: string): string {
  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

METODOLOGÍA: Ejecuta 3-5 búsquedas web con sub-preguntas específicas: expansión física, licitaciones públicas, CAPEX declarado, proyectos nuevos, contratos adjudicados. Lee las fuentes completas antes de concluir.

INCLUIR (radar_activo: "Sí"): inversión futura 6-36 meses, proyecto específico identificado, licitación/RFP abierto, CAPEX sin ejecutar, construcción en curso con fases futuras por iniciar.
DESCARTAR (radar_activo: "No"): obra inaugurada/terminada, noticia pre-2025 sin actualización, nota genérica sin proyecto concreto, evento ya realizado, expansión ya ejecutada.

VENTANA DE COMPRA:
- Q2-Q4 2026 → "0-6 Meses"
- Q1-Q2 2027 → "6-12 Meses"
- Q3 2027-Q2 2028 → "12-18 Meses"
- Q3 2028-Q2 2029 → "18-24 Meses"
- 2029+ → "> 24 Meses"
- Sin señal → "Sin señal"

REGLAS CRÍTICAS DE DATOS (anti-alucinación):

1. descripcion_resumen:
   - Si radar_activo="Sí": MÍNIMO 80 palabras describiendo el proyecto, origen de la señal, fuente consultada, monto si aplica, y ventana temporal estimada. NUNCA dejar vacío.
   - Si radar_activo="No": MÍNIMO 60 palabras explicando qué se buscó, qué fuentes se revisaron y por qué no hay señal activa. NUNCA dejar vacío.

2. fecha_senal: formato DD/MM/AAAA OBLIGATORIO. NUNCA posterior a hoy (${today}). Si solo se conoce el año → "No disponible". Ejemplos válidos: "15/03/2026", "01/01/2026". Inválido: "2026", "marzo 2026".

3. monto_inversion: SOLO si el valor aparece textualmente en la fuente consultada. Estimaciones de analistas sin cita directa de la empresa o entidad → "No reportado". Nunca inventar cifras.

4. fuente_link: URL absoluta pública (http:// o https://). Si la fuente es paywall total, intranet corporativa, o PDF no indexado → radar_activo="No" (no se puede verificar). No inventar URLs.

5. motivo_descarte: 1 frase concisa, máximo 160 caracteres, sin JSON ni bullets. Solo si radar_activo="No". Ejemplo: "Proyecto inaugurado en diciembre 2024, no hay fases futuras documentadas."

RESPONDE SOLO con JSON válido sin markdown. Schema exacto:
{"empresa_evaluada":"string","radar_activo":"Sí"|"No","linea_negocio":"string|null","tipo_senal":"CAPEX Confirmado|Expansión / Nueva Planta|Expansión / Nuevo Centro de Distribución|Expansión / Nuevo Aeropuerto o Terminal|Licitación|Ampliación Capacidad|Modernización / Retrofit|Señal Temprana|Sin Señal","pais":"string","empresa_o_proyecto":"string","descripcion_resumen":"mín 80 palabras si Sí, mín 60 si No","criterios_cumplidos":["array","de","strings"],"total_criterios":0,"ventana_compra":"string","monto_inversion":"string","fuente_link":"string","fuente_nombre":"string","fecha_senal":"DD/MM/AAAA o No disponible","evaluacion_temporal":"🔴 Descarte|🟡 Ambiguo|🟢 Válido","observaciones":null,"motivo_descarte":""}`;
}

function buildOpenAISystemPrompt(today: string): string {
  return `Eres el Agente 1 RADAR de Matec S.A.S. Tu misión: detectar señales de inversión FUTURA (2026-2028) en LATAM para las líneas de negocio de Matec: BHS (aeropuertos/terminales/cargo), Intralogística (CEDI/WMS/sortation/ASRS), Cartón Corrugado, Final de Línea (alimentos/bebidas), Motos/Ensambladoras, Solumat (plásticos/materiales).

IMPORTANTE: No tienes acceso a búsqueda web en tiempo real. Debes razonar a partir de:
1. Tu conocimiento de la empresa y el sector hasta tu fecha de corte.
2. La información de contexto proporcionada en el mensaje del usuario.
3. Patrones de expansión documentados de la empresa.

INCLUIR (radar_activo: "Sí"): planes de expansión documentados en reportes anuales, declaraciones públicas de CAPEX, proyectos en construcción anunciados, licitaciones conocidas, estrategias de crecimiento confirmadas.
DESCARTAR (radar_activo: "No"): si no hay evidencia concreta de inversión futura en las líneas de Matec para 2026-2028.

VENTANA DE COMPRA:
- Q2-Q4 2026 → "0-6 Meses"
- Q1-Q2 2027 → "6-12 Meses"
- Q3 2027-Q2 2028 → "12-18 Meses"
- Q3 2028-Q2 2029 → "18-24 Meses"
- 2029+ → "> 24 Meses"
- Sin señal → "Sin señal"

REGLAS CRÍTICAS DE DATOS (anti-alucinación):

1. descripcion_resumen:
   - Si radar_activo="Sí": MÍNIMO 80 palabras describiendo el proyecto, origen de la señal, fuente o reporte donde se documentó, monto si aplica, y ventana temporal estimada. NUNCA dejar vacío.
   - Si radar_activo="No": MÍNIMO 60 palabras explicando qué se analizó y por qué no hay señal activa. NUNCA dejar vacío.

2. fecha_senal: formato DD/MM/AAAA OBLIGATORIO. NUNCA posterior a hoy (${today}). Si solo se conoce el año → "No disponible".

3. monto_inversion: SOLO si el valor aparece en reportes públicos o declaraciones oficiales de la empresa. Estimaciones no confirmadas → "No reportado". Nunca inventar cifras.

4. fuente_link: Si conoces la URL del reporte anual o noticia, incluirla. Si no la conoces con certeza → "No disponible". NUNCA inventar URLs.

5. motivo_descarte: 1 frase concisa, máximo 160 caracteres. Solo si radar_activo="No".

RESPONDE SOLO con JSON válido sin markdown. Schema exacto:
{"empresa_evaluada":"string","radar_activo":"Sí"|"No","linea_negocio":"string|null","tipo_senal":"CAPEX Confirmado|Expansión / Nueva Planta|Expansión / Nuevo Centro de Distribución|Expansión / Nuevo Aeropuerto o Terminal|Licitación|Ampliación Capacidad|Modernización / Retrofit|Señal Temprana|Sin Señal","pais":"string","empresa_o_proyecto":"string","descripcion_resumen":"mín 80 palabras si Sí, mín 60 si No","criterios_cumplidos":["array","de","strings"],"total_criterios":0,"ventana_compra":"string","monto_inversion":"string","fuente_link":"string","fuente_nombre":"string","fecha_senal":"DD/MM/AAAA o No disponible","evaluacion_temporal":"🔴 Descarte|🟡 Ambiguo|🟢 Válido","observaciones":null,"motivo_descarte":""}`;
}

// Gemini uses identical system prompt text as OpenAI
function buildGeminiSystemPrompt(today: string): string {
  return buildOpenAISystemPrompt(today);
}

// ──────────────────────────────────────────────────────────────────────────────
// User message template (same shape for all providers — variables highlighted)
// ──────────────────────────────────────────────────────────────────────────────

function buildUserMessageTemplate(provider: string): string {
  const base = `Empresa: {empresa}
País: {pais}
Línea de negocio: {linea}`;

  if (provider === 'claude') {
    return `${base}

Ejecuta 3-5 búsquedas web para encontrar señales de inversión futura de esta empresa en LATAM.`;
  }
  return `${base}

Analiza si esta empresa tiene señales de inversión futura relevantes para las líneas de negocio de Matec en LATAM para el período 2026-2028. Usa tu conocimiento de la empresa, su sector y sus planes declarados de expansión.`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Provider metadata
// ──────────────────────────────────────────────────────────────────────────────

const PROVIDER_META: Record<
  string,
  {
    model: string;
    price_input_per_m: number;
    price_output_per_m: number;
    supports_web_search: boolean;
    supports_prompt_caching: boolean;
    description: string;
  }
> = {
  claude: {
    model:                   'claude-sonnet-4-6',
    price_input_per_m:       3.0,
    price_output_per_m:      15.0,
    supports_web_search:     true,
    supports_prompt_caching: true,
    description:             'Best accuracy — executes 3-5 real web searches per company. Recommended for production scans.',
  },
  openai: {
    model:                   'gpt-4o',
    price_input_per_m:       2.5,
    price_output_per_m:      10.0,
    supports_web_search:     false,
    supports_prompt_caching: false,
    description:             'Reasoning from training data only. No real-time web search. Suitable for batch analysis with known companies.',
  },
  gemini: {
    model:                   'gemini-2.0-flash',
    price_input_per_m:       0.075,
    price_output_per_m:      0.30,
    supports_web_search:     false,
    supports_prompt_caching: false,
    description:             'Lowest cost per token. Fast throughput. Ideal for high-volume pre-screening before deeper Claude scans.',
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/radar-v2/prompt?provider=claude|openai|gemini
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = (req.nextUrl.searchParams.get('provider') ?? 'claude').toLowerCase();

  if (!PROVIDER_META[provider]) {
    return NextResponse.json(
      { error: `Unknown provider '${provider}'. Valid: claude, openai, gemini` },
      { status: 400 },
    );
  }

  const today = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  let systemPrompt: string;
  switch (provider) {
    case 'openai':  systemPrompt = buildOpenAISystemPrompt(today);  break;
    case 'gemini':  systemPrompt = buildGeminiSystemPrompt(today);  break;
    default:        systemPrompt = buildClaudeSystemPrompt(today);  break;
  }

  const userMessageTemplate = buildUserMessageTemplate(provider);
  const meta = PROVIDER_META[provider];

  return NextResponse.json({
    provider,
    model:                   meta.model,
    description:             meta.description,
    price_input_per_m:       meta.price_input_per_m,
    price_output_per_m:      meta.price_output_per_m,
    supports_web_search:     meta.supports_web_search,
    supports_prompt_caching: meta.supports_prompt_caching,
    system_prompt:           systemPrompt,
    user_message_template:   userMessageTemplate,
    today,
    // Token estimates — rough char/4 heuristic
    estimated_system_tokens: Math.ceil(systemPrompt.length / 4),
    estimated_user_tokens:   Math.ceil(userMessageTemplate.length / 4),
  });
}
