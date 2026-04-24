/**
 * fix_f1_maoa_alignment.js
 *
 * Sprint F1 — Alineación WF02 con MAOA (Agente 1 RADAR + Agente 2 SCORING)
 *
 * Cambios:
 *   F1.1: Reemplaza system prompt del AI Agent RADAR1 con MAOA Agente 1 completo
 *         (10 secciones: metodología, líneas negocio, evaluación temporal,
 *          reglas, criterios, empresa en fuente, anti-alucinación, paywall,
 *          taxonomía tipos, formato JSON 16 campos)
 *   F1.2: Agrega nodo "AI Agent SCORING" (Agente 2 MAOA) como Code node
 *         con scoring determinístico TIER+TIR (4 variables cada uno)
 *         → evita llamada extra a OpenAI (scoring determinístico por reglas)
 *   F1.3: Actualiza "Parse RADAR1 Output" para manejar campos MAOA A1
 *   F1.4: Actualiza "Format Final Columns1" para incluir todos los campos MAOA
 *
 * Uso: node fix_f1_maoa_alignment.js [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_HOST = 'n8n.event2flow.com';
const API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmY2ZmOTVjZS0wZWUyLTQ2ZGYtYmMyZS0zOTM1NDhiMzJkMzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NTcxNDAzfQ.AalmiYdPzK6B1NOYhUYmokUeD-S56-C6KV-xtLzuegE';
const WF02_ID  = 'fko0zXYYl5X4PtHz';
const DRY_RUN  = process.argv.includes('--dry-run');

const PUT_ALLOWED = ['name', 'nodes', 'connections', 'settings'];
function stripForPut(wf) {
  const out = {};
  for (const k of PUT_ALLOWED) if (k in wf) out[k] = wf[k];
  return out;
}

function api(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: N8N_HOST, path: apiPath, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }

// ─── F1.1: System prompt MAOA Agente 1 RADAR (completo) ──────────────────────
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
│  🔴 FILTRO NEGATIVO BHS (NO son BHS — ignorar):
│     runway, taxiway, apron, torre de control, ILS, radar ATC,
│     pista de aterrizaje, navegación aérea, señalización de pista.
│  🟢 FILTRO POSITIVO BHS (SÍ son BHS):
│     terminal de pasajeros + sistema BHS, carrusel de equipaje,
│     CUTE, CUSS, CBIS, sortation aeroportuario, self bag drop.
└──────────────────────────────────────────────────────────────────────

┌─ Intralogística ────────────────────────────────────────────────────
│  Automatización de CEDI/DC:
│  sortation, WMS, ASRS, conveyor systems, final de línea industrial,
│  picking automatizado, clasificación de paquetería, robótica de
│  almacén, sistemas de transporte interno.
│  INCLUYE: hubs de mensajería, centros de distribución automatizados,
│  sistemas de clasificación de paquetes (DHL, FedEx, UPS, Amazon).
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

AÑO BASE: 2026. Evalúa la FASE ACTUAL del proyecto, NO el año del titular.

🔴 DESCARTE INMEDIATO — cualquiera de estas condiciones:
   - Verbos en pasado completivo: "inauguró", "inaugurado",
     "abrió sus puertas", "ya está en operación",
     "entró en funcionamiento", "fue completado", "ya opera",
     "completó su construcción", "se completó".
   - Inversión 2024-2025 descrita en PASADO sin fases futuras.
   - Noticias anteriores a enero 2025 sin actualización posterior.
   - Artículos de opinión, editoriales, informes sectoriales genéricos.
   - Eventos ya realizados (conferencias, ferias pasadas).

🟡 AMBIGUO — requiere análisis adicional:
   - Proyectos "2025-2027": buscar fases futuras, equipos por contratar,
     licitaciones pendientes, obras no completadas.
   - Si hay fase futura verificable → radar_activo = "Sí",
     tipo_senal = "Señal Temprana".
   - Si NO hay fase futura verificable → DESCARTAR.

🟢 VÁLIDO — señales que activan el radar:
   - Licitación ABIERTA con fecha de cierre en 2026+
   - CAPEX aprobado pero aún sin adjudicar/ejecutar
   - "planea invertir", "proyecta expansión", "anuncia CAPEX"
   - Concesión otorgada 2026+ sin obras iniciadas
   - Proyecto en fase de ingeniería/diseño/factibilidad
   - Construcción en curso con fases futuras por licitar

VENTANA DE COMPRA:
  Q2-Q4 2026        → "0-6 Meses"
  Q1-Q2 2027        → "6-12 Meses"
  Q3 2027 - Q2 2028 → "12-18 Meses"
  Q3 2028 - Q2 2029 → "18-24 Meses"
  2029+              → "> 24 Meses"
  2025 o anterior sin fase futura → DESCARTE → "Sin señal"

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
   - El snippet NO menciona explícitamente a la empresa (Sección 6)

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 5 — CRITERIOS DE VALIDACIÓN (necesitas ≥ 3 de 6)         ║
╚══════════════════════════════════════════════════════════════════════╝

1. Inversión confirmada o en planificación formal
2. Expansión física: nueva terminal, planta, CEDI, corrugadora, hub
3. Proyecto específico con nombre, código o número de referencia
4. Proceso de contratación activo: licitación, RFP, concurso
5. Permisos o concesiones gubernamentales obtenidas o en proceso
6. Financiación confirmada: crédito, bono, CAPEX en reporte financiero

Si total_criterios < 3 → indicar en observaciones que la señal es débil.

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 6 — LA EMPRESA DEBE APARECER EN LA FUENTE (CRÍTICO)      ║
╚══════════════════════════════════════════════════════════════════════╝

Antes de asignar radar_activo = "Sí":
¿El snippet o título menciona EXPLÍCITAMENTE el nombre de la empresa?

✅ VÁLIDO:
   "[Empresa] anunció inversión de USD X millones"
   "[Empresa] planea CAPEX para nueva planta en [País]"
   "[Empresa] licitó sistema de manejo de equipaje"

❌ INVÁLIDO → DESCARTE:
   "Plan de Inversión Nacional 2026-2030 de [País]"
   "El sector logístico invertirá $X millones"
   Artículo sobre OTRA empresa del mismo sector

EXCEPCIÓN: Si la empresa tiene subsidiarias o marcas relacionadas,
aceptar esas menciones (ej: "DHL Express" para búsqueda de "DHL").

Si NINGÚN resultado menciona la empresa:
  radar_activo = "No"
  motivo_descarte = "Sin fuentes específicas de la empresa. [descripción de lo encontrado]"

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 7 — ANTI-ALUCINACIÓN (OBLIGATORIO — NO NEGOCIABLE)       ║
╚══════════════════════════════════════════════════════════════════════╝

REGLA 7A · fuente_link: SOLO URLs de los resultados de búsqueda.
           Si no hay URL → "No disponible". NUNCA inventar URLs.

REGLA 7B · fecha_senal: SOLO si aparece explícitamente en la fuente.
           Si no aparece → "No disponible". NUNCA inventar fechas.

REGLA 7C · monto_inversion: Si NO aparece en la fuente → "No reportado".
           NUNCA inventar cifras. NUNCA estimar.

REGLA 7D · motivo_descarte: OBLIGATORIO cuando radar_activo = "No".
           ❌ Malo: "No hay señal"
           ✅ Bueno: "Hub Querétaro inaugurado marzo 2025; sin fases futuras."

╔══════════════════════════════════════════════════════════════════════╗
║  SECCIÓN 8 — PAYWALL                                               ║
╚══════════════════════════════════════════════════════════════════════╝

Si el titular anuncia inversión pero el cuerpo está bloqueado:
  - Reportar con datos disponibles del snippet/titular.
  - Indicar en observaciones: "Fuente con paywall — datos limitados."

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

// ─── F1.2: Scoring MAOA A2 como Code node (determinístico — sin API adicional) ─
// Implementa las 4 variables TIER + 4 variables TIR del MAOA Agente 2
const SCORING_CODE = `// === MAOA Agente 2 — SCORING TIER + TIR (determinístico) ===
// Sprint F1 — 2026-04-15
//
// Recibe el output de AI RADAR1 (MAOA A1) y calcula:
//   TIER: valoración de la cuenta (industria, CAPEX histórico, complejidad técnica, país foco)
//   TIR:  valoración de la oportunidad (probabilidad/timing, presupuesto, influencia, competencia)
//   Score Final: (tier + tir) / 2 → 0-10
//   Convergencia: Verificada / Pendiente / Sin convergencia
//   Acción: ABM ACTIVADO / MONITOREO ACTIVO / ARCHIVAR

const raw = $input.first().json;

// Parsear output del RADAR1 (viene como string JSON o ya como objeto)
let radar;
try {
  radar = typeof raw.output === 'string' ? JSON.parse(raw.output) : (raw.output || raw);
} catch {
  radar = raw;
}

// Si no hay señal → scoring trivial
if (!radar || radar.radar_activo !== 'Sí') {
  return [{ json: {
    ...raw,
    // Campos MAOA A1 (de la señal)
    radar_activo_maoa:  false,
    tipo_senal:         radar?.tipo_senal || 'Sin Señal',
    empresa_o_proyecto: radar?.empresa_o_proyecto || null,
    descripcion_resumen: radar?.descripcion_resumen || radar?.motivo_descarte || null,
    criterios_cumplidos: radar?.criterios_cumplidos || [],
    total_criterios:    radar?.total_criterios || 0,
    ventana_compra_maoa: 'Sin señal',
    monto_inversion:    null,
    fuente_link:        radar?.fuente_link || null,
    fuente_tipo:        radar?.fuente_nombre || null,
    fecha_senal:        null,
    evaluacion_temporal: '🔴 Descarte',
    motivo_descarte:    radar?.motivo_descarte || 'Sin señal detectada',
    // Campos MAOA A2 (scoring trivial)
    tier_score: 0,
    tier_clasificacion: 'C',
    tir_score: 0,
    tir_clasificacion: 'C',
    score_final_maoa: 0,
    convergencia_maoa: 'Sin convergencia',
    accion_recomendada: 'ARCHIVAR',
    radar_6_12m: 'No',
    prioridad_comercial: 'BAJA',
  }}];
}

// ── Variables TIER (cuenta) ───────────────────────────────────────────────────
// V1: Industria y tamaño  (0-3)
function scoreIndustria(empresa, pais, linea) {
  const e = (empresa || '').toLowerCase();
  // Fortune 500 / líderes regionales conocidos
  const f500 = ['dhl','fedex','ups','amazon','maersk','kuehne','db schenker','bolloré',
                 'grupo bimbo','alpina','postobon','bavaria','cencosud','falabella',
                 'avianca','latam','aeromexico','copa','viva','ultra','oxxo'];
  if (f500.some(n => e.includes(n))) return 3;
  // Grandes nacionales / regionales
  const grandes = ['aeropuerto','terminal','concesion','oma','asur','gap','aerocivil',
                   'infraero','anac','fraport'];
  if (grandes.some(n => e.includes(n))) return 2;
  return 1;
}

// V2: CAPEX histórico  (0-3)
function scoreCapex(monto, ventana) {
  if (!monto || monto === 'No reportado') return 0;
  const m = monto.toLowerCase();
  // Buscar cifras grandes (> 100M)
  const match = monto.match(/(\\d+(?:[.,]\\d+)?)\\s*(?:m|mm|mdd|usd|eur|cop|mxn|brl)?/i);
  if (match) {
    const val = parseFloat(match[1].replace(',', ''));
    if (val >= 100) return 3;
    if (val >= 10) return 2;
    if (val >= 1) return 1;
  }
  return 1; // monto existe pero no parseable → algo hay
}

// V3: Complejidad técnica  (0-3)
function scoreComplejidad(linea, tipoSenal) {
  const l = (linea || '').toLowerCase();
  const t = (tipoSenal || '').toLowerCase();
  if (l.includes('bhs') || t.includes('sortation') || t.includes('asrs') || t.includes('conveyor')) return 3;
  if (l.includes('intra') || l.includes('cedi') || t.includes('automatizacion')) return 2;
  if (l.includes('carton') || l.includes('corrugado')) return 1;
  return 1;
}

// V4: País foco (0-1)
function scorePais(pais) {
  const p = (pais || '').toLowerCase();
  const CORE    = ['colombia','mexico','chile'];
  const EXTEND  = ['brasil','brazil','panama','costa rica','peru','argentina'];
  if (CORE.some(c => p.includes(c))) return 1;
  if (EXTEND.some(c => p.includes(c))) return 0.5;
  return 0;
}

// ── Variables TIR (oportunidad) ───────────────────────────────────────────────
// V5: Probabilidad + timing (0-3)
function scoreTiming(ventana, tipoSenal) {
  const t = (tipoSenal || '').toLowerCase();
  const v = ventana || 'Sin señal';
  if (t.includes('licitacion') || t.includes('capex confirmado')) {
    if (v === '0-6 Meses') return 3;
    if (v === '6-12 Meses') return 2;
  }
  if (v === '0-6 Meses') return 2;
  if (v === '6-12 Meses') return 2;
  if (v === '12-18 Meses') return 1;
  if (v === '18-24 Meses') return 1;
  return 0;
}

// V6: Presupuesto asignado (0-2)
function scorePresupuesto(monto) {
  if (!monto || monto === 'No reportado') return 0;
  // Hay monto → distinguir si es explícito o implícito
  const m = monto.toLowerCase();
  if (m.match(/\\d/) && !m.includes('aproximad') && !m.includes('estimad')) return 2;
  return 1; // Monto aproximado / implícito
}

// V7: Influencia / acceso (default +1, marcar verificar)
function scoreInfluencia() {
  return 1; // Default según MAOA §3 — verificar con equipo comercial
}

// V8: Presión competitiva (default +1, marcar verificar)
function scoreCompetencia() {
  return 1; // Default según MAOA §3 — verificar competidores
}

// ── Calcular scores ───────────────────────────────────────────────────────────
const empresa  = radar.empresa_evaluada || '';
const pais     = radar.pais || '';
const linea    = radar.linea_negocio || '';
const tipoSenal = radar.tipo_senal || '';
const ventana  = radar.ventana_compra || 'Sin señal';
const monto    = radar.monto_inversion || 'No reportado';
const criterios = radar.total_criterios || 0;
const fuente   = radar.fuente_nombre || '';

const v1 = scoreIndustria(empresa, pais, linea);
const v2 = scoreCapex(monto, ventana);
const v3 = scoreComplejidad(linea, tipoSenal);
const v4 = scorePais(pais);
const tierScore = Math.min(10, v1 + v2 + v3 + v4);
const tierClasif = tierScore >= 8 ? 'A' : tierScore >= 5 ? 'B' : 'C';

const v5 = scoreTiming(ventana, tipoSenal);
const v6 = scorePresupuesto(monto);
const v7 = scoreInfluencia();
const v8 = scoreCompetencia();
const tirScore = Math.min(9, v5 + v6 + v7 + v8);
const tirClasif = tirScore >= 7 ? 'A' : tirScore >= 4 ? 'B' : 'C';

const scoreFinal = Math.round(((tierScore + tirScore) / 2) * 10) / 10;

// ── Convergencia ──────────────────────────────────────────────────────────────
// Verificada: ≥1 fuente peso≥4 + ≥1 fuente peso≥3 OR criterios≥3
const fuentePeso = parseInt((fuente.match(/Peso (\\d+)/) || [])[1] || '0');
const convergencia = (fuentePeso >= 4 && criterios >= 2) || criterios >= 3
  ? 'Verificada'
  : criterios >= 2
  ? 'Pendiente'
  : 'Sin convergencia';

// ── Acción recomendada ────────────────────────────────────────────────────────
let accion, prioridad;
if (scoreFinal >= 8 && convergencia === 'Verificada') {
  accion = 'ABM ACTIVADO';
  prioridad = 'ALTA';
} else if (scoreFinal >= 5) {
  accion = 'MONITOREO ACTIVO';
  prioridad = 'MEDIA';
} else {
  accion = 'ARCHIVAR';
  prioridad = 'BAJA';
}

const radar6_12m = ['0-6 Meses', '6-12 Meses'].includes(ventana) ? 'Sí' : 'No';

return [{ json: {
  ...raw,
  // Campos MAOA A1
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
  motivo_descarte:     null,
  observaciones:       radar.observaciones || null,
  // Campos MAOA A2
  tier_score:           tierScore,
  tier_clasificacion:   tierClasif,
  tier_desglose:        { industria_tamano: v1, capex_historica: v2, complejidad_tecnica: v3, pais_foco: v4 },
  tir_score:            tirScore,
  tir_clasificacion:    tirClasif,
  tir_desglose:         { probabilidad_timing: v5, presupuesto_asignado: v6, nivel_influencia: v7, presion_competencia: v8 },
  score_final_maoa:     scoreFinal,
  convergencia_maoa:    convergencia,
  accion_recomendada:   accion,
  radar_6_12m:          radar6_12m,
  prioridad_comercial:  prioridad,
  observaciones_scoring: 'V7(influencia) y V8(competencia) usan valor default=1. Verificar con equipo comercial.',
  signal_id:            \`\${(pais||'XX').substring(0,2).toUpperCase()}-\${(linea||'XX').replace(/[^A-Z]/gi,'').substring(0,5).toUpperCase()}-\${(empresa||'XX').replace(/[^A-Z]/gi,'').substring(0,5).toUpperCase()}-2026\`,
} }];
`;

// ─── F1.3: Actualizar Parse RADAR1 Output ─────────────────────────────────────
const PARSE_RADAR1_CODE = `// === Parse RADAR1 Output v2 — MAOA A1 format (16 campos) ===
// Sprint F1 — 2026-04-15
// Parsea el JSON de salida del AI Agent RADAR1 (MAOA Agente 1)
// Maneja 3 formatos posibles de output del AI Agent

const item = $input.first().json;

// El AI Agent puede devolver el output en diferentes propiedades
let rawOutput = item.output || item.text || item.message || item.content || '';
if (typeof rawOutput === 'object') rawOutput = JSON.stringify(rawOutput);

// Intentar parsear JSON (puede venir con markdown o sin él)
let parsed = null;
try {
  // Limpiar posibles bloques markdown
  const clean = rawOutput.replace(/\`\`\`json\\n?/gi, '').replace(/\`\`\`/g, '').trim();
  // Encontrar el JSON (primer { hasta el último })
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = JSON.parse(clean.substring(start, end + 1));
  }
} catch (e) {
  parsed = null;
}

// Valores por defecto si el parsing falla
const empresa = item.empresa || item['COMPANY NAME'] || 'Empresa desconocida';
if (!parsed) {
  parsed = {
    empresa_evaluada:   empresa,
    radar_activo:       'No',
    linea_negocio:      item.linea_negocio || null,
    tipo_senal:         'Sin Señal',
    pais:               item.pais || 'No especificado',
    empresa_o_proyecto: null,
    descripcion_resumen:'Error al parsear output del agente. Output raw: ' + rawOutput.substring(0, 200),
    criterios_cumplidos:[],
    total_criterios:    0,
    ventana_compra:     'Sin señal',
    monto_inversion:    'No reportado',
    fuente_link:        'No disponible',
    fuente_nombre:      'Sin Señal',
    fecha_senal:        'No disponible',
    evaluacion_temporal:'🔴 Descarte',
    observaciones:      'Parse error — output no es JSON válido',
    motivo_descarte:    'Error de parsing del agente RADAR1',
  };
}

// Pasar todos los campos del item original + el parsed output
return [{ json: {
  ...item,
  output: parsed,
  _radar_activo: parsed.radar_activo === 'Sí',
} }];
`;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log(' Fix F1 — Alineación MAOA WF02 (Sprint 2026-04-15)           ');
  log('═══════════════════════════════════════════════════════════════');
  log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCCIÓN'}`);
  log('');

  const wfRes = await api('GET', `/api/v1/workflows/${WF02_ID}`);
  if (wfRes.status !== 200) throw new Error(`GET WF02 failed: ${wfRes.status}`);
  const wf = JSON.parse(wfRes.body);
  log(`WF02 cargado: "${wf.name}" (${wf.nodes.length} nodos)`);

  if (!DRY_RUN) {
    const backupPath = path.join(__dirname, `backup_${WF02_ID}_pre_f1_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
    log(`Backup: ${backupPath}`);
  }

  let changes = 0;
  let scoringNodeExists = false;

  // ── F1.1: Actualizar system prompt AI Agent RADAR1 ────────────────────────
  log('\n[F1.1] Actualizar system prompt AI Agent RADAR1 → MAOA A1 completo');
  for (const node of wf.nodes) {
    if (node.name === 'AI Agent RADAR1') {
      const currentSM = node.parameters?.options?.systemMessage || '';
      if (currentSM.includes('MAOA') && currentSM.includes('SECCIÓN 10')) {
        warn('System prompt ya parece ser MAOA A1 — omitiendo');
      } else {
        node.parameters.options = {
          ...node.parameters.options,
          systemMessage: MAOA_RADAR_SYSTEM,
        };
        ok(`System prompt actualizado (${MAOA_RADAR_SYSTEM.length} chars)`);
        changes++;
      }
    }

    // ── F1.3: Actualizar Parse RADAR1 Output ─────────────────────────────────
    if (node.name === 'Parse RADAR1 Output') {
      node.parameters.jsCode = PARSE_RADAR1_CODE;
      ok('Parse RADAR1 Output actualizado para formato MAOA A1');
      changes++;
    }

    // Verificar si ya existe el nodo de scoring
    if (node.name === 'Code: MAOA Scoring' || node.name === 'AI Agent SCORING') {
      scoringNodeExists = true;
    }
  }

  // ── F1.2: Agregar nodo Code: MAOA Scoring si no existe ───────────────────
  log('\n[F1.2] Agregar nodo Code: MAOA Scoring (Agente 2 determinístico)');

  if (scoringNodeExists) {
    warn('Nodo de scoring ya existe — omitiendo inserción');
  } else {
    // Encontrar posición del nodo Parse RADAR1 Output para insertar después
    const parseNode = wf.nodes.find(n => n.name === 'Parse RADAR1 Output');
    const formatNode = wf.nodes.find(n => n.name === 'Format Final Columns1');

    if (!parseNode) {
      warn('No se encontró "Parse RADAR1 Output" — no se puede insertar scoring');
    } else {
      // Crear nuevo nodo de scoring
      const scoringNode = {
        id:   'maoa-scoring-f1-' + Date.now(),
        name: 'Code: MAOA Scoring',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [
          (parseNode.position?.[0] || 0) + 200,
          (parseNode.position?.[1] || 0),
        ],
        parameters: {
          mode:   'runOnceForAllItems',
          jsCode: SCORING_CODE,
        },
        onError: 'continueRegularOutput',
      };

      wf.nodes.push(scoringNode);

      // Redirigir conexiones: Parse RADAR1 Output → Code: MAOA Scoring → Format Final Columns1
      const conns = wf.connections;
      const parseConns = conns['Parse RADAR1 Output'] || { main: [[]] };

      // Guardar destinos actuales del Parse RADAR1 Output
      const parseTargets = parseConns.main?.[0] || [];

      // Parse RADAR1 Output → Code: MAOA Scoring
      conns['Parse RADAR1 Output'] = {
        main: [[{ node: 'Code: MAOA Scoring', type: 'main', index: 0 }]],
      };

      // Code: MAOA Scoring → (mismos destinos que tenía Parse RADAR1 Output)
      conns['Code: MAOA Scoring'] = {
        main: [parseTargets.length > 0 ? parseTargets : [
          { node: 'Format Final Columns1', type: 'main', index: 0 }
        ]],
      };

      ok('Nodo "Code: MAOA Scoring" insertado entre Parse RADAR1 Output y Format Final Columns1');
      changes++;
    }
  }

  // ── F1.4: Actualizar Format Final Columns1 para campos MAOA ─────────────
  log('\n[F1.4] Actualizar Format Final Columns1 para incluir campos MAOA');
  for (const node of wf.nodes) {
    if (node.name === 'Format Final Columns1') {
      const currentCode = node.parameters?.jsCode || '';
      if (!currentCode.includes('radar_activo_maoa') && !currentCode.includes('MAOA')) {
        // Agregar campos MAOA al final del objeto de salida
        const maoa_fields_patch = `
// ── Campos MAOA A1 + A2 (Sprint F1) ─────────────────────────────────────────
const m = item._maoa || {};
const d_final = {
  ...d_existing,
  // MAOA A1: detección
  RADAR_ACTIVO:       item.radar_activo_maoa ? 'Sí' : 'No',
  TIPO_SENAL:         item.tipo_senal || 'Sin Señal',
  EMPRESA_PROYECTO:   item.empresa_o_proyecto || '',
  DESCRIPCION_MAOA:   item.descripcion_resumen || '',
  CRITERIOS:          (item.criterios_cumplidos || []).join('; '),
  TOTAL_CRITERIOS:    item.total_criterios || 0,
  VENTANA_COMPRA:     item.ventana_compra_maoa || '',
  MONTO_INVERSION:    item.monto_inversion || 'No reportado',
  FUENTE_URL:         item.fuente_link || '',
  FUENTE_TIPO:        item.fuente_tipo || '',
  FECHA_SENAL:        item.fecha_senal || '',
  EVALUACION_TEMPORAL:item.evaluacion_temporal || '',
  MOTIVO_DESCARTE:    item.motivo_descarte || '',
  // MAOA A2: scoring
  TIER_SCORE:         item.tier_score || 0,
  TIER:               item.tier_clasificacion || 'C',
  TIR_SCORE:          item.tir_score || 0,
  TIR:                item.tir_clasificacion || 'C',
  SCORE_FINAL_MAOA:   item.score_final_maoa || 0,
  CONVERGENCIA:       item.convergencia_maoa || 'Sin convergencia',
  ACCION:             item.accion_recomendada || 'ARCHIVAR',
  RADAR_6_12M:        item.radar_6_12m || 'No',
};`;
        // Agregar al final del jsCode como comentario explicativo
        node.parameters.jsCode = currentCode + '\n\n' + maoa_fields_patch;
        ok('Format Final Columns1 — campos MAOA agregados');
        changes++;
      } else {
        warn('Format Final Columns1 ya tiene campos MAOA — omitiendo');
      }
    }
  }

  log(`\n${changes} cambios realizados`);

  if (!DRY_RUN && changes > 0) {
    log('\nAplicando cambios en n8n...');
    const payload = stripForPut(wf);
    const putRes = await api('PUT', `/api/v1/workflows/${WF02_ID}`, payload);
    if (putRes.status !== 200) {
      throw new Error(`PUT WF02 failed: ${putRes.status}\n${putRes.body.substring(0, 500)}`);
    }
    ok('WF02 actualizado exitosamente en producción');
  } else if (DRY_RUN) {
    log('\nDRY RUN — sin cambios aplicados');
  }

  log('');
  log('✅ Fix F1 completado');
  log('');
  log('VERIFICACIÓN:');
  log('  1. Ir a n8n → WF02 → nodo "AI Agent RADAR1" → verificar system message');
  log('  2. Verificar que "Code: MAOA Scoring" existe en el flujo');
  log('  3. Probar con DHL Express / Colombia / Intralogística');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
