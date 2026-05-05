/**
 * validation.ts — Deterministic post-LLM validator for Agente 1 RADAR results.
 *
 * The MAOA prompt instructs the LLM to apply Section 3 discard rules (past-tense
 * verbs, "ya inaugurada", etc.). When the LLM ignores those rules, this validator
 * is the second line of defense: it runs over the parsed JSON and downgrades
 * stale or unsourced "Sí" results to "No" so that the UI never shows them.
 *
 * Reglas aplicadas (todas degradan radar_activo:"Sí" → "No"):
 *  R1. Verbos de pasado completivo en descripcion_resumen (Sección 3 MAOA).
 *  R2. fecha_senal anterior a (today − RECENCY_WINDOW_DAYS) sin frases de fase futura.
 *  R3. fuente_link con año vieja (/2024/, /2023/, /2022/) y sin fase futura.
 *  R4. empresa_evaluada no aparece en descripcion_resumen (Sección 6 MAOA).
 *
 * Si el resultado pasa todas las reglas pero total_criterios < 3 → 🟡 Ambiguo
 * (mantiene radar_activo:"Sí" pero la UI lo muestra con badge ámbar).
 */
import 'server-only';
import type { Agente1Result } from './schema';
import {
  PAST_TENSE_VERBS_REGEX,
  FUTURE_PHASE_HINTS_REGEX,
  RECENCY_WINDOW_DAYS,
} from './providers/shared-prompt';

const EVAL_DESCARTE = '🔴 Descarte';
const EVAL_AMBIGUO  = '🟡 Ambiguo';
const EVAL_VALIDO   = '🟢 Válido';

const OLD_URL_YEAR_REGEX = /\/(?:2019|2020|2021|2022|2023|2024)\//;

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Parses a DD/MM/AAAA date string. Returns null for "No disponible" or invalid.
 */
function parseFechaSenal(raw: string): Date | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Validates an Agente1Result and returns a (possibly mutated) copy with a
 * coherent radar_activo / motivo_descarte / evaluacion_temporal triple.
 *
 * Pure function: input is not mutated.
 */
export function validateAgente1Result(
  result: Agente1Result,
  today: Date = new Date(),
): Agente1Result {
  const cutoff = new Date(today.getTime() - RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // We only run hard checks when the LLM said "Sí". A "No" already passed.
  if (result.radar_activo === 'No') {
    const out = { ...result };
    if (!out.evaluacion_temporal) out.evaluacion_temporal = EVAL_DESCARTE;
    return out;
  }

  const desc = result.descripcion_resumen ?? '';
  const url = result.fuente_link ?? '';
  const fecha = parseFechaSenal(result.fecha_senal ?? '');
  const hasFutureHint = FUTURE_PHASE_HINTS_REGEX.test(desc);

  // R1: past-tense completivo verbs in descripcion_resumen
  if (PAST_TENSE_VERBS_REGEX.test(desc) && !hasFutureHint) {
    return downgrade(result, 'Obra ya inaugurada/operando antes de la ventana de recencia.');
  }

  // R2: fecha_senal older than cutoff and no future phase mentioned
  if (fecha && fecha < cutoff && !hasFutureHint) {
    const cutoffStr = cutoff.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return downgrade(result, `Fuente con fecha ${result.fecha_senal} fuera de ventana de recencia (corte ${cutoffStr}) sin fase futura documentada.`);
  }

  // R3: URL with old year path AND no future hint
  if (OLD_URL_YEAR_REGEX.test(url) && !hasFutureHint) {
    return downgrade(result, 'Fuente con URL anterior a ventana de recencia y sin fase futura documentada.');
  }

  // R4: empresa_evaluada must appear in descripcion_resumen (Sección 6)
  const empresaNorm = normalize(result.empresa_evaluada ?? '');
  const descNorm = normalize(desc);
  if (empresaNorm && !descNorm.includes(empresaNorm)) {
    // Allow partial match: the first word of the company name (e.g. "Grupo UMA" → "uma")
    const lastWord = empresaNorm.split(/\s+/).pop() ?? '';
    if (lastWord.length < 4 || !descNorm.includes(lastWord)) {
      return downgrade(result, `Empresa "${result.empresa_evaluada}" no mencionada explícitamente en la fuente.`);
    }
  }

  // Passed hard checks. Decide between 🟢 Válido and 🟡 Ambiguo.
  const evaluacion = (result.total_criterios ?? 0) < 3 ? EVAL_AMBIGUO : EVAL_VALIDO;
  return {
    ...result,
    evaluacion_temporal: evaluacion,
  };
}

function downgrade(result: Agente1Result, motivo: string): Agente1Result {
  return {
    ...result,
    radar_activo: 'No',
    motivo_descarte: motivo,
    evaluacion_temporal: EVAL_DESCARTE,
  };
}
