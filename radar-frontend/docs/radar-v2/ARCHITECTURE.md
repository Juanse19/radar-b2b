# Arquitectura Radar v2

**Last Updated:** 2026-04-21  
**Owner:** Juan Camilo Velez, Juan Sebastián Losada

---

## Visión general

Radar v2 es un módulo de inteligencia comercial que detecta señales de inversión futura (2026-2028) en LATAM usando IA con búsqueda web en tiempo real. Utiliza un patrón **Wizard → Scanner → SSE streaming → Supabase** para proporcionar feedback inmediato al usuario comercial.

---

## Flujo de datos

```
┌─────────────────────────────────────────────────────┐
│ Frontend: Wizard 3 pasos (línea, modo, config)     │
├─────────────────────────────────────────────────────┤
│ Step 1: Seleccionar línea + modo (Auto/Manual)     │
│ Step 2: Cantidad (Auto) o empresas específicas      │
│ Step 3: Resumen, costo estimado, ejecutar          │
└────────────────┬────────────────────────────────────┘
                 │
                 │ POST /api/radar-v2/stream (SSE)
                 ▼
┌─────────────────────────────────────────────────────┐
│ API Route: /api/radar-v2/stream                    │
├─────────────────────────────────────────────────────┤
│ • Valida sesión + presupuesto                      │
│ • Crea session record en Supabase                  │
│ • Itera sobre empresas                             │
│ • Por cada empresa: llama scanCompany()            │
│ • Envía eventos SSE (thinking, search, reading...)  │
└────────────────┬────────────────────────────────────┘
                 │
                 │ scanCompany(company, provider)
                 ▼
┌─────────────────────────────────────────────────────┐
│ AI Providers (estrategia de selección)             │
├─────────────────────────────────────────────────────┤
│ └─ Claude (claude.ts)                              │
│    • Nativo: web_search sin herramientas           │
│    • Multi-turn: refina búsquedas basado en resp    │
│ └─ OpenAI (openai.ts)                              │
│    • Responses API + web_search_preview             │
│    • Streaming de salida                            │
│ └─ Gemini (gemini.ts)                              │
│    • Google Search Grounding                        │
│    • Evaluación de criterios nativa                 │
└────────────────┬────────────────────────────────────┘
                 │
                 │ INSERT/UPDATE radar_v2_results
                 ▼
┌─────────────────────────────────────────────────────┐
│ Supabase: matec_radar schema                       │
├─────────────────────────────────────────────────────┤
│ • radar_v2_sessions: metadata de scans             │
│ • radar_v2_results: por empresa y criterio         │
│ • radar_v2_verifications: estado de fuentes        │
└─────────────────────────────────────────────────────┘
```

---

## Componentes clave

### 1. Wizard (`/radar-v2/escanear`)

**Responsabilidad:** Interfaz de configuración para iniciar escaneos

**Componentes:**
- `Step1Target` — selección de línea + modo (Automático/Manual)
- `Step2Config` — cantidad de empresas (Auto) o CRUD manual (Manual)
- `Step3Review` — resumen, costo estimado, botón ejecutar
- `PresetCards` — CTAs rápidas para escaneos frecuentes (BHS Colombia, Intra LATAM, etc.)

**Estado:**
- URL-driven: `/radar-v2/escanear?mode=manual&line=BHS&companies=dhl,fedex`
- Local state en `useState` para Step1-3
- Auto-avance: Step1 → Step2 cuando línea + modo están seteados (ref evita re-trigger)

**Integración:**
- GET `/api/admin/fuentes` + `/api/admin/keywords` (con fallback graceful)
- GET `/api/radar-v2/estimate` para cálculo de costo
- POST `/api/radar-v2/stream` para iniciar escaneo

### 2. Scanner (`/radar-v2/vivo`)

**Responsabilidad:** Streaming en vivo de eventos del escaneo

**Características:**
- SSE (Server-Sent Events) desde `/api/radar-v2/stream`
- Eventos emitidos: `thinking`, `search_query`, `reading_source`, `criteria_eval`, `result_complete`
- Timeline cronológico ordenada por timestamp
- Indicadores visuales: 🟡 Escaneando, 🟢 Activa, ⚪ Sin señal, 🔴 Error
- **Stop button**: POST `/api/radar-v2/cancel?sessionId=X` (cancela mid-stream)
- **Historial panel**: últimos 10 sesiones colapsable (estado, costo, duración)

**Estado:**
- `sessionId` + `line` pasados como query params
- `useSSE()` hook custom para consumir stream
- Expandible por empresa para ver detalles de búsquedas + fuentes

### 3. Resultados (`/radar-v2/resultados`)

**Responsabilidad:** Tabla histórica filtrable de todos los resultados

**Características:**
- DataTable con paginación
- Filtros: línea, estado (Activas/Descartadas), ventana de compra
- Columnas: Empresa, País, Señal, Ventana, Monto, Criterios (X/6), Fuente verificada
- Excel export con 4 hojas (Resumen, Señales Activas, Descartadas, Verificación)
- Link a empresa para expandir detalles de búsqueda

**Datos:**
- Query: `SELECT * FROM radar_v2_results WHERE ... ORDER BY created_at DESC`
- Row detail: muestra `search_log` JSON con búsquedas, fuentes leídas, criterios evaluados

### 4. Métricas (`/radar-v2/metricas`)

**Responsabilidad:** Dashboard de KPIs y análisis de costos

**Widgets:**
- Total scans (período configurable: 7, 30, 90 días)
- Hit rate (activas / total)
- Costo acumulado
- Breakdown por línea de negocio (stacked bar chart)
- Tabla últimos 50 scans (empresa, línea, costo, duración, estado)

**API:**
- GET `/api/admin/tokens?days=7|30|90` (retorna serie diaria + total)

---

## Proveedores de IA

### Claude (Anthropic)

**Archivo:** `lib/providers/claude.ts`

```typescript
async function scanWithClaude(company: string, lineaNegocio: string): Promise<ScanResult>
```

**Características:**
- **Web search nativo**: usa modelo con `web_search_20250305`
- **Multi-turn**: refina búsquedas basadas en respuestas anteriores
- **Prompt hardening**: 6 reglas + few-shot examples para evitar falsos positivos
- **Verifier**: HEAD requests SSRF-safe + validación de fecha/monto antes de guardar

**Flujo:**
1. Prompt inicial: instrucciones + criterios (6 dimensiones)
2. Tool use: Claude genera query de búsqueda (ej: "Grupo Bimbo inversión 2026 CAPEX")
3. Lee fuente + extrae fecha, monto, contexto
4. Evalúa 6 criterios (inversión próxima, relevancia, monto, etc.)
5. Retorna resultado: `{ radar_activo: bool, tipo_señal: string, ventana: string, monto: string, ... }`

**Costos:**
- Input: ~$0.003 por 1M tokens → ~$0.001 por empresa
- Output: ~$0.015 por 1M tokens → ~$0.004 por empresa
- **Total por empresa: ~$0.005 USD**

### OpenAI (Responses API + web_search_preview)

**Archivo:** `lib/providers/openai.ts`

**Características:**
- Responses API para streaming de salida
- `web_search_preview` plugin para búsquedas
- GPT-4o como modelo base

**Flujo:**
- Similar a Claude pero con parámetros nativos de OpenAI
- Streaming de pensamiento visible al usuario

**Costos:**
- ~$0.01 por empresa (más caro que Claude)

### Gemini (Google Grounding)

**Archivo:** `lib/providers/gemini.ts`

**Características:**
- Google Search Grounding nativo
- Evaluación de criterios en el modelo
- Costo más bajo que OpenAI

**Flujo:**
- Query inicial + grounding retorna resultados con URLs verificadas
- Menos prompting requerido

**Costos:**
- ~$0.008 por empresa

---

## Modelos y prompts

### Prompt base (todos los proveedores)

Ubicado en `lib/prompts/scanner.ts`

**Estructura:**
```markdown
# Rol: Analista de Inversión Industrial LATAM

## Contexto
Matec S.A.S. es un proveedor de soluciones en [línea de negocio].
Queremos detectar empresas con señales de gasto futuro 2026-2028.

## Tarea
Evalúa la empresa [empresa] contra 6 criterios...

## Criterios (1-6)
1. Está en la lista de empresas objetivo (base de datos Matec)
2. Tiene inversión planificada o en ejecución 2026-2028
3. El gasto afecta nuestra línea de negocio ([línea])
4. Hay evidencia verificable (fuente pública, reportes, noticias)
5. Monto estimado > $100K USD (relevancia comercial)
6. Ventana de compra ≤ 18 meses desde hoy

## Few-shot examples
[2-3 ejemplos reales de positivos y negativos]

## Output format
{
  "radar_activo": boolean,
  "criterios_cumplidos": number,
  "tipo_señal": "Licitación|Expansión|CAPEX|Modernización|Otro",
  "ventana_compra": "0-6 meses|6-12|12-18|Incierta",
  "monto_estimado": "string con USD o local",
  "fuentes": ["url1", "url2"],
  "razonamiento": "explicación 2-3 párrafos"
}
```

### Versión mejorada (v2 pendiente)

Migrará la lógica del **Calificador WF01** (N8N) a API Claude nativa:
- 7 dimensiones en lugar de 6
- Scoring 0-10 como pre-filtro
- Mismo patrón SSE que el scanner actual
- Integración en `/radar-v2/resultados` como pestaña adicional

---

## Base de datos (Supabase schema: `matec_radar`)

### Tabla: `radar_v2_sessions`

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users
empresa_count INT
linea_negocio VARCHAR(50)
modo VARCHAR(20) -- 'automatico' | 'manual'
estado VARCHAR(20) -- 'iniciado' | 'en_progreso' | 'completado' | 'cancelado'
costo_estimado DECIMAL(10,4)
costo_actual DECIMAL(10,4)
activas_count INT DEFAULT 0
descartadas_count INT DEFAULT 0
duracion_segundos INT
api_provider VARCHAR(20) -- 'claude' | 'openai' | 'gemini'
created_at TIMESTAMP DEFAULT now()
updated_at TIMESTAMP
cancelado_en TIMESTAMP
```

### Tabla: `radar_v2_results`

```sql
id UUID PRIMARY KEY
session_id UUID REFERENCES radar_v2_sessions
empresa VARCHAR(255)
pais VARCHAR(50)
linea_negocio VARCHAR(50)
radar_activo BOOLEAN
tipo_señal VARCHAR(50)
ventana_compra VARCHAR(50)
monto_estimado VARCHAR(100)
criterios_cumplidos INT
motivo_descarte TEXT -- NULL si radar_activo=true
search_log JSONB -- { queries: [...], sources_read: [...], timings: {...} }
fuentes JSONB -- [ { url, titulo, timestamp } ]
razonamiento TEXT
created_at TIMESTAMP DEFAULT now()
```

### Tabla: `radar_v2_verifications`

```sql
id UUID PRIMARY KEY
result_id UUID REFERENCES radar_v2_results
url VARCHAR(500)
http_status INT
titulo VARCHAR(255)
fecha_extraida DATE
monto_verificado BOOLEAN
timestamp TIMESTAMP DEFAULT now()
```

---

## Seguridad

### Rate limiting
- Por usuario: máx 100 empresas/día
- Por API provider: respeta límites nativos (Tavily, OpenAI, etc.)
- Throttle en `/api/radar-v2/stream` si presupuesto agotado

### SSRF protection
- Verifier: validación de URL antes de HEAD request
- Whitelist de dominios permitidos (timeliness, news, gov, bolsas)
- Timeout: 5s máximo por HEAD

### Autenticación
- Solo usuarios autenticados pueden escanear
- RLS (Row-Level Security) en Supabase: solo ven sus propias sesiones
- Admin override: acceso a métricas de todo usuario

---

## Próximos módulos planificados

### Calificador v2 (Q2 2026)

Migración del **WF01 N8N** (Calificador) a API Claude nativa:
- 7 dimensiones: impacto presupuesto, año objetivo, recurrencia, multiplanta, ticket, referente, prioridad
- Score 0-10 resultante
- Mismo patrón SSE que scanner actual
- Se integra como pestaña adicional en `/radar-v2/resultados` ("Calificación")
- Reutiliza misma sesión de scan

**Flujo:**
```
/radar-v2/resultados?sessionId=X
├─ Tab "Radar": tabla de señales (actual)
├─ Tab "Calificación": matriz 7 dimensiones con scores (nuevo)
└─ Tab "Prospectos": Apollo v3 contacts (futuro)
```

### Rediseño Resultados (Q2 2026)

**Estructura de tabs:**
1. **Últimos escaneos**: por sesión, ordenado por fecha descendente
2. **Por empresa**: todas las empresas + último estado de scan (deduplicado)
3. **Señales activas**: solo `radar_activo=true`, ordenadas por relevancia (monto × recencia)
4. **Reportes**: Excel export actual + PDF summary

**Mejoras visuales:**
- Cards en lugar de tabla (mobile-first)
- Chips para filtros rápidos (línea, ventana, país)
- Hit-rate bar chart inline
- Expandible para detalles de búsqueda

### Prospector v3 (Q3 2026)

Integración de **WF03 N8N** (búsqueda de contactos Apollo.io) en `/radar-v2/prospectos`:
- Input: empresas con `radar_activo=true` + `tier=ORO|MONITOREO|ARCHIVO`
- Búsqueda por título + jerarquía (C-LEVEL → DIRECTOR → GERENTE → JEFE)
- Máx 5 contactos ORO, 3 MONITOREO, 1 ARCHIVO
- GSheets dual-write: tab "Prospectos" + "Sin Contactos"

---

## Límites de tokens (configurable)

Usuario admin puede limitar tokens por sesión desde `/admin/tokens`:

```typescript
interface UserTokenConfig {
  max_tokens_per_scan: number; // default 50,000
  max_total_monthly: number;   // default 1,000,000
  max_concurrent_scans: number; // default 5
}
```

Estos se validan en:
- `POST /api/radar-v2/stream` (before loop)
- `GET /api/radar-v2/estimate` (cost calculation)
- `/admin/tokens` dashboard (alertas)

---

## Archivos de referencia

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/providers/claude.ts` | Integración Claude con web search |
| `lib/providers/openai.ts` | Integración OpenAI Responses API |
| `lib/providers/gemini.ts` | Integración Google Gemini Grounding |
| `lib/prompts/scanner.ts` | Prompt base para todos los proveedores |
| `lib/verifier.ts` | Validación SSRF-safe de fuentes |
| `lib/metrics.ts` | Cálculos de KPIs y costos |
| `app/api/radar-v2/stream/route.ts` | Orquestación SSE principal |
| `app/api/radar-v2/cancel/route.ts` | Cancelación de sesiones |
| `app/api/admin/tokens/route.ts` | Dashboard de métricas |
| `app/(dashboard)/radar-v2/escanear/page.tsx` | Wizard UI |
| `app/(dashboard)/radar-v2/vivo/page.tsx` | Timeline SSE |
| `app/(dashboard)/radar-v2/resultados/page.tsx` | Tabla histórica |

---

## Performance considerations

- **Streaming SSE**: reduce latencia percibida vs polling
- **Batch API pending**: Haiku pre-filter para 20+ empresas en paralelo
- **Pinecone RAG pending**: vectorización de corpus histórico para reutilización de insights
- **Cache**: resultados por (empresa, línea) con TTL de 30 días

---

**Última actualización:** 2026-04-21 por Juan Sebastián Losada
