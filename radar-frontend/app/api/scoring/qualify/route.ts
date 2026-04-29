/**
 * POST /api/scoring/qualify — endpoint v5 wrapper around the existing Calificador.
 *
 * A diferencia de /api/comercial/calificar (SSE, multi-empresa, streaming),
 * éste es un endpoint JSON sincrónico para una sola empresa. Útil para:
 *   - Botón "Calificar" del Portafolio
 *   - Re-calificación on-demand desde otras vistas
 *
 * Body:
 *   {
 *     empresa: string,
 *     pais:    string,
 *     linea:   string,                // nombre de línea
 *     subLineaId?: number,
 *     domain?: string,
 *     provider?: 'claude' | 'openai' | 'gemini',
 *     ragEnabled?: boolean,
 *   }
 *
 * Response:
 *   {
 *     scores, dimensiones?, scoreTotal, tier, razonamiento, perfilWeb,
 *     tokensInput, tokensOutput, costUsd, model
 *   }
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { calificarEmpresa } from '@/lib/comercial/calificador/engine';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import { getCurrentSession } from '@/lib/auth/session';
import { randomUUID } from 'crypto';

export const dynamic    = 'force-dynamic';
export const runtime    = 'nodejs';
export const maxDuration = 600;

interface RawBody {
  empresa?:    unknown;
  pais?:       unknown;
  linea?:      unknown;
  subLineaId?: unknown;
  domain?:     unknown;
  provider?:   unknown;
  ragEnabled?: unknown;
}

export async function POST(req: NextRequest) {
  const userSess = await getCurrentSession();
  if (!userSess) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.empresa !== 'string' || !body.empresa.trim()) {
    return NextResponse.json({ error: 'empresa is required' }, { status: 400 });
  }
  if (typeof body.pais !== 'string' || !body.pais.trim()) {
    return NextResponse.json({ error: 'pais is required' }, { status: 400 });
  }
  if (typeof body.linea !== 'string' || !body.linea.trim()) {
    return NextResponse.json({ error: 'linea is required' }, { status: 400 });
  }

  const provider =
    body.provider === 'claude' || body.provider === 'openai' || body.provider === 'gemini'
      ? body.provider
      : 'claude';

  try {
    const result = await calificarEmpresa(
      {
        empresa:        body.empresa.trim(),
        pais:           body.pais.trim(),
        lineaNombre:    body.linea.trim(),
        subLineaId:     typeof body.subLineaId === 'number' ? body.subLineaId : null,
        company_domain: typeof body.domain === 'string' ? body.domain : undefined,
        sessionId:      randomUUID(),
      },
      { providerName: provider, ragEnabled: body.ragEnabled !== false },
    );

    return NextResponse.json({
      ...result,
      tierLabel: TIER_LABEL[result.tier],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/scoring/qualify] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
