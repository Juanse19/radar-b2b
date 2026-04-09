/**
 * add_supabase_persist_wf01.js
 *
 * Adds 2 new nodes to WF01 "Agent 01 - Calificador v1.0" (ID: jDtdafuyYt8TXISl)
 * that persist each company + calificacion to Supabase matec_radar schema.
 *
 * Inserted AFTER "Code: Calcular Score + Tier" and BEFORE "Code: Prepare Excel Row".
 *
 * Applied: 2026-04-08
 * Branch: fix/wf03-v2
 *
 * New flow segment:
 *   Code: Calcular Score + Tier
 *     → Code: Build Supabase Persist (WF01)   [builds DO $$ SQL transaction]
 *     → HTTP: Supabase Persist Cal (WF01)      [POST to /pg/query]
 *     → Code: Prepare Excel Row
 *
 * SQL executed per company (DO $$ block):
 *   Step 1: INSERT INTO matec_radar.empresas ... ON CONFLICT (company_name_norm) DO UPDATE
 *   Step 2: INSERT INTO matec_radar.calificaciones (empresa_id, score_total, tier_calculado, ...)
 *
 * Tier mapping: ORO → 'A', MONITOREO → 'B', ARCHIVO → 'C' (tier_enum)
 */

// Node IDs assigned:
const NODE1_ID = 'wf01-sb-persist-code';
const NODE2_ID = 'wf01-sb-persist-http';

// Positions:
// Code: Calcular Score + Tier: [-1400, 300]
// Code: Build Supabase Persist (WF01): [-1180, 300]
// HTTP: Supabase Persist Cal (WF01): [-960, 300]
// Code: Prepare Excel Row: [1200, 300]

const SUPABASE_URL = 'https://supabase.valparaiso.cafe';
const SUPABASE_ENDPOINT = `${SUPABASE_URL}/pg/query`;

// The Code node JS (runOnceForEachItem)
const CODE_NODE_JS = `
// Persist empresa + calificacion to Supabase matec_radar schema
// Single DO $$ transaction: upsert empresa → get id → insert calificacion
const d = $input.item.json;

const empresa    = (d.empresa || d.company_name || '').replace(/'/g, "''");
const dominio    = d.company_domain || d.dominio || null;
const paisNombre = d.pais || null;
const ciudad     = d.ciudad || null;

const scoreCal   = Number(d.score_calificacion || d.score_total || 0);
const tier       = d.tier || 'ARCHIVO';
const linea      = d.linea_negocio || d.linea || '';

const seg        = d.segmentacion || {};
const razon      = d.razonamiento_agente || null;
const anioObj    = seg.anio_objetivo    || d.anio_objetivo    || null;
const ticketRaw  = seg.ticket_estimado  || d.ticket_estimado  || null;

// Map WF01 tier string → tier_enum
const TIER_MAP   = { 'ORO': 'A', 'MONITOREO': 'B', 'ARCHIVO': 'C' };
const tierEnum   = TIER_MAP[tier] || 'C';

// Safe SQL escape helpers
const esc = v =>
  (v === null || v === undefined || v === '')
    ? 'NULL'
    : \`'\${String(v).replace(/'/g, "''")}'\`;

const num = v => {
  const n = parseInt(v, 10);
  return (!v || isNaN(n)) ? 'NULL' : n;
};

const sql = \`
DO $$
DECLARE
  _emp_id BIGINT;
BEGIN
  -- Step 1: upsert empresa
  INSERT INTO matec_radar.empresas (company_name, company_domain, pais_nombre, ciudad)
  VALUES (\${esc(empresa)}, \${esc(dominio)}, \${esc(paisNombre)}, \${esc(ciudad)})
  ON CONFLICT (company_name_norm) DO UPDATE
    SET company_domain = COALESCE(EXCLUDED.company_domain, matec_radar.empresas.company_domain),
        pais_nombre    = COALESCE(EXCLUDED.pais_nombre,    matec_radar.empresas.pais_nombre),
        updated_at     = NOW()
  RETURNING id INTO _emp_id;

  -- Step 2: insert calificacion
  INSERT INTO matec_radar.calificaciones
    (empresa_id, score_total, tier_calculado, razonamiento_agente,
     anio_objetivo, rango_ticket, prompt_version, modelo_llm)
  VALUES
    (_emp_id,
     \${num(scoreCal)},
     \${esc(tierEnum)}::matec_radar.tier_enum,
     \${esc(razon)},
     \${num(anioObj)},
     \${esc(ticketRaw)},
     'wf01-v1.0',
     'gpt-4.1-mini');
END;
$$;
\`.trim();

return [{ json: { ...d, _supabase_sql: sql } }];
`.trim();

// HTTP node sends the built SQL to Supabase pg/query
// Headers use the SUPABASE_SERVICE_ROLE_KEY hardcoded (read from .env.local)
// jsonBody uses n8n expression: ={{ ({ "query": $json._supabase_sql }) }}
