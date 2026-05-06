import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getAgentPrompt } from '@/lib/db/supabase/agent-prompts';
import { buildSystemPrompt as buildMaoaSystemPrompt } from '@/lib/comercial/providers/shared-prompt';

// ──────────────────────────────────────────────────────────────────────────────
// Provider metadata — capabilities and pricing
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
    description:             'Mayor precisión — ejecuta 3-5 búsquedas web reales por empresa con multi-turn. Recomendado para producción.',
  },
  openai: {
    model:                   'gpt-4o-mini',
    price_input_per_m:       0.15,
    price_output_per_m:      0.60,
    supports_web_search:     true,
    supports_prompt_caching: false,
    description:             'Búsqueda web vía Responses API (web_search_preview). Alta velocidad y bajo costo para scans masivos.',
  },
  gemini: {
    model:                   'gemini-2.0-flash',
    price_input_per_m:       0.075,
    price_output_per_m:      0.30,
    supports_web_search:     true,
    supports_prompt_caching: false,
    description:             'Menor costo por token con Google Search grounding. Ideal para pre-screening de alto volumen.',
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// User message template (mismo para todos — variables resaltadas en el visor)
// ──────────────────────────────────────────────────────────────────────────────

function buildUserMessageTemplate(): string {
  return `Empresa: {empresa}
País: {pais}
Línea de negocio: {linea}

Ejecuta los 4 pasos de la metodología MAOA para detectar señales de inversión futura de esta empresa en LATAM 2026-2028.`;
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/comercial/prompt?provider=claude|openai|gemini
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

  const todayDate = new Date();
  const today = todayDate.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  // Pass `undefined` for line (visor preview is line-agnostic) and the Date for recency.
  const hardcodedPrompt = buildMaoaSystemPrompt(undefined, todayDate);

  let systemPrompt = hardcodedPrompt;
  let isDbOverride = false;
  try {
    const dbOverride = await getAgentPrompt(provider);
    if (dbOverride) {
      systemPrompt = dbOverride;
      isDbOverride = true;
    }
  } catch { /* DB unavailable — serve hardcoded prompt */ }

  const userMessageTemplate = buildUserMessageTemplate();
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
    is_db_override:          isDbOverride,
    is_admin:                session.role === 'ADMIN',
    estimated_system_tokens: Math.ceil(systemPrompt.length / 4),
    estimated_user_tokens:   Math.ceil(userMessageTemplate.length / 4),
  });
}
