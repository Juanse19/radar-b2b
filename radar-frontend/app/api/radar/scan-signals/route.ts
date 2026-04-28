/**
 * POST /api/radar/scan-signals — Modo Señales (v5).
 *
 * Contrato:
 *   {
 *     linea_negocio: string,
 *     sub_linea_id?: number,
 *     sub_linea?:    string,
 *     paises:        string[],
 *     keywords:      string[],
 *     fuentes:       Array<{nombre, url, tipo?, peso?}>,
 *     provider:      'claude' | 'openai' | 'gemini',
 *     max_senales:   number  // default 10
 *   }
 *
 * Implementación inicial: solo provider='claude' (multi-turn web_search).
 * OpenAI/Gemini se delegarán en una segunda iteración (S2 follow-up).
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createRadarV2Session } from '@/lib/comercial/db';
import { getCurrentSession } from '@/lib/auth/session';
import {
  buildSignalsPrompt,
  parseSignalsResponse,
  persistSignals,
  type ScanSignalsInput,
} from '@/lib/radar/signalsScan';
import { runClaudeWebSearch } from '@/lib/radar/claudeWebSearchClient';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // multi-turn web search puede tardar

interface RawBody {
  linea_negocio?: unknown;
  sub_linea_id?:  unknown;
  sub_linea?:     unknown;
  paises?:        unknown;
  keywords?:      unknown;
  fuentes?:       unknown;
  provider?:      unknown;
  max_senales?:   unknown;
}

function validateInput(body: RawBody): ScanSignalsInput | { error: string } {
  if (typeof body.linea_negocio !== 'string' || !body.linea_negocio.trim()) {
    return { error: 'linea_negocio is required' };
  }
  if (!Array.isArray(body.paises) || body.paises.length === 0) {
    return { error: 'paises must be a non-empty array' };
  }
  const keywords = Array.isArray(body.keywords) ? body.keywords.map(String).filter(Boolean) : [];
  const fuentes  = Array.isArray(body.fuentes)
    ? (body.fuentes as Array<Record<string, unknown>>).map((f) => ({
        nombre: String(f.nombre ?? ''),
        url:    String(f.url ?? ''),
        tipo:   f.tipo ? String(f.tipo) : undefined,
        peso:   typeof f.peso === 'number' ? f.peso : undefined,
      })).filter((f) => f.nombre && f.url)
    : [];

  const provider =
    body.provider === 'claude' || body.provider === 'openai' || body.provider === 'gemini'
      ? body.provider
      : 'claude';

  const max_senales = Math.min(Math.max(Number(body.max_senales ?? 10), 1), 25);

  return {
    linea_negocio: body.linea_negocio.trim(),
    sub_linea_id:  typeof body.sub_linea_id === 'number' ? body.sub_linea_id : null,
    sub_linea:     typeof body.sub_linea === 'string' ? body.sub_linea : null,
    paises:        body.paises.map(String).filter(Boolean),
    keywords,
    fuentes,
    provider,
    max_senales,
  };
}

export async function POST(req: NextRequest) {
  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = validateInput(body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const input = validated;

  if (input.provider !== 'claude') {
    return NextResponse.json(
      { error: `Provider '${input.provider}' aún no soportado en Modo Señales — usá 'claude' por ahora.` },
      { status: 501 },
    );
  }

  // Crear sesión con modo='señales'
  const userSession = await getCurrentSession();
  let sessionId: string | null = null;
  try {
    const sess = await createRadarV2Session({
      user_id:        userSession?.id ?? null,
      linea_negocio:  input.linea_negocio,
      empresas_count: 0,
      modo:           'señales',
      provider:       input.provider,
    });
    sessionId = sess.id;
  } catch (err) {
    // No bloqueamos el scan si la BD no está disponible
    console.error('[scan-signals] createRadarV2Session failed:', err);
  }

  // Construir y ejecutar prompt
  const { system, user } = buildSignalsPrompt({ ...input, session_id: sessionId });

  let runResult;
  try {
    runResult = await runClaudeWebSearch({ system, user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scan-signals] runClaudeWebSearch failed:', msg);
    return NextResponse.json({ error: `LLM call failed: ${msg}` }, { status: 502 });
  }

  // Parsear y persistir
  let parsed;
  try {
    parsed = parseSignalsResponse(runResult.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to parse agent response: ${msg}`, raw: runResult.text.slice(0, 500) },
      { status: 502 },
    );
  }

  let persisted;
  try {
    persisted = await persistSignals(parsed, { ...input, session_id: sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scan-signals] persistSignals failed:', msg);
    return NextResponse.json(
      { error: `Persist failed: ${msg}`, signals_parsed: parsed.senales.length },
      { status: 500 },
    );
  }

  const empresas_nuevas = persisted.filter((p) => p.empresa_es_nueva).length;
  const altaConfianza   = persisted.filter((p) => p.nivel_confianza === 'ALTA');

  // Notificaciones: una por señal ALTA + resumen del scan
  await Promise.all([
    ...altaConfianza.map((s) =>
      createNotification({
        user_id: userSession?.id ?? null,
        tipo:    'scan_alta',
        titulo:  `Señal ALTA · ${s.empresa_nombre}`,
        mensaje: s.descripcion?.slice(0, 200) ?? null,
        link:    `/portfolio?q=${encodeURIComponent(s.empresa_nombre)}`,
        meta:    { signal_id: s.id, session_id: sessionId, tipo_senal: s.tipo_senal },
      }),
    ),
    createNotification({
      user_id: userSession?.id ?? null,
      tipo:    'scan_completado',
      titulo:  `Modo Señales · ${persisted.length} señales en ${input.linea_negocio}`,
      mensaje: `${altaConfianza.length} ALTA · ${empresas_nuevas} empresa${empresas_nuevas !== 1 ? 's' : ''} nueva${empresas_nuevas !== 1 ? 's' : ''}`,
      link:    `/portfolio${empresas_nuevas > 0 ? '?source=radar_signal' : ''}`,
      meta:    { session_id: sessionId, total: persisted.length },
    }),
  ]);

  return NextResponse.json({
    session_id:       sessionId,
    total_senales:    persisted.length,
    empresas_nuevas,
    signals:          persisted,
    resumen_busqueda: parsed.resumen_busqueda,
    cost: {
      tokens_input:  runResult.tokens_input,
      tokens_output: runResult.tokens_output,
      cost_usd:      runResult.cost_usd,
      search_calls:  runResult.search_calls,
      model:         runResult.model,
    },
  });
}
