// app/api/admin/prompts/route.ts
// Read and update editable AI system prompts per provider
// Requires ADMIN session — layout-level guard in app/admin/layout.tsx plus explicit check here
import { NextResponse } from 'next/server';
import { getAgentPrompt, upsertAgentPrompt } from '@/lib/db/supabase/agent-prompts';
import { getCurrentSession } from '@/lib/auth/session';

const VALID_PROVIDERS = ['claude', 'openai', 'gemini'] as const;
type ValidProvider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(v: unknown): v is ValidProvider {
  return VALID_PROVIDERS.includes(v as ValidProvider);
}

// ── GET /api/admin/prompts?provider=claude|openai|gemini ─────────────────────
export async function GET(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `provider debe ser: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 },
      );
    }

    const systemPrompt = await getAgentPrompt(provider);
    return NextResponse.json({ provider, system_prompt: systemPrompt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── PUT /api/admin/prompts ───────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { provider, system_prompt } = body as Record<string, unknown>;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `provider debe ser: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 },
      );
    }

    if (typeof system_prompt !== 'string' || system_prompt.trim().length < 100) {
      return NextResponse.json(
        { error: 'system_prompt debe ser un string de al menos 100 caracteres' },
        { status: 400 },
      );
    }

    await upsertAgentPrompt(provider, system_prompt.trim(), session.email);
    return NextResponse.json({ ok: true, provider });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
