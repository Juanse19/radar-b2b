/**
 * lib/radar/chatInterpreter.ts — Interpreta una pregunta del usuario y la
 * convierte en parámetros estructurados para el RADAR.
 *
 * v5.1: usa Claude Haiku (claude-haiku-4-5) con tool_use para extracción
 * estructurada. Fallback a heurística regex si la API no está configurada
 * o falla.
 */
import 'server-only';
import { pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

export interface InterpretedQuery {
  mode:      'empresa' | 'señales' | 'chat';
  linea:     string | null;
  empresa:   string | null;
  paises:    string[];
  keywords:  string[];
  raw:       string;
  /** Cómo se interpretó: 'llm' (Haiku) o 'regex' (fallback). */
  source:    'llm' | 'regex';
}

const LINEAS = [
  { key: 'BHS',            patterns: [/bhs/i, /aeropuerto/i, /terminal/i, /carrusel/i, /equipaje/i] },
  { key: 'Cartón',         patterns: [/cart[óo]n/i, /papel/i, /corrugadora/i, /corrugado/i] },
  { key: 'Intralogística', patterns: [/intralog[íi]stica/i, /cedi/i, /wms/i, /ASRS/i, /almac[eé]n/i, /sortation/i, /log[íi]stica/i, /palletizador/i, /alimentos/i, /bebidas/i] },
];

const PAIS_MAP: Array<{ pais: string; patterns: RegExp[] }> = [
  { pais: 'Colombia',  patterns: [/colombia/i] },
  { pais: 'México',    patterns: [/m[ée]xico/i] },
  { pais: 'Chile',     patterns: [/chile/i] },
  { pais: 'Perú',      patterns: [/per[úu]/i] },
  { pais: 'Argentina', patterns: [/argentina/i] },
  { pais: 'Brasil',    patterns: [/brasil/i] },
  { pais: 'Panamá',    patterns: [/panam[áa]/i] },
];

const STOPWORDS = new Set([
  'busca', 'mostrame', 'cual', 'qué', 'que', 'hay', 'para', 'con', 'sin', 'algunas',
  'todas', 'recientes', 'señales', 'señal', 'invest', 'capex', 'inversión', 'inversion',
]);

// ─── Regex-based fallback ──────────────────────────────────────────────────

function detectLinea(text: string): string | null {
  for (const l of LINEAS) {
    if (l.patterns.some((p) => p.test(text))) return l.key;
  }
  return null;
}

function detectPaises(text: string): string[] {
  return PAIS_MAP.filter((p) => p.patterns.some((rx) => rx.test(text))).map((p) => p.pais);
}

function detectEmpresa(text: string): string | null {
  const m1 = text.match(/de\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñü\-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñü\-]*){0,3})/);
  if (m1) return m1[1].trim();
  const m2 = text.match(/"([^"]{2,80})"/);
  if (m2) return m2[1].trim();
  return null;
}

function detectMode(text: string, hasEmpresa: boolean): InterpretedQuery['mode'] {
  if (hasEmpresa) return 'empresa';
  if (/se[ñn]al|licitaci[óo]n|inversi[óo]n|capex|expansi[óo]n|nueva\s+planta/i.test(text)) {
    return 'señales';
  }
  return 'chat';
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[\s,]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 8);
}

function interpretRegex(text: string): InterpretedQuery {
  const linea = detectLinea(text);
  const paises = detectPaises(text);
  const empresa = detectEmpresa(text);
  const mode = detectMode(text, !!empresa);
  const keywords = extractKeywords(text);
  return { mode, linea, empresa, paises, keywords, raw: text, source: 'regex' };
}

// ─── LLM-based interpreter (Haiku) ─────────────────────────────────────────

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

async function getAnthropicKey(): Promise<string | undefined> {
  const env = process.env.CLAUDE_API_KEY?.trim();
  if (env) return env;
  try {
    const row = await pgFirst<{ api_key_enc: string }>(
      `SELECT api_key_enc FROM ${SCHEMA}.ai_provider_configs
       WHERE provider = ${pgLit('anthropic')} AND is_active = TRUE LIMIT 1`,
    );
    return row?.api_key_enc?.trim() || undefined;
  } catch {
    return undefined;
  }
}

const INTERPRET_TOOL = {
  name: 'extract_radar_query',
  description: 'Extrae los parámetros estructurados de una pregunta del usuario sobre el RADAR de inversión Matec.',
  input_schema: {
    type: 'object',
    required: ['mode', 'linea', 'empresa', 'paises', 'keywords'],
    properties: {
      mode: {
        type:        'string',
        enum:        ['empresa', 'señales', 'chat'],
        description: 'empresa = pregunta apunta a UNA empresa específica; señales = búsqueda libre por línea+países; chat = conversación general',
      },
      linea: {
        type:         ['string', 'null'],
        enum:         ['BHS', 'Cartón', 'Intralogística', null],
        description:  'Línea Matec mencionada o inferida. null si no aplica.',
      },
      empresa: {
        type:        ['string', 'null'],
        description: 'Nombre de la empresa si la pregunta es sobre una empresa específica. null si no aplica.',
      },
      paises: {
        type:        'array',
        items:       { type: 'string' },
        description: 'Países LATAM mencionados (Colombia, México, Chile, Perú, Argentina, Brasil, Panamá).',
      },
      keywords: {
        type:        'array',
        items:       { type: 'string' },
        description: 'Keywords clave del dominio (CAPEX, expansión, licitación, etc.). Máximo 8.',
      },
    },
  },
};

async function interpretWithHaiku(text: string, apiKey: string): Promise<InterpretedQuery | null> {
  const body = {
    model:      HAIKU_MODEL,
    max_tokens: 1024,
    tool_choice: { type: 'tool', name: 'extract_radar_query' },
    tools:      [INTERPRET_TOOL],
    system:     `Sos un parser de queries para el RADAR de inversión Matec. Tu tarea es extraer parámetros estructurados de la pregunta del usuario. Las 3 líneas Matec son: BHS (aeropuertos/terminales), Cartón (corrugado/papel), Intralogística (CEDI/WMS/Final de Línea/Solumat/Logística). Si el usuario menciona "Final de Línea" o "Solumat" o "Logística" → línea es Intralogística (son sub-líneas).`,
    messages:   [{ role: 'user', content: text }],
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
  };
  const tool = data.content?.find((b) => b.type === 'tool_use' && b.name === 'extract_radar_query');
  if (!tool?.input) return null;

  const inp = tool.input as {
    mode?:    string;
    linea?:   string | null;
    empresa?: string | null;
    paises?:  unknown[];
    keywords?: unknown[];
  };

  const mode =
    inp.mode === 'empresa' || inp.mode === 'señales' || inp.mode === 'chat'
      ? inp.mode : 'chat';
  const linea =
    inp.linea === 'BHS' || inp.linea === 'Cartón' || inp.linea === 'Intralogística'
      ? inp.linea : null;
  const paises  = Array.isArray(inp.paises)   ? inp.paises.map(String).filter(Boolean) : [];
  const keywords = Array.isArray(inp.keywords) ? inp.keywords.map(String).filter(Boolean).slice(0, 8) : [];
  const empresa = typeof inp.empresa === 'string' && inp.empresa.length > 0 ? inp.empresa : null;

  return { mode, linea, empresa, paises, keywords, raw: text, source: 'llm' };
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Interpreta una pregunta del usuario. Versión sincrónica (regex-only) —
 * preservada por backwards-compat para callers que no pueden esperar I/O.
 */
export function interpretChat(question: string): InterpretedQuery {
  return interpretRegex(question.trim());
}

/**
 * Interpreta usando Haiku con fallback a regex. Llamar desde route handlers
 * (server async). Más preciso que interpretChat() pero requiere CLAUDE_API_KEY
 * o fila activa en ai_provider_configs.
 */
export async function interpretChatLLM(question: string): Promise<InterpretedQuery> {
  const text = question.trim();
  const apiKey = await getAnthropicKey();
  if (apiKey) {
    try {
      const result = await interpretWithHaiku(text, apiKey);
      if (result) return result;
    } catch (err) {
      console.warn('[chatInterpreter] Haiku failed, falling back to regex:', err);
    }
  }
  return interpretRegex(text);
}
