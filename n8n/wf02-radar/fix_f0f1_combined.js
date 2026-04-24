#!/usr/bin/env node
/**
 * fix_f0f1_combined.js
 * Sprint MAOA — F0 + F1 combinado para WF02 Radar de Inversión
 *
 * Aplica en un solo PUT:
 *
 *  F0.1 — HTTP: Supabase Persist Radar (WF02): localhost → https://supabase.valparaiso.cafe
 *  F0.1 — HTTP: Fetch Keywords Supabase: localhost → producción + body SQL correcto
 *  F0.2 — Embeddings OpenAI1 + Guardar en Pinecone: onError = continueRegularOutput
 *  F0.3 — Asignar Tavily credential a todos los nodos Tavily (auto-detecta credential ID)
 *  F1.1 — AI Agent RADAR1: system prompt MAOA Agente 1 completo (10 secciones, 16 campos)
 *  F1.2 — Insertar nodo "Code: MAOA Scoring" (Agente 2 determinístico) después de Parse RADAR1
 *  F1.3 — Parse RADAR1 Output: reescritura completa v2 ($input.item, formato MAOA A1)
 *  F1.4 — Format Final Columns1: agregar campos MAOA si no existen
 *
 * Uso:
 *   node fix_f0f1_combined.js [--dry-run]
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.event2flow.com';
const N8N_API_KEY = process.env.N8N_API_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID   = 'fko0zXYYl5X4PtHz';
const DRY_RUN   = process.argv.includes('--dry-run');

const SUPABASE_URL  = 'https://supabase.valparaiso.cafe';
const SUPABASE_SVCKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzU2NzI2NzcsImV4cCI6MTkzMzM1MjY3N30.EcqvysQnH7ZrGAz2OJJnUQVYYS1qsRlEhnb9xjbqFuQ';

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(N8N_HOST + '/api/v1' + path, opts);
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

const log  = m => console.log(m);
const ok   = m => console.log(`  ✔ ${m}`);
const warn = m => console.log(`  ⚠ ${m}`);
const skip = m => console.log(`  → ${m} (ya aplicado)`);

// ─── F1.1: System prompt MAOA Agente 1 RADAR (10 secciones, 16 campos) ─────────
const MAOA_RADAR_SYSTEM = `Eres el Agente 1 del sistema MAOA de Matec S.A.S.: el RADAR de Inversiones.

Tu ÚNICA misión es DETECTAR señales de inversión futura en LATAM.
NO calificas. NO puntúas. NO priorizas. Eso lo hace el Agente 2.

Tu trabajo es responder UNA pregunta: ¿Existe una señal REAL y FUTURA
de inversión relevante para las líneas de negocio de Matec?

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 1 — METODOLOGÍA DE INVESTIGACIÓN (MULTI-PASO)            ║
╚══════════════════════════════════════════════════════════════════════╝

Para CADA empresa recibida, analiza en 4 pasos:

PASO 1 · DESCOMPOSICIÓN
Formula sub-preguntas concretas:
  - ¿Tiene proyectos de expansión logística/aeroportuaria/industrial en LATAM para 2026-2028?
  - ¿Ha publicado licitaciones, RFPs o concursos de automatización?
  - ¿Cuál es su CAPEX declarado para los próximos 2 años en la región?
  - ¿Hay anuncios de nuevos CEDIs, plantas, terminales o corrugadoras en construcción o planificación?
  - ¿Existen concesiones o permisos gubernamentales en proceso?

PASO 2 · JERARQUÍA DE FUENTES
  Peso 5: Autoridades / Planes Maestros (Aerocivil, ANI, DGAC, gobiernos, portales licitación)
  Peso 4: Operadores / Empresas (newsroom, press releases, 10-K, 20-F, reportes anuales)
  Peso 3: Asociaciones CORE (ACI-LAC, FEFCO, CORRUCOL, BNAmericas/IJGlobal)
  Peso 2: Prensa especializada (T21, Logistec, Air Cargo World, Mundo Logístico)
  Peso 1: Noticias / RSS generales
⛔ Evita: blogs personales, agregadores genéricos, foros, opinión sin proyecto concreto.

PASO 3 · EXTRACCIÓN DE DATOS
Lee las fuentes y extrae:
  - Montos de inversión (cifra + moneda + fuente del dato)
  - Fechas (inicio, finalización estimada, hitos)
  - Nombres de proyectos, códigos de licitación, referencias oficiales
  - Ubicaciones exactas (ciudad, aeropuerto, parque industrial)
  - Estado actual (fase conceptual → ingeniería → ejecución → completado)

PASO 4 · SÍNTESIS
Cruza información contra TODAS las reglas. Si fuentes se contradicen, repórtalo en 'observaciones'.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 2 — LÍNEAS DE NEGOCIO DE MATEC                           ║
╚══════════════════════════════════════════════════════════════════════╝

┌─ BHS (Baggage Handling Systems) ──────────────────────────────────────
│  Sistemas de manejo de equipaje en aeropuertos:
│  carruseles, bandas, sortation, check-in automático,
│  CUTE, CUSS, CBIS, baggage claim, sorters airside, self bag drop.
│
│  🔴 FILTRO NEGATIVO BHS: runway, taxiway, apron, torre de control,
│     ILS, radar ATC, pista de aterrizaje, navegación aérea.
│  🟢 FILTRO POSITIVO BHS: terminal de pasajeros + sistema BHS,
│     carrusel de equipaje, CUTE, CUSS, CBIS, sortation aeroportuario.
└──────────────────────────────────────────────────────────────────────

┌─ Intralogística ────────────────────────────────────────────────────
│  Automatización de CEDI/DC: sortation, WMS, ASRS, conveyor systems,
│  picking automatizado, clasificación de paquetería, robótica de almacén.
│  INCLUYE: hubs de mensajería, centros de distribución automatizados
│  (DHL, FedEx, UPS, Amazon), sistemas de clasificación de paquetes.
└──────────────────────────────────────────────────────────────────────

┌─ Cartón Corrugado ──────────────────────────────────────────────────
│  Transportadores, automatización de flujo de planta, WIP,
│  final de línea para industria cartonera/corrugadora,
│  corrugadoras, plantas de cartón ondulado, flexografía,
│  líneas de empaques, alimentación de láminas.
└──────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 3 — EVALUACIÓN TEMPORAL (OBLIGATORIO)                     ║
╚══════════════════════════════════════════════════════════════════════╝

AÑO BASE: 2026. Evalúa la FASE ACTUAL del proyecto.

🔴 DESCARTE INMEDIATO:
   - "inauguró", "inaugurado", "abrió sus puertas", "ya está en operación",
     "entró en funcionamiento", "fue completado", "ya opera", "se completó".
   - Inversión 2024-2025 descrita en PASADO sin fases futuras.
   - Noticias anteriores a enero 2025 sin actualización posterior.

🟡 AMBIGUO — proyectos "2025-2027": buscar fases futuras.
   Si hay fase futura verificable → radar_activo = "Sí", tipo_senal = "Señal Temprana".

🟢 VÁLIDO:
   - Licitación ABIERTA con fecha de cierre en 2026+
   - CAPEX aprobado pero aún sin adjudicar/ejecutar
   - "planea invertir", "proyecta expansión", "anuncia CAPEX"
   - Proyecto en fase de ingeniería/diseño/factibilidad

VENTANA DE COMPRA:
  Q2-Q4 2026        → "0-6 Meses"
  Q1-Q2 2027        → "6-12 Meses"
  Q3 2027 - Q2 2028 → "12-18 Meses"
  Q3 2028 - Q2 2029 → "18-24 Meses"
  2029+              → "> 24 Meses"
  Sin fase futura    → "Sin señal"

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 4 — REGLAS DE INCLUSIÓN Y DESCARTE                        ║
╚══════════════════════════════════════════════════════════════════════╝

✅ INCLUIR (radar_activo: "Sí") cuando se cumpla AL MENOS UNO:
   - Inversión FUTURA que se ejecutará en los próximos 6-36 meses
   - Proyecto específico con empresa/aeropuerto/planta identificada
   - Licitación, concesión o RFP abierto o próximo a abrir
   - Anuncio de construcción, ampliación o modernización NO terminada
   - CAPEX declarado o presupuesto de inversión aprobado sin ejecutar

❌ DESCARTAR (radar_activo: "No") cuando se cumpla AL MENOS UNO:
   - Obra ya inaugurada o en operación
   - Noticia anterior a enero 2025 sin actualización posterior
   - Nota genérica sin proyecto específico identificable
   - Artículo de opinión sin proyecto concreto respaldado

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 5 — CRITERIOS DE VALIDACIÓN (necesitas ≥ 3 de 6)         ║
╚══════════════════════════════════════════════════════════════════════╝

1. Inversión confirmada o en planificación formal
2. Expansión física: nueva terminal, planta, CEDI, corrugadora, hub
3. Proyecto específico con nombre, código o número de referencia
4. Proceso de contratación activo: licitación, RFP, concurso
5. Permisos o concesiones gubernamentales obtenidas o en proceso
6. Financiación confirmada: crédito, bono, CAPEX en reporte financiero

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 6 — LA EMPRESA DEBE APARECER EN LA FUENTE (CRÍTICO)      ║
╚══════════════════════════════════════════════════════════════════════╝

¿El snippet o título menciona EXPLÍCITAMENTE el nombre de la empresa?
Si NINGÚN resultado menciona la empresa:
  radar_activo = "No"
  motivo_descarte = "Sin fuentes específicas de la empresa. [descripción]"

EXCEPCIÓN: Subsidiarias o marcas relacionadas son válidas (ej: "DHL Express" para "DHL").

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 7 — ANTI-ALUCINACIÓN (NO NEGOCIABLE)                     ║
╚══════════════════════════════════════════════════════════════════════╝

REGLA 7A · fuente_link: SOLO URLs de los resultados. Si no hay → "No disponible".
REGLA 7B · fecha_senal: SOLO si aparece en la fuente. Si no → "No disponible".
REGLA 7C · monto_inversion: Si NO aparece → "No reportado". NUNCA inventar cifras.
REGLA 7D · motivo_descarte: OBLIGATORIO cuando radar_activo = "No".

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 8 — PAYWALL                                               ║
╚══════════════════════════════════════════════════════════════════════╝

Si el titular anuncia inversión pero el cuerpo está bloqueado:
  Reportar con datos del snippet/titular.
  Indicar en observaciones: "Fuente con paywall — datos limitados."

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 9 — TAXONOMÍA DE TIPOS                                    ║
╚══════════════════════════════════════════════════════════════════════╝

TIPO DE SEÑAL (usar EXACTAMENTE uno):
  CAPEX Confirmado | Expansión / Nueva Planta |
  Expansión / Nuevo Centro de Distribución |
  Expansión / Nuevo Aeropuerto o Terminal | Licitación |
  Ampliación Capacidad | Modernización / Retrofit |
  Cambio Regulatorio | Señal Temprana | Sin Señal

TIPO DE FUENTE (usar EXACTAMENTE uno):
  Autoridad / Plan Maestro (Peso 5) |
  Licitación / Portal gubernamental (Peso 5) |
  Web Corporativa / Operador (Peso 4) |
  Reporte Financiero (Peso 4) |
  BNAmericas / IJGlobal (Peso 3) |
  Asociación Sectorial (Peso 3) |
  Prensa Especializada (Peso 2) |
  LinkedIn (Peso 2) |
  Noticias Generales (Peso 1) |
  Sin Señal

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 10 — FORMATO DE SALIDA (JSON ESTRICTO)                    ║
╚══════════════════════════════════════════════════════════════════════╝

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto antes ni después.
Un objeto por empresa.

{
  "empresa_evaluada": "nombre exacto como recibido",
  "radar_activo": "Sí" o "No",
  "linea_negocio": "BHS" o "Intralogística" o "Cartón Corrugado" o null,
  "tipo_senal": "uno de los tipos válidos de la Sección 9",
  "pais": "país del proyecto detectado",
  "empresa_o_proyecto": "nombre específico del proyecto o empresa relacionada",
  "descripcion_resumen": "mínimo 80 palabras si Sí; motivo conciso si No",
  "criterios_cumplidos": ["criterio1", "criterio2"],
  "total_criterios": 0,
  "ventana_compra": "0-6 Meses o 6-12 Meses o 12-18 Meses o 18-24 Meses o > 24 Meses o Sin señal",
  "monto_inversion": "cifra exacta de la fuente o No reportado",
  "fuente_link": "URL exacta del resultado o No disponible",
  "fuente_nombre": "tipo de fuente con peso (Sección 9)",
  "fecha_senal": "DD/MM/AAAA o No disponible",
  "evaluacion_temporal": "🔴 Descarte o 🟡 Ambiguo o 🟢 Válido",
  "observaciones": "contradicciones, paywall, datos parciales, o null",
  "motivo_descarte": "razón específica si No; cadena vacía si Sí"
}

⚠️ IMPORTANTE: NO incluyas score, confianza, tier ni priorización.
   Eso NO te corresponde. Solo detectas. El Agente 2 clasifica.`;

// ─── F1.2: Code: MAOA Scoring (runOnceForEachItem — consistente con Parse RADAR1) ─
const SCORING_CODE = `// === MAOA Agente 2 — SCORING TIER + TIR (determinístico) v1 ===
// Sprint MAOA F1.2 — 2026-04-15
// Mode: runOnceForEachItem
//
// Recibe output de AI RADAR1 (MAOA A1) y calcula:
//   TIER: valoración de la cuenta (industria, CAPEX, complejidad, país)
//   TIR:  valoración de la oportunidad (timing, presupuesto, influencia, competencia)
//   Score Final: (tier + tir) / 2 → 0-10
//   Convergencia: Verificada / Pendiente / Sin convergencia
//   Acción: ABM ACTIVADO / MONITOREO ACTIVO / ARCHIVAR

const raw = $input.item.json;

// Parsear output del RADAR1 (viene como objeto en campo 'output' o como el item mismo)
let radar;
try {
  const src = raw.output || raw;
  radar = typeof src === 'string' ? JSON.parse(src) : src;
} catch {
  radar = raw;
}

// Sin señal → scoring trivial
if (!radar || radar.radar_activo !== 'Sí') {
  return {
    json: {
      ...raw,
      radar_activo_maoa:   false,
      tipo_senal:          radar?.tipo_senal || 'Sin Señal',
      empresa_o_proyecto:  radar?.empresa_o_proyecto || null,
      descripcion_resumen: radar?.descripcion_resumen || radar?.motivo_descarte || null,
      criterios_cumplidos: radar?.criterios_cumplidos || [],
      total_criterios:     radar?.total_criterios || 0,
      ventana_compra_maoa: 'Sin señal',
      monto_inversion:     null,
      fuente_link:         radar?.fuente_link || null,
      fuente_tipo:         radar?.fuente_nombre || null,
      fecha_senal:         null,
      evaluacion_temporal: '🔴 Descarte',
      motivo_descarte_maoa: radar?.motivo_descarte || 'Sin señal detectada',
      observaciones_maoa:  radar?.observaciones || null,
      tier_score:          0, tier_clasificacion: 'C',
      tir_score:           0, tir_clasificacion:  'C',
      score_final_maoa:    0,
      convergencia_maoa:   'Sin convergencia',
      accion_recomendada:  'ARCHIVAR',
      radar_6_12m:         false,
      prioridad_comercial: 'BAJA',
    }
  };
}

// ── Variables TIER (cuenta) ───────────────────────────────────────────────────
function scoreIndustria(empresa) {
  const e = (empresa || '').toLowerCase();
  const f500 = ['dhl','fedex','ups','amazon','maersk','kuehne','db schenker','bolloré',
                 'grupo bimbo','alpina','postobon','bavaria','cencosud','falabella',
                 'avianca','latam','aeromexico','copa','ultra','oxxo','viva'];
  if (f500.some(n => e.includes(n))) return 3;
  const grandes = ['aeropuerto','terminal','concesion','oma','asur','gap','aerocivil',
                   'infraero','anac','fraport'];
  if (grandes.some(n => e.includes(n))) return 2;
  return 1;
}

function scoreCapex(monto) {
  if (!monto || monto === 'No reportado') return 0;
  const match = monto.match(/(\\d+(?:[.,]\\d+)?)/);
  if (match) {
    const val = parseFloat(match[1].replace(',', ''));
    if (val >= 100) return 3;
    if (val >= 10)  return 2;
    if (val >= 1)   return 1;
  }
  return 1;
}

function scoreComplejidad(linea, tipoSenal) {
  const l = (linea || '').toLowerCase();
  const t = (tipoSenal || '').toLowerCase();
  if (l.includes('bhs') || t.includes('sortation') || t.includes('asrs') || t.includes('conveyor')) return 3;
  if (l.includes('intra') || l.includes('cedi') || t.includes('automatizacion')) return 2;
  return 1;
}

function scorePais(pais) {
  const p = (pais || '').toLowerCase();
  if (['colombia','mexico','chile'].some(c => p.includes(c))) return 1;
  if (['brasil','brazil','panama','costa rica','peru','argentina'].some(c => p.includes(c))) return 0.5;
  return 0;
}

// ── Variables TIR (oportunidad) ───────────────────────────────────────────────
function scoreTiming(ventana, tipoSenal) {
  const t = (tipoSenal || '').toLowerCase();
  const v = ventana || 'Sin señal';
  if (t.includes('licitacion') || t.includes('capex confirmado')) {
    if (v === '0-6 Meses') return 3;
    if (v === '6-12 Meses') return 2;
  }
  if (v === '0-6 Meses' || v === '6-12 Meses') return 2;
  if (v === '12-18 Meses' || v === '18-24 Meses') return 1;
  return 0;
}

function scorePresupuesto(monto) {
  if (!monto || monto === 'No reportado') return 0;
  if (monto.match(/\\d/) && !monto.toLowerCase().includes('aproximad')) return 2;
  return 1;
}

// ── Calcular ──────────────────────────────────────────────────────────────────
const empresa   = radar.empresa_evaluada || '';
const pais      = radar.pais || '';
const linea     = radar.linea_negocio || '';
const tipoSenal = radar.tipo_senal || '';
const ventana   = radar.ventana_compra || 'Sin señal';
const monto     = radar.monto_inversion || 'No reportado';
const criterios = radar.total_criterios || 0;
const fuente    = radar.fuente_nombre || '';

const v1 = scoreIndustria(empresa);
const v2 = scoreCapex(monto);
const v3 = scoreComplejidad(linea, tipoSenal);
const v4 = scorePais(pais);
const tierScore  = Math.min(10, v1 + v2 + v3 + v4);
const tierClasif = tierScore >= 8 ? 'A' : tierScore >= 5 ? 'B' : 'C';

const v5 = scoreTiming(ventana, tipoSenal);
const v6 = scorePresupuesto(monto);
const v7 = 1; // Default: nivel_influencia — verificar con equipo comercial
const v8 = 1; // Default: presion_competencia — verificar con equipo
const tirScore  = Math.min(9, v5 + v6 + v7 + v8);
const tirClasif = tirScore >= 7 ? 'A' : tirScore >= 4 ? 'B' : 'C';

const scoreFinal = Math.round(((tierScore + tirScore) / 2) * 10) / 10;

const fuentePeso = parseInt((fuente.match(/Peso (\\d+)/) || [])[1] || '0');
const convergencia = (fuentePeso >= 4 && criterios >= 2) || criterios >= 3
  ? 'Verificada'
  : criterios >= 2 ? 'Pendiente' : 'Sin convergencia';

let accion, prioridad;
if (scoreFinal >= 8 && convergencia === 'Verificada') {
  accion = 'ABM ACTIVADO'; prioridad = 'ALTA';
} else if (scoreFinal >= 5) {
  accion = 'MONITOREO ACTIVO'; prioridad = 'MEDIA';
} else {
  accion = 'ARCHIVAR'; prioridad = 'BAJA';
}

const radar6_12m = ['0-6 Meses', '6-12 Meses'].includes(ventana);

return {
  json: {
    ...raw,
    // MAOA A1
    radar_activo_maoa:   true,
    tipo_senal:          tipoSenal,
    empresa_o_proyecto:  radar.empresa_o_proyecto || null,
    descripcion_resumen: radar.descripcion_resumen || null,
    criterios_cumplidos: radar.criterios_cumplidos || [],
    total_criterios:     criterios,
    ventana_compra_maoa: ventana,
    monto_inversion:     monto !== 'No reportado' ? monto : null,
    fuente_link:         radar.fuente_link !== 'No disponible' ? radar.fuente_link : null,
    fuente_tipo:         radar.fuente_nombre || null,
    fecha_senal:         radar.fecha_senal !== 'No disponible' ? radar.fecha_senal : null,
    evaluacion_temporal: radar.evaluacion_temporal || '🟡 Ambiguo',
    motivo_descarte_maoa: null,
    observaciones_maoa:  radar.observaciones || null,
    // MAOA A2
    tier_score:          tierScore,
    tier_clasificacion:  tierClasif,
    tir_score:           tirScore,
    tir_clasificacion:   tirClasif,
    score_final_maoa:    scoreFinal,
    convergencia_maoa:   convergencia,
    accion_recomendada:  accion,
    radar_6_12m:         radar6_12m,
    prioridad_comercial: prioridad,
    observaciones_scoring: 'V7+V8 usan default=1. Verificar con equipo comercial.',
  }
};`;

// ─── F1.3: Parse RADAR1 Output v2 (runOnceForEachItem, $input.item) ──────────
const PARSE_RADAR1_CODE = `// === Parse RADAR1 Output v2 — MAOA A1 format ===
// Sprint MAOA F1.3 — 2026-04-15
// Mode: runOnceForEachItem ($input.item)

const item = $input.item.json;

// AI Agent devuelve el output en diferentes propiedades según el modelo y configuración
let rawOutput = item.output || item.text || item.message || item.content || '';
if (typeof rawOutput === 'object') rawOutput = JSON.stringify(rawOutput);

let parsed = null;
try {
  // Limpiar bloques markdown si existen
  const clean = rawOutput
    .replace(/\`\`\`json\\n?/gi, '')
    .replace(/\`\`\`/g, '')
    .trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = JSON.parse(clean.substring(start, end + 1));
  }
} catch (e) {
  parsed = null;
}

const empresa = item.empresa || item['COMPANY NAME'] || 'Empresa desconocida';

if (!parsed) {
  parsed = {
    empresa_evaluada:   empresa,
    radar_activo:       'No',
    linea_negocio:      item.linea_negocio || null,
    tipo_senal:         'Sin Señal',
    pais:               item.pais || 'No especificado',
    empresa_o_proyecto: null,
    descripcion_resumen: 'Error al parsear output del agente. Revisar logs.',
    criterios_cumplidos: [],
    total_criterios:    0,
    ventana_compra:     'Sin señal',
    monto_inversion:    'No reportado',
    fuente_link:        'No disponible',
    fuente_nombre:      'Sin Señal',
    fecha_senal:        'No disponible',
    evaluacion_temporal: '🔴 Descarte',
    observaciones:      'Parse error — output no es JSON válido',
    motivo_descarte:    'Error de parsing del agente RADAR1',
  };
}

return {
  json: {
    ...item,
    output:         parsed,
    _radar_activo:  parsed.radar_activo === 'Sí',
  }
};`;

// ─── F1.4: Format Final Columns1 — campos MAOA a agregar ─────────────────────
// Solo se agrega si no están ya presentes (idempotente)
const FORMAT_MAOA_PATCH = `
// ── Campos MAOA A1 + A2 (Sprint F1) ──────────────────────────────────────────
const maoa = {
  RADAR_ACTIVO_MAOA:    String(item.radar_activo_maoa ? 'Sí' : 'No'),
  TIPO_SENAL:           String(item.tipo_senal || 'Sin Señal'),
  EMPRESA_PROYECTO:     String(item.empresa_o_proyecto || ''),
  DESCRIPCION_MAOA:     String(item.descripcion_resumen || ''),
  CRITERIOS:            String((item.criterios_cumplidos || []).join('; ')),
  TOTAL_CRITERIOS:      Number(item.total_criterios || 0),
  VENTANA_COMPRA_MAOA:  String(item.ventana_compra_maoa || ''),
  MONTO_INVERSION:      String(item.monto_inversion || 'No reportado'),
  FUENTE_URL_MAOA:      String(item.fuente_link || ''),
  FUENTE_TIPO:          String(item.fuente_tipo || ''),
  FECHA_SENAL:          String(item.fecha_senal || ''),
  EVALUACION_TEMPORAL:  String(item.evaluacion_temporal || ''),
  MOTIVO_DESCARTE_MAOA: String(item.motivo_descarte_maoa || ''),
  TIER_SCORE:           Number(item.tier_score || 0),
  TIER:                 String(item.tier_clasificacion || 'C'),
  TIR_SCORE:            Number(item.tir_score || 0),
  TIR:                  String(item.tir_clasificacion || 'C'),
  SCORE_FINAL_MAOA:     Number(item.score_final_maoa || 0),
  CONVERGENCIA:         String(item.convergencia_maoa || 'Sin convergencia'),
  ACCION:               String(item.accion_recomendada || 'ARCHIVAR'),
  RADAR_6_12M:          String(item.radar_6_12m ? 'Sí' : 'No'),
  PRIORIDAD_COMERCIAL:  String(item.prioridad_comercial || 'BAJA'),
};`;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(' Fix F0+F1 Combinado — Sprint MAOA 2026-04-15 (WF02 Radar)       ');
  log('═══════════════════════════════════════════════════════════════════');
  log(`Modo: ${DRY_RUN ? 'DRY RUN (sin cambios)' : 'PRODUCCIÓN'}`);
  log('');

  // 1. Fetch WF02
  log('Cargando WF02...');
  const { status: wfStatus, data: wf } = await api('/workflows/' + WF02_ID);
  if (wfStatus !== 200 || !wf.nodes) {
    throw new Error(`GET WF02 falló (HTTP ${wfStatus}): ${JSON.stringify(wf).substring(0, 200)}`);
  }
  log(`WF02: "${wf.name}" (${wf.nodes.length} nodos)`);

  // 2. Obtener Tavily credential ID (F0.3)
  log('\n[F0.3] Buscando credencial Tavily en n8n...');
  const { data: credsData } = await api('/credentials?limit=50');
  let tavilyCredId = null;
  for (const c of (credsData?.data || [])) {
    if (c.name?.toLowerCase().includes('tavily') || c.name?.toLowerCase().includes('tvly')) {
      tavilyCredId = c.id;
      ok(`Tavily credential encontrada: "${c.name}" (ID: ${c.id})`);
      break;
    }
  }
  if (!tavilyCredId) warn('No se encontró credencial Tavily — F0.3 se omite');

  let changes = 0;
  let scoringNodeExists = false;

  // 3. Recorrer nodos
  for (const node of wf.nodes) {

    // ── F0.1: Supabase persist URL ──────────────────────────────────────────
    if (node.name === 'HTTP: Supabase Persist Radar (WF02)') {
      log('\n[F0.1] HTTP: Supabase Persist Radar (WF02)');
      const url = node.parameters?.url || '';
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        node.parameters.url = `${SUPABASE_URL}/pg/query`;
        const headers = node.parameters.headerParameters?.parameters || [];
        if (!headers.some(h => h.name === 'apikey')) {
          headers.push({ name: 'apikey', value: SUPABASE_SVCKEY });
          node.parameters.headerParameters = { parameters: headers };
          node.parameters.sendHeaders = true;
        }
        ok(`URL: localhost → ${SUPABASE_URL}/pg/query`);
        changes++;
      } else { skip(`URL ya apunta a producción (${url.substring(0, 50)})`); }
    }

    // ── F0.1: Keywords fetch URL ────────────────────────────────────────────
    if (node.name === 'HTTP: Fetch Keywords Supabase') {
      log('\n[F0.1] HTTP: Fetch Keywords Supabase');
      const url = node.parameters?.url || '';
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Usar Supabase REST API directamente (más simple que pg/query)
        node.parameters.url = `${SUPABASE_URL}/rest/v1/palabras_clave_por_linea`;
        node.parameters.sendHeaders = true;
        node.parameters.headerParameters = {
          parameters: [
            { name: 'apikey',         value: SUPABASE_SVCKEY },
            { name: 'Authorization',  value: `Bearer ${SUPABASE_SVCKEY}` },
          ]
        };
        // Query params para filtrar por sub_linea activa
        node.parameters.sendQuery = true;
        node.parameters.queryParameters = {
          parameters: [
            { name: 'select',   value: 'palabra,tipo,peso' },
            { name: 'activo',   value: 'eq.true' },
            { name: 'order',    value: 'peso.desc,palabra.asc' },
            { name: 'limit',    value: '60' },
          ]
        };
        ok(`URL: localhost → ${SUPABASE_URL}/rest/v1/palabras_clave_por_linea`);
        changes++;
      } else { skip(`URL ya apunta a producción`); }
    }

    // ── F0.2: continueOnFail en OpenAI/Pinecone ─────────────────────────────
    if (['Embeddings OpenAI1', 'Guardar en Memoria (Pinecone)1'].includes(node.name)) {
      log(`\n[F0.2] ${node.name}`);
      if (!node.onError || node.onError === 'stopWorkflow') {
        node.onError = 'continueRegularOutput';
        ok(`onError = continueRegularOutput`);
        changes++;
      } else { skip(`onError ya configurado: ${node.onError}`); }
    }

    // ── F0.3: Asignar Tavily credential ────────────────────────────────────
    if (tavilyCredId) {
      const isTavily = node.parameters?.url?.includes('api.tavily.com') ||
                       node.name?.toLowerCase().includes('tavily') ||
                       node.name?.toLowerCase().includes('buscar tavily') ||
                       node.name?.toLowerCase().includes('fuentes primarias') ||
                       node.name?.toLowerCase().includes('general1') ||
                       node.name?.toLowerCase().includes('general2');
      if (isTavily && node.type === 'n8n-nodes-base.httpRequest') {
        const hasCred = node.credentials?.httpHeaderAuth?.id === tavilyCredId;
        if (!hasCred) {
          node.credentials = { ...node.credentials, httpHeaderAuth: { id: tavilyCredId } };
          ok(`Tavily credential asignada a "${node.name}"`);
          changes++;
        } else { skip(`Tavily credential ya asignada en "${node.name}"`); }
      }
    }

    // ── F1.1: System prompt AI Agent RADAR1 ────────────────────────────────
    if (node.name === 'AI Agent RADAR1') {
      log('\n[F1.1] AI Agent RADAR1 — system prompt MAOA A1');
      const currentSM = node.parameters?.options?.systemMessage || '';
      if (currentSM.includes('SECCIÓN 10') && currentSM.includes('MAOA')) {
        skip('System prompt ya es MAOA A1 completo');
      } else {
        node.parameters = { ...node.parameters };
        node.parameters.options = { ...(node.parameters.options || {}), systemMessage: MAOA_RADAR_SYSTEM };
        ok(`System prompt actualizado (${MAOA_RADAR_SYSTEM.length} chars, 10 secciones)`);
        changes++;
      }
    }

    // ── F1.3: Parse RADAR1 Output — reescritura v2 ─────────────────────────
    if (node.name === 'Parse RADAR1 Output') {
      log('\n[F1.3] Parse RADAR1 Output — reescritura v2 ($input.item)');
      const current = node.parameters?.jsCode || '';
      if (current.includes('Sprint MAOA F1.3') && current.includes('$input.item')) {
        skip('Parse RADAR1 Output ya es v2 MAOA');
      } else {
        node.parameters.jsCode = PARSE_RADAR1_CODE;
        ok('Parse RADAR1 Output reescrito v2 (runOnceForEachItem, MAOA 16 campos)');
        changes++;
      }
    }

    // ── F1.4: Format Final Columns1 ────────────────────────────────────────
    if (node.name === 'Format Final Columns1') {
      log('\n[F1.4] Format Final Columns1 — campos MAOA');
      const current = node.parameters?.jsCode || '';
      if (current.includes('MAOA A1 + A2') || current.includes('TIER_SCORE')) {
        skip('Format Final Columns1 ya tiene campos MAOA');
      } else {
        node.parameters.jsCode = current + '\n' + FORMAT_MAOA_PATCH;
        ok('Campos MAOA A1+A2 agregados a Format Final Columns1');
        changes++;
      }
    }

    // Detectar si ya existe el scoring node
    if (node.name === 'Code: MAOA Scoring') {
      scoringNodeExists = true;
    }
  }

  // ── F1.2: Insertar nodo Code: MAOA Scoring (si no existe) ─────────────────
  log('\n[F1.2] Code: MAOA Scoring — Agente 2 determinístico');
  if (scoringNodeExists) {
    skip('Nodo "Code: MAOA Scoring" ya existe');
  } else {
    const parseNode = wf.nodes.find(n => n.name === 'Parse RADAR1 Output');
    if (!parseNode) {
      warn('"Parse RADAR1 Output" no encontrado — no se puede insertar scoring node');
    } else {
      const scoringNode = {
        id:          `maoa-scoring-${Date.now()}`,
        name:        'Code: MAOA Scoring',
        type:        'n8n-nodes-base.code',
        typeVersion: 2,
        position:    [
          (parseNode.position?.[0] ?? 0) + 240,
          (parseNode.position?.[1] ?? 0),
        ],
        parameters: {
          mode:   'runOnceForEachItem',
          jsCode: SCORING_CODE,
        },
        onError: 'continueRegularOutput',
      };
      wf.nodes.push(scoringNode);

      // Rewire: Parse RADAR1 Output → Code: MAOA Scoring → (destinos anteriores)
      const conns = wf.connections;
      const prevTargets = conns['Parse RADAR1 Output']?.main?.[0] ?? [];
      conns['Parse RADAR1 Output'] = { main: [[{ node: 'Code: MAOA Scoring', type: 'main', index: 0 }]] };
      conns['Code: MAOA Scoring'] = {
        main: [prevTargets.length > 0 ? prevTargets : [{ node: 'Format Final Columns1', type: 'main', index: 0 }]],
      };
      ok(`Nodo insertado entre "Parse RADAR1 Output" y ${prevTargets[0]?.node ?? 'Format Final Columns1'}`);
      changes++;
    }
  }

  log(`\n═══════════════════════════════════════════════════════════════════`);
  log(`Total cambios: ${changes}`);

  if (DRY_RUN) {
    log('\n⚠️  DRY RUN — ningún cambio aplicado en n8n');
    return;
  }

  if (changes === 0) {
    log('\n✅ Todo ya estaba aplicado — sin cambios necesarios');
    return;
  }

  log('\nAplicando PUT en n8n...');
  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  const { status: putStatus, data: putData } = await api('/workflows/' + WF02_ID, 'PUT', payload);

  if (putStatus === 200 && putData?.id) {
    log(`✅ WF02 actualizado en producción. Nodos: ${putData.nodes.length}`);
  } else {
    throw new Error(`PUT falló (HTTP ${putStatus}): ${JSON.stringify(putData).substring(0, 400)}`);
  }

  log('');
  log('PRÓXIMOS PASOS:');
  log('  1. Verificar en n8n → WF02 → AI Agent RADAR1 → System Message');
  log('  2. Verificar nodo "Code: MAOA Scoring" en el flujo');
  log('  3. Aplicar migración Supabase: supabase db push');
  log('  4. Probar con DHL Express / Colombia / Intralogística desde /scan');
}

main().catch(err => { console.error('\n❌ ERROR:', err.message); process.exit(1); });
