/**
 * POST /api/radar/chat — Modo Chat del RADAR (v5).
 *
 * Body: { question: string, provider?: 'claude' | 'openai' | 'gemini' }
 *
 * Respuesta JSON:
 *   {
 *     interpreted: { mode, linea, empresa, paises, keywords },
 *     mode_used: 'señales' | 'empresa' | 'chat',
 *     // Cuando mode_used = 'señales' y la query era ejecutable,
 *     // se forwardea a /api/radar/scan-signals y se incluye `signals[]`.
 *     // Cuando mode_used = 'chat', se devuelve un mensaje informativo
 *     // (sin ejecutar scan) — el cliente puede pedir clarificación.
 *     message: string,
 *     signals?: Array<...>
 *   }
 *
 * Esta primera iteración es sincrónica (sin SSE streaming). El streaming
 * se agregará cuando se valide la latencia con usuarios reales.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { interpretChat } from '@/lib/radar/chatInterpreter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RawBody {
  question?: unknown;
  provider?: unknown;
}

export async function POST(req: NextRequest) {
  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.question !== 'string' || !body.question.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const provider =
    body.provider === 'claude' || body.provider === 'openai' || body.provider === 'gemini'
      ? body.provider
      : 'claude';

  const interpreted = interpretChat(body.question);

  // Si no se detectó línea, no podemos disparar scan — pedir clarificación
  if (!interpreted.linea) {
    return NextResponse.json({
      interpreted,
      mode_used: 'chat',
      message:
        'No detecté línea de negocio. Probá especificarla — por ejemplo: ' +
        '"licitaciones BHS Chile", "CAPEX cartón México", "expansión intralogística Colombia".',
    });
  }

  if (interpreted.mode === 'señales') {
    // Forward a /api/radar/scan-signals
    const url = new URL('/api/radar/scan-signals', req.nextUrl.origin);
    const cookie = req.headers.get('cookie') ?? '';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        linea_negocio: interpreted.linea,
        paises:        interpreted.paises.length ? interpreted.paises : ['Colombia'],
        keywords:      interpreted.keywords,
        fuentes:       [],
        provider,
        max_senales:   8,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return NextResponse.json(
        {
          interpreted,
          mode_used: 'señales',
          message: `No pude ejecutar el scan: ${data?.error ?? `HTTP ${resp.status}`}`,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      interpreted,
      mode_used: 'señales',
      message:
        `Encontré ${data.total_senales ?? 0} señal${data.total_senales === 1 ? '' : 'es'} en ${interpreted.linea}` +
        (interpreted.paises.length ? ` (${interpreted.paises.join(', ')})` : '') +
        `. ${data.empresas_nuevas ?? 0} empresa${data.empresas_nuevas === 1 ? '' : 's'} nueva${data.empresas_nuevas === 1 ? '' : 's'}.`,
      signals:    data.signals,
      session_id: data.session_id,
      cost:       data.cost,
    });
  }

  // Modo empresa o chat libre — por ahora devolvemos resumen interpretado
  return NextResponse.json({
    interpreted,
    mode_used: interpreted.mode,
    message:
      interpreted.mode === 'empresa'
        ? `Detecté empresa: ${interpreted.empresa}. Modo empresa estará disponible próximamente vía /api/radar/chat — usá el wizard de Escanear por ahora.`
        : 'Pregunta interpretada como conversación. Para disparar un scan especificá línea y país.',
  });
}
