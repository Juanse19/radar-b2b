/**
 * lib/radar/signalsScan.ts — Modo Señales (v5).
 *
 * A diferencia del scan por empresa (anchored on `{empresa}`), el modo señales
 * pide al agente que descubra empresas con señales de inversión en una línea +
 * países dados. Reusa el system prompt RADAR vía buildSystemPrompt() y agrega
 * un preámbulo de "Sección 0" con el modo y filtros del usuario.
 *
 * Output esperado del agente (formato 10B):
 *   { "modo": "señales", "senales": [ { ... }, ... ] }
 */
import 'server-only';
import { fechaHoyES } from '@/lib/utils/parseFechaRadar';
import { buildSystemPrompt } from '@/lib/comercial/providers/shared-prompt';
import {
  insertRadarSignal,
  findEmpresaByNormName,
  insertEmpresaFromSignal,
  type SignalFuente,
  type NivelConfianza,
} from '@/lib/db/supabase/radar_signals';
import { updateSignalEmbedding, isRagPgvectorEnabled } from '@/lib/comercial/rag-pgvector';

export interface ScanSignalsInput {
  linea_negocio: string;
  sub_linea_id?: number | null;
  sub_linea?:    string | null;
  paises:        string[];
  keywords:      string[];
  fuentes:       SignalFuente[];
  provider:      'claude' | 'openai' | 'gemini';
  max_senales:   number;
  session_id?:   string | null;
}

export interface SenalRaw {
  empresa:           string;
  pais?:             string;
  linea_negocio?:    string;
  sub_linea?:        string;
  tipo_senal?:       string;
  descripcion?:      string;
  ventana_compra?:   string;
  nivel_confianza?:  NivelConfianza;
  monto_inversion?:  string;
  fuentes?:          SignalFuente[];
  score_radar?:      number;
}

export interface PersistedSignal {
  id:               string;
  empresa_id:       number | null;
  empresa_nombre:   string;
  empresa_es_nueva: boolean;
  tipo_senal:       string | null;
  descripcion:      string | null;
  ventana_compra:   string | null;
  nivel_confianza:  NivelConfianza | null;
  pais:             string | null;
}

export interface ScanSignalsResult {
  session_id:        string | null;
  total_senales:     number;
  empresas_nuevas:   number;
  signals:           PersistedSignal[];
  resumen_busqueda:  string;
}

// ---------------------------------------------------------------------------
// Section 0 builder — inyectado en el system prompt antes de las búsquedas
// ---------------------------------------------------------------------------

export function buildSignalsSeccion0(input: ScanSignalsInput): string {
  const fuentesStr = input.fuentes.length
    ? input.fuentes.map((f) => `${f.nombre} (${f.url})${f.peso ? ` peso=${f.peso}` : ''}`).join('; ')
    : 'libre';

  return `\n\n=== MODO: SEÑALES ===
Fecha de hoy: ${fechaHoyES()}
Línea de negocio: ${input.linea_negocio}${input.sub_linea ? ` · Sub-línea: ${input.sub_linea}` : ''}
Países objetivo: ${input.paises.join(', ')}
Keywords prioritarias: ${input.keywords.join(', ')}
Fuentes preferidas: ${fuentesStr}
Máximo de señales a devolver: ${input.max_senales}

⚠️ INSTRUCCIONES MODO SEÑALES (override de las queries por empresa):
- NO partas de una empresa específica: descubrí empresas con señales activas en la línea + países dados.
- Cada señal debe tener empresa, país, descripción, ventana_compra, nivel_confianza (ALTA/MEDIA/BAJA), fuentes verificables.
- Aplican las MISMAS reglas anti-alucinación, filtros temporales y lista de descarte del prompt RADAR.
- Devolvé EXACTAMENTE este JSON (sin texto antes ni después):
{
  "modo": "señales",
  "senales": [
    {
      "empresa": "Nombre",
      "pais": "Mexico",
      "linea_negocio": "${input.linea_negocio}",
      "sub_linea": "${input.sub_linea ?? ''}",
      "tipo_senal": "Licitación|CAPEX Confirmado|Expansión / Nueva Planta|...",
      "descripcion": "≥80 palabras con evidencia verificable",
      "ventana_compra": "0-6 Meses|6-12 Meses|...",
      "nivel_confianza": "ALTA|MEDIA|BAJA",
      "monto_inversion": "USD X millones | No reportado",
      "fuentes": [{"nombre":"SECOP II","url":"https://...","tipo":"oficial","peso":5}],
      "score_radar": 0-100
    }
  ],
  "resumen_busqueda": "1-2 frases sobre cobertura, keywords usadas y limitaciones"
}`;
}

// ---------------------------------------------------------------------------
// Parser tolerante del JSON 10B
// ---------------------------------------------------------------------------

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip ```json ... ``` fences si el provider las agrega.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Buscar el primer objeto JSON en el texto
    const m = candidate.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON found in agent response');
    return JSON.parse(m[0]);
  }
}

interface ParsedSignalsResponse {
  senales:           SenalRaw[];
  resumen_busqueda:  string;
}

export function parseSignalsResponse(rawText: string): ParsedSignalsResponse {
  const data = extractJson(rawText) as Record<string, unknown>;
  const senalesRaw = Array.isArray(data.senales) ? data.senales : [];
  const resumen = typeof data.resumen_busqueda === 'string' ? data.resumen_busqueda : '';

  const senales: SenalRaw[] = senalesRaw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      empresa:           String(s.empresa ?? '').trim(),
      pais:              s.pais ? String(s.pais) : undefined,
      linea_negocio:     s.linea_negocio ? String(s.linea_negocio) : undefined,
      sub_linea:         s.sub_linea ? String(s.sub_linea) : undefined,
      tipo_senal:        s.tipo_senal ? String(s.tipo_senal) : undefined,
      descripcion:       s.descripcion ? String(s.descripcion) : undefined,
      ventana_compra:    s.ventana_compra ? String(s.ventana_compra) : undefined,
      nivel_confianza:   normalizeConfianza(s.nivel_confianza),
      monto_inversion:   s.monto_inversion ? String(s.monto_inversion) : undefined,
      fuentes:           Array.isArray(s.fuentes) ? (s.fuentes as SignalFuente[]) : [],
      score_radar:       typeof s.score_radar === 'number' ? s.score_radar : undefined,
    }))
    .filter((s) => s.empresa.length > 0);

  return { senales, resumen_busqueda: resumen };
}

function normalizeConfianza(v: unknown): NivelConfianza | undefined {
  if (typeof v !== 'string') return undefined;
  const upper = v.trim().toUpperCase();
  if (upper === 'ALTA' || upper === 'MEDIA' || upper === 'BAJA') return upper;
  return undefined;
}

// ---------------------------------------------------------------------------
// Build the "system + user" prompt pair the providers consume
// ---------------------------------------------------------------------------

export function buildSignalsPrompt(input: ScanSignalsInput): {
  system: string;
  user:   string;
} {
  const baseSystem = buildSystemPrompt(input.linea_negocio);
  const seccion0 = buildSignalsSeccion0(input);
  return {
    system: baseSystem + seccion0,
    user: `Ejecutá la búsqueda de señales según la Sección 0. Devolvé únicamente el JSON definido.`,
  };
}

// ---------------------------------------------------------------------------
// Persist parsed signals — match empresa, insert placeholder if new
// ---------------------------------------------------------------------------

export async function persistSignals(
  parsed: ParsedSignalsResponse,
  input: ScanSignalsInput,
): Promise<PersistedSignal[]> {
  const persisted: PersistedSignal[] = [];

  for (const s of parsed.senales) {
    let empresa_id: number | null = null;
    let empresa_es_nueva = false;

    const match = await findEmpresaByNormName(s.empresa);
    if (match) {
      empresa_id = match.id;
    } else {
      empresa_id = await insertEmpresaFromSignal({
        company_name:  s.empresa,
        pais:          s.pais ?? null,
        linea_negocio: input.linea_negocio,
        sub_linea:     input.sub_linea ?? null,
      });
      empresa_es_nueva = true;
    }

    const row = await insertRadarSignal({
      session_id:       input.session_id ?? null,
      empresa_id,
      empresa_es_nueva,
      empresa_nombre:   s.empresa,
      pais:             s.pais ?? null,
      linea_negocio:    s.linea_negocio ?? input.linea_negocio,
      sub_linea:        s.sub_linea ?? input.sub_linea ?? null,
      tipo_senal:       s.tipo_senal ?? null,
      descripcion:      s.descripcion ?? null,
      ventana_compra:   s.ventana_compra ?? null,
      nivel_confianza:  s.nivel_confianza ?? null,
      monto_inversion:  s.monto_inversion ?? null,
      fuentes:          s.fuentes ?? [],
      score_radar:      s.score_radar ?? null,
      raw_json:         s,
    });

    persisted.push({
      id:               row.id,
      empresa_id,
      empresa_nombre:   row.empresa_nombre,
      empresa_es_nueva: row.empresa_es_nueva,
      tipo_senal:       row.tipo_senal ?? null,
      descripcion:      row.descripcion ?? null,
      ventana_compra:   row.ventana_compra ?? null,
      nivel_confianza:  row.nivel_confianza ?? null,
      pais:             row.pais ?? null,
    });

    // Generar embedding para el RAG pgvector (best-effort, no bloquea el flujo).
    if (isRagPgvectorEnabled() && row.descripcion) {
      void updateSignalEmbedding(row.id, `${row.empresa_nombre} ${row.descripcion}`);
    }
  }

  return persisted;
}
