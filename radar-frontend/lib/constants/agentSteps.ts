// lib/constants/agentSteps.ts
//
// Mapping from raw n8n node names → friendly labels (in Spanish) that we
// surface in the UI as `current_step`. We don't want to leak internal node
// IDs to the user. The keys come from inspecting `exec.data.resultData.runData`
// in n8n: each node leaves a key with its display name (e.g. "Tavily Search",
// "Code: Parse Input", "Loop Over Items1").
//
// Lookup is case-insensitive and uses substring matching, so a workflow change
// that renames "Tavily Search" → "Tavily search v2" still resolves to the same
// label. The order matters — first match wins, so put the most specific
// patterns first.

interface StepRule {
  /** Substring (lowercased) to look for inside the node name. */
  match: string;
  /** Human-readable label shown in the tracker. */
  label: string;
}

const STEP_RULES: StepRule[] = [
  // ── Generic n8n control-flow nodes (skipped — never surfaced) ─────────────
  { match: 'webhook',              label: 'Recibiendo solicitud' },
  { match: 'respond to webhook',   label: 'Respondiendo' },

  // ── WF01 — Calificador ────────────────────────────────────────────────────
  { match: 'parse input',          label: 'Leyendo empresas' },
  { match: 'fetch companies',      label: 'Buscando empresas en GSheets' },
  { match: 'gsheets read',         label: 'Leyendo Google Sheets' },
  { match: 'tavily search',        label: 'Buscando perfil con Tavily' },
  { match: 'tavily',               label: 'Buscando información en Tavily' },
  { match: 'format profile',       label: 'Formateando perfil' },
  { match: 'ai segmentation',      label: 'Calificando con GPT-4' },
  { match: 'agent qualification',  label: 'Calificando con GPT-4' },
  { match: 'openai model',         label: 'Calificando con GPT-4' },
  { match: 'score tier',           label: 'Calculando score y tier' },
  { match: 'compute score',        label: 'Calculando score y tier' },
  { match: 'log sheets',           label: 'Escribiendo log en Sheets' },
  { match: 'log gsheets',          label: 'Escribiendo log en Sheets' },
  { match: 'append sheet',         label: 'Escribiendo log en Sheets' },
  { match: 'if score',             label: 'Decidiendo si pasa al Radar' },

  // ── WF02 — Radar ──────────────────────────────────────────────────────────
  { match: 'parse wf01',           label: 'Leyendo input del Calificador' },
  { match: 'construir query',      label: 'Construyendo búsqueda' },
  { match: 'tavily dual',          label: 'Buscando señales en fuentes oficiales' },
  { match: 'filtro menciones',     label: 'Filtrando menciones' },
  { match: 'agent radar',          label: 'Detectando señal con GPT-4o' },
  { match: 'radar1',               label: 'Detectando señal con GPT-4o' },
  { match: 'validador',            label: 'Validando señal' },
  { match: 'composite score',      label: 'Calculando score compuesto' },
  { match: 'normalize',            label: 'Normalizando salida' },
  { match: 'pinecone',             label: 'Indexando en Pinecone' },
  { match: 'gsheets append',       label: 'Escribiendo señal en Sheets' },
  { match: 'gmail',                label: 'Notificando alerta ORO' },
  { match: 'if tier',              label: 'Decidiendo si pasa al Prospector' },

  // ── WF03 — Prospector ─────────────────────────────────────────────────────
  { match: 'apollo people',        label: 'Buscando contactos en Apollo' },
  { match: 'apollo search',        label: 'Buscando contactos en Apollo' },
  { match: 'apollo',               label: 'Consultando Apollo.io' },
  { match: 'build apollo query',   label: 'Construyendo query Apollo' },
  { match: 'expand rows',          label: 'Expandiendo contactos' },
  { match: 'filter format',        label: 'Filtrando contactos' },
  { match: 'dedup',                label: 'Deduplicando contactos' },

  // ── Iteración común ───────────────────────────────────────────────────────
  { match: 'loop over',            label: 'Procesando empresas' },
  { match: 'split in batches',     label: 'Procesando empresas' },
];

/**
 * Translate an n8n node name to a friendly label.
 * Falls back to the original node name if no rule matches, but with
 * underscores normalized to spaces and capitalized.
 */
export function stepLabelForNode(nodeName: string): string {
  if (!nodeName) return '';
  const lowered = nodeName.toLowerCase();
  for (const rule of STEP_RULES) {
    if (lowered.includes(rule.match)) return rule.label;
  }
  // Fallback: pretty-print the raw node name.
  return nodeName.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
