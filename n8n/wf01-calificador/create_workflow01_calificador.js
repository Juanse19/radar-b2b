/**
 * create_workflow01_calificador.js
 *
 * Crea el Workflow 01 - "Agent 01 - Calificador v1.0" en N8N.
 *
 * Este agente califica CADA empresa con un Score 0-10 ANTES de buscar inversión.
 * Proceso: Webhook → Loop → Buscar Perfil → AI Segmentación → Scoring → Log → IF ≥5 → Trigger WF02
 *
 * Uso:
 *   node create_workflow01_calificador.js [--dry-run]
 *
 * Nota: Actualiza WF02_WEBHOOK_URL después de crear el Workflow 02.
 */

const https = require('https');
const fs    = require('fs');

// ────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────
const N8N_HOST   = 'n8n.event2flow.com';
const API_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMjQ2MDAyLCJleHAiOjE3NzU3OTM2MDB9.20VW7drIMaclgZzRbbzl5q18iM6SJwB9c_brKA9jRxg';
const TAVILY_KEY = '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';

// Credenciales reutilizadas del workflow existente
const OPENAI_CRED   = { id: '21AmZDFfjIkvbK67', name: 'OpenAi account 3' };
const GSHEETS_CRED  = { id: 'Yv0pMNMe4juimTet', name: 'Google Sheets account 3' };
const GSHEETS_DOC   = '1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo';

// URL del webhook de WF02 — actualizar después de crear WF02
// Durante desarrollo usa la URL de test: /webhook-test/radar-scan
const WF02_WEBHOOK_URL = `https://${N8N_HOST}/webhook/radar-scan`;

const DRY_RUN = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────
// API HELPER
// ────────────────────────────────────────────────────────
function api(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: N8N_HOST,
      path: apiPath,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => {
        resolve({ status: r.statusCode, body: d });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ────────────────────────────────────────────────────────
// WORKFLOW DEFINITION
// ────────────────────────────────────────────────────────

// Positions (x, y) — left to right layout
const POS = {
  webhook:     [-3200, 300],
  parse:       [-2900, 300],
  loop:        [-2600, 300],
  buscarPerfil:[-2300, 300],
  formatProfile:[-2000, 300],
  aiSegm:      [-1700, 300],
  openaiSegm:  [-1700, 520],
  scoring:     [-1400, 300],
  logCalif:    [-1100, 300],
  ifScore:     [-800,  300],
  triggerRadar:[-500,  180],
};

const WORKFLOW = {
  name: 'Agent 01 - Calificador v1.0',
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    callerPolicy: 'workflowsFromSameOwner',
    errorWorkflow: ''
  },
  nodes: [
    // ─────────────────────────────────────────
    // 1. WEBHOOK TRIGGER
    // ─────────────────────────────────────────
    {
      id: 'wf01-webhook',
      name: 'Webhook Calificador',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: POS.webhook,
      parameters: {
        path: 'calificador',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        responseData: 'firstEntryJson'
      },
      webhookId: 'calificador-v1'
    },

    // ─────────────────────────────────────────
    // 2. CODE: PARSE COMPANIES FROM WEBHOOK
    // Expects: { empresas: [{empresa, pais, linea_negocio, tier, company_domain}] }
    // Or single: { empresa, pais, linea_negocio, tier }
    // ─────────────────────────────────────────
    {
      id: 'wf01-parse',
      name: 'Code: Parse Companies',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: POS.parse,
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Parse webhook input into an array of company items
const body = $input.all()[0].json;

// Accept array (batch) or single company
let empresas = body.empresas || body.companies || [];
if (!empresas.length && body.empresa) {
  empresas = [body];
}

if (!empresas.length) {
  throw new Error('No empresas found in webhook payload. Expected { empresas: [...] } or { empresa: "..." }');
}

return empresas.map(e => ({
  json: {
    empresa:        e.empresa       || e.company_name || '',
    pais:           e.pais          || e.country       || 'Colombia',
    linea_negocio:  e.linea_negocio || e.linea         || '',
    tier:           e.tier          || 'Tier B',
    company_domain: e.company_domain || e.domain || '',
    ciudad:         e.ciudad || '',
    keywords:       e.keywords || ''
  }
}));`
      }
    },

    // ─────────────────────────────────────────
    // 3. LOOP OVER ITEMS (batch=1)
    // ─────────────────────────────────────────
    {
      id: 'wf01-loop',
      name: 'Loop Over Items1',
      type: 'n8n-nodes-base.splitInBatches',
      typeVersion: 3,
      position: POS.loop,
      parameters: {
        batchSize: 1,
        options: {}
      }
    },

    // ─────────────────────────────────────────
    // 4. BUSCAR PERFIL EMPRESA (Tavily)
    // ─────────────────────────────────────────
    {
      id: 'wf01-buscar-perfil',
      name: 'Buscar Perfil Empresa',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.1,
      position: POS.buscarPerfil,
      continueOnFail: true,
      onError: 'continueRegularOutput',
      parameters: {
        method: 'POST',
        url: 'https://api.tavily.com/search',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'Authorization', value: `Bearer ${TAVILY_KEY}` },
            { name: 'Content-Type',  value: 'application/json' }
          ]
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ ({
  query: ($('Loop Over Items1').item.json.empresa || '') + ' ' + ($('Loop Over Items1').item.json.pais || '') + ' empleados sedes plantas presencia internacional grupo empresarial filiales inversión',
  search_depth: 'basic',
  include_answer: false,
  include_raw_content: false,
  max_results: 4,
  days: 3650
}) }}`,
        options: {}
      }
    },

    // ─────────────────────────────────────────
    // 5. CODE: FORMAT PROFILE RESULTS
    // Converts Tavily response → perfil_results string
    // ─────────────────────────────────────────
    {
      id: 'wf01-format-profile',
      name: 'Code: Format Profile',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: POS.formatProfile,
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// Format Tavily results into a readable profile string
const tavily = $input.item.json;
const empresa = $('Loop Over Items1').item.json;

const results = tavily.results || [];
const perfilResults = results.slice(0, 4)
  .map((r, i) => \`[P\${i}] \${r.title}\\n\${(r.content || r.snippet || '').substring(0, 400)}\`)
  .join('\\n\\n');

return {
  json: {
    // Pass through company fields
    empresa:        empresa.empresa        || '',
    pais:           empresa.pais           || '',
    linea_negocio:  empresa.linea_negocio  || '',
    tier:           empresa.tier           || 'Tier B',
    company_domain: empresa.company_domain || '',
    ciudad:         empresa.ciudad         || '',
    keywords:       empresa.keywords       || '',
    // Add profile results
    perfil_results: perfilResults || 'Sin resultados de perfil disponibles'
  }
};`
      }
    },

    // ─────────────────────────────────────────
    // 6. AI AGENT SEGMENTACIÓN CUALITATIVA
    // Adapted: no radar data (runs BEFORE radar)
    // ─────────────────────────────────────────
    {
      id: 'wf01-ai-segm',
      name: 'AI Agent Segmentación Cualitativa',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: POS.aiSegm,
      parameters: {
        promptType: 'define',
        text: `=━━ EMPRESA A CALIFICAR ━━
Nombre: {{ $json.empresa }}
País: {{ $json.pais }}
Línea Matec: {{ $json.linea_negocio }}
Tier asignado: {{ $json.tier }}

━━ PERFIL DE LA EMPRESA (resultados de búsqueda web) ━━
{{ $json.perfil_results }}

━━ INSTRUCCIÓN ━━
Clasifica esta empresa según las 7 dimensiones. Retorna ÚNICAMENTE el JSON sin texto adicional.`,
        options: {
          systemMessage: `Eres el Analista de Segmentación Comercial B2B de Matec S.A.S.
Tu misión: clasificar cada empresa en 7 dimensiones basándote en su perfil público y presencia en el mercado.
NO tienes datos de radar de inversión — clasifica solo con el perfil de la empresa.

━━ IMPACTO EN EL PRESUPUESTO ━━
Muy Alto: >10.000 empleados o multinacional con historial CAPEX importante
Alto: 2.000-10.000 empleados, presencia regional significativa
Medio: 500-2.000 empleados, inversiones moderadas
Bajo: <500 empleados, inversiones limitadas
Muy Bajo: empresa micro, sin historial relevante

━━ MULTIPLANTA ━━
Presencia internacional: opera en 3+ países o tiene planta/sede en extranjero
Varias sedes regionales: múltiples plantas en el mismo país (2+ ciudades)
Única sede: una sola ubicación

━━ RECURRENCIA ━━
Empresa grande con múltiples plantas → recurrencia alta (proyectos frecuentes de mantenimiento/expansión).
Muy Alto: multinacional con múltiples plantas | Alto: empresa grande regional | Medio: empresa mediana
Bajo: empresa pequeña | Muy Bajo: empresa micro

━━ REFERENTE DEL MERCADO ━━
Referente internacional: conocida globalmente (Bimbo, Smurfit, FEMSA, Avianca, etc.)
Referente país: líder reconocido en su país de origen
Baja visibilidad: empresa pequeña o poco conocida públicamente

━━ AÑO OBJETIVO ━━
Estima cuándo Matec podría venderles:
2026: empresa grande activa con necesidades inmediatas
2027: empresa mediana con planes de crecimiento
2028: empresa pequeña o sin señales claras
Sin año: empresa micro o sin información suficiente

━━ TICKET ESTIMADO ━━
Basado en el tamaño de la empresa y tipo de proyecto típico para esa línea:
Muy Alto: USD >5 millones | Alto: USD 1-5 millones | Medio: USD 500K-1M
Bajo: USD 100K-500K | Sin ticket: empresa muy pequeña o sin datos

━━ PRIORIDAD COMERCIAL ━━
Muy Alta: Tier A + empresa grande referente + año 2026
Alta: Tier A/B + empresa grande + año 2026-2027
Media: Tier B + empresa mediana + año 2027
Baja: Tier C o empresa pequeña
Muy Baja: Tier C + empresa micro + sin información

━━ ESQUEMA JSON (OBLIGATORIO — sin texto adicional) ━━
{
  "impacto_presupuesto": "Muy Alto | Alto | Medio | Bajo | Muy Bajo",
  "multiplanta": "Presencia internacional | Varias sedes regionales | Única sede",
  "recurrencia": "Muy Alto | Alto | Medio | Bajo | Muy Bajo",
  "referente_mercado": "Referente internacional | Referente país | Baja visibilidad",
  "anio_objetivo": "2026 | 2027 | 2028 | Sin año",
  "ticket_estimado": "USD X millones | Sin ticket",
  "prioridad_comercial": "Muy Alta | Alta | Media | Baja | Muy Baja"
}`,
          maxIterations: 1
        }
      }
    },

    // ─────────────────────────────────────────
    // 7. OPENAI CHAT MODEL (sub-node for AI Agent)
    // ─────────────────────────────────────────
    {
      id: 'wf01-openai-segm',
      name: 'OpenAI Chat Model Segm.',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.3,
      position: POS.openaiSegm,
      credentials: { openAiApi: OPENAI_CRED },
      parameters: {
        model: {
          __rl: true,
          value: 'gpt-4.1-mini',
          mode: 'list',
          cachedResultName: 'gpt-4.1-mini'
        },
        builtInTools: {},
        options: {
          maxTokens: 800,
          temperature: 0
        }
      }
    },

    // ─────────────────────────────────────────
    // 8. CODE: CALCULAR SCORE + ASIGNAR TIER
    // Weighted formula: 7 factors → Score 0-10
    // ─────────────────────────────────────────
    {
      id: 'wf01-scoring',
      name: 'Code: Calcular Score + Tier',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: POS.scoring,
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// ═══════════════════════════════════════════════
// SCORING CALIFICADOR — Formula ponderada 0-10
// ═══════════════════════════════════════════════

// Parse segmentation from AI Agent output
let seg = {};
const rawOutput = $json.output;
if (typeof rawOutput === 'string') {
  const match = rawOutput.match(/\\{[\\s\\S]*\\}/);
  if (match) {
    try { seg = JSON.parse(match[0]); } catch(e) { seg = {}; }
  }
} else if (rawOutput && typeof rawOutput === 'object') {
  seg = rawOutput;
}

// Company fields from earlier in the chain
const empresa = $('Loop Over Items1').item.json;

// ── Score mappings ─────────────────────────────
const IMPACTO_MAP = {
  'Muy Alto': 10, 'Alto': 8, 'Medio': 5, 'Bajo': 3, 'Muy Bajo': 1
};
const MULTIPLANTA_MAP = {
  'Presencia internacional': 10, 'Varias sedes regionales': 7, 'Única sede': 3, 'Unica sede': 3
};
const RECURRENCIA_MAP = {
  'Muy Alto': 10, 'Alto': 8, 'Medio': 5, 'Bajo': 3, 'Muy Bajo': 1
};
const REFERENTE_MAP = {
  'Referente internacional': 10, 'Referente país': 7, 'Referente pais': 7, 'Baja visibilidad': 3
};
const ANO_MAP = {
  '2026': 10, '2027': 7, '2028': 4, 'Sin año': 2, 'Sin ano': 2
};
const PRIORIDAD_MAP = {
  'Muy Alta': 10, 'Alta': 8, 'Media': 5, 'Baja': 3, 'Muy Baja': 1
};

// Ticket estimado score
function ticketScore(t) {
  if (!t || t === 'Sin ticket') return 1;
  const n = parseFloat((t || '').replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return 3;
  if (n > 5)  return 10;
  if (n >= 1) return 8;
  if (n >= 0.5) return 5;
  return 3;
}

// ── Weighted calculation ───────────────────────
// Weights sum to 100%
const weights = {
  impacto:    0.25,
  multiplanta: 0.15,
  recurrencia: 0.15,
  referente:   0.10,
  anio:        0.15,
  ticket:      0.10,
  prioridad:   0.10
};

const scores = {
  impacto:    IMPACTO_MAP[seg.impacto_presupuesto]  || 3,
  multiplanta: MULTIPLANTA_MAP[seg.multiplanta]      || 3,
  recurrencia: RECURRENCIA_MAP[seg.recurrencia]      || 3,
  referente:   REFERENTE_MAP[seg.referente_mercado]  || 3,
  anio:        ANO_MAP[seg.anio_objetivo]            || 2,
  ticket:      ticketScore(seg.ticket_estimado),
  prioridad:   PRIORIDAD_MAP[seg.prioridad_comercial]|| 3
};

const score = Math.round(
  Object.entries(weights).reduce((sum, [k, w]) => sum + scores[k] * w, 0)
);

// ── Tier assignment ────────────────────────────
let tier_calculado;
if (score >= 8)      tier_calculado = 'ORO';
else if (score >= 5) tier_calculado = 'MONITOREO';
else                 tier_calculado = 'ARCHIVO';

console.log(\`[Calificador] \${empresa.empresa} → Score: \${score} | Tier: \${tier_calculado}\`);

return {
  json: {
    // Company identity
    empresa:          empresa.empresa        || '',
    pais:             empresa.pais           || '',
    linea_negocio:    empresa.linea_negocio  || '',
    tier_original:    empresa.tier           || 'Tier B',
    company_domain:   empresa.company_domain || '',

    // Segmentation results (7 fields)
    'IMPACTO EN EL PRESUPUESTO': seg.impacto_presupuesto  || '',
    'MULTIPLANTA':               seg.multiplanta           || '',
    'RECURRENCIA':               seg.recurrencia           || '',
    'REFERENTE DEL MERCADO':     seg.referente_mercado     || '',
    'ANIO OBJETIVO':             seg.anio_objetivo         || '',
    'TICKET ESTIMADO':           seg.ticket_estimado       || 'Sin ticket',
    'PRIORIDAD COMERCIAL':       seg.prioridad_comercial   || '',

    // Scoring
    score_calificacion: score,
    tier_calculado:     tier_calculado,
    scores_detalle:     JSON.stringify(scores),

    // Metadata
    fecha_calificacion: new Date().toISOString().split('T')[0],
    wf01_version:       'v1.0'
  }
};`
      }
    },

    // ─────────────────────────────────────────
    // 9. LOG CALIFICACION (Google Sheets)
    // Tab: "Calificacion_Log" — crear manualmente en el sheet
    // ─────────────────────────────────────────
    {
      id: 'wf01-log-calificacion',
      name: 'Log Calificacion',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.7,
      position: POS.logCalif,
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: GSHEETS_CRED },
      parameters: {
        operation: 'append',
        documentId: {
          __rl: true,
          value: `https://docs.google.com/spreadsheets/d/${GSHEETS_DOC}`,
          mode: 'url'
        },
        sheetName: {
          __rl: true,
          value: 'gid=0',
          mode: 'list',
          cachedResultName: 'Calificacion_Log'
        },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true
        },
        options: {}
      }
    },

    // ─────────────────────────────────────────
    // 10. IF: SCORE >= 5 (trigger radar)
    // ─────────────────────────────────────────
    {
      id: 'wf01-if-score',
      name: 'IF: Score >= 5',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: POS.ifScore,
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'cond-score',
              leftValue: '={{ $json.score_calificacion }}',
              rightValue: 5,
              operator: { type: 'number', operation: 'gte' }
            }
          ],
          combinator: 'and'
        },
        options: {}
      }
    },

    // ─────────────────────────────────────────
    // 11. HTTP REQUEST: TRIGGER RADAR (WF02)
    // Only for companies with score >= 5
    // ─────────────────────────────────────────
    {
      id: 'wf01-trigger-radar',
      name: 'HTTP: Trigger Radar WF02',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.1,
      position: POS.triggerRadar,
      continueOnFail: true,
      onError: 'continueRegularOutput',
      parameters: {
        method: 'POST',
        url: WF02_WEBHOOK_URL,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ ({
  empresa:          $json.empresa,
  pais:             $json.pais,
  linea_negocio:    $json.linea_negocio,
  tier:             $json.tier_calculado,
  company_domain:   $json.company_domain,
  score_calificacion: $json.score_calificacion,
  keywords:         $json['PRIORIDAD COMERCIAL'],
  segmentacion: {
    impacto_presupuesto: $json['IMPACTO EN EL PRESUPUESTO'],
    multiplanta:         $json['MULTIPLANTA'],
    recurrencia:         $json['RECURRENCIA'],
    referente_mercado:   $json['REFERENTE DEL MERCADO'],
    anio_objetivo:       $json['ANIO OBJETIVO'],
    ticket_estimado:     $json['TICKET ESTIMADO'],
    prioridad_comercial: $json['PRIORIDAD COMERCIAL']
  }
}) }}`,
        options: {
          timeout: 5000
        }
      }
    }
  ],

  // ─────────────────────────────────────────────
  // CONNECTIONS
  // ─────────────────────────────────────────────
  connections: {
    'Webhook Calificador': {
      main: [[{ node: 'Code: Parse Companies', type: 'main', index: 0 }]]
    },
    'Code: Parse Companies': {
      main: [[{ node: 'Loop Over Items1', type: 'main', index: 0 }]]
    },
    'Loop Over Items1': {
      main: [[{ node: 'Buscar Perfil Empresa', type: 'main', index: 0 }]]
    },
    'Buscar Perfil Empresa': {
      main: [[{ node: 'Code: Format Profile', type: 'main', index: 0 }]]
    },
    'Code: Format Profile': {
      main: [[{ node: 'AI Agent Segmentación Cualitativa', type: 'main', index: 0 }]]
    },
    'OpenAI Chat Model Segm.': {
      ai_languageModel: [[{ node: 'AI Agent Segmentación Cualitativa', type: 'ai_languageModel', index: 0 }]]
    },
    'AI Agent Segmentación Cualitativa': {
      main: [[{ node: 'Code: Calcular Score + Tier', type: 'main', index: 0 }]]
    },
    'Code: Calcular Score + Tier': {
      main: [[{ node: 'Log Calificacion', type: 'main', index: 0 }]]
    },
    'Log Calificacion': {
      main: [[{ node: 'IF: Score >= 5', type: 'main', index: 0 }]]
    },
    'IF: Score >= 5': {
      main: [
        // output[0] = true (score >= 5) → trigger radar
        [{ node: 'HTTP: Trigger Radar WF02', type: 'main', index: 0 }],
        // output[1] = false (score < 5) → back to loop (ARCHIVO)
        [{ node: 'Loop Over Items1', type: 'main', index: 0 }]
      ]
    },
    'HTTP: Trigger Radar WF02': {
      // After triggering WF02, feed back to loop for next company
      main: [[{ node: 'Loop Over Items1', type: 'main', index: 0 }]]
    }
  }
};

// ────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Agent 01 - Calificador v1.0 — Creación en N8N');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin cambios)' : 'PRODUCCIÓN'}`);
  console.log(`Host: ${N8N_HOST}`);
  console.log(`WF02 Webhook: ${WF02_WEBHOOK_URL}`);
  console.log('');

  console.log('Nodes que se crearán:');
  WORKFLOW.nodes.forEach(n => console.log(`  • ${n.name} (${n.type})`));
  console.log('');

  if (DRY_RUN) {
    const out = 'C:/Users/Juan/Downloads/SubAgentes Matec/WorkFlows/workflow01_calificador_draft.json';
    require('fs').writeFileSync(out, JSON.stringify(WORKFLOW, null, 2), 'utf8');
    console.log('DRY RUN: workflow guardado en:', out);
    return;
  }

  // Create workflow via POST /api/v1/workflows
  console.log('Creando workflow en N8N...');
  const createRes = await api('POST', '/api/v1/workflows', WORKFLOW);
  if (createRes.status !== 200 && createRes.status !== 201) {
    console.error('ERROR al crear workflow:', createRes.status, createRes.body);
    process.exit(1);
  }

  const created = JSON.parse(createRes.body);
  console.log('');
  console.log('✅ Workflow creado exitosamente!');
  console.log(`   ID:     ${created.id}`);
  console.log(`   Nombre: ${created.name}`);
  console.log(`   URL:    https://${N8N_HOST}/workflow/${created.id}`);
  console.log('');

  // Save the created workflow to disk for reference
  const savedPath = 'C:/Users/Juan/Downloads/SubAgentes Matec/WorkFlows/workflow01_created.json';
  require('fs').writeFileSync(savedPath, JSON.stringify(created, null, 2), 'utf8');
  console.log(`   Guardado en: ${savedPath}`);
  console.log('');
  console.log('─────────────────────────────────────────────────');
  console.log('PRÓXIMOS PASOS:');
  console.log('1. Activar el workflow en N8N UI (toggle Active)');
  console.log('2. Crear tab "Calificacion_Log" en Google Sheets:');
  console.log(`   https://docs.google.com/spreadsheets/d/${GSHEETS_DOC}`);
  console.log('   Columnas: empresa | pais | linea_negocio | score_calificacion | tier_calculado');
  console.log('             IMPACTO EN EL PRESUPUESTO | MULTIPLANTA | RECURRENCIA');
  console.log('             REFERENTE DEL MERCADO | ANIO OBJETIVO | TICKET ESTIMADO | PRIORIDAD COMERCIAL');
  console.log('             fecha_calificacion');
  console.log('3. Cuando WF02 esté creado, actualizar WF02_WEBHOOK_URL en este script');
  console.log('   y re-ejecutar para actualizar el node "HTTP: Trigger Radar WF02"');
  console.log('─────────────────────────────────────────────────');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
