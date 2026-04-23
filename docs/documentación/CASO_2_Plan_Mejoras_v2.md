# Plan de Mejoras MAOA Radar v2 — Caso 2 Ampliado
## Para Claude Code con equipo completo de agentes

---

## Contexto

Ya tienes funcional el módulo Radar v2 con API de Claude integrada.
Ahora necesitas hacerlo ESCALABLE, ROBUSTO y CONTROLABLE.

Este plan agrega 7 mejoras críticas:
1. Multi-modelo (Claude, OpenAI, Gemini intercambiables)
2. Sistema de gestión de tokens (preview + consumo + alertas)
3. Fuentes y keywords en el frontend
4. Seguimiento en tiempo real del agente (tipo Perplexity)
5. Unificación de ejecución + resultados con tabs
6. Wizard guiado paso 1 → 2 → 3
7. Optimización de costos escalable

---

## MEJORA 1: Capa de abstracción multi-modelo

### Problema actual
El Edge Function llama directamente a Claude API. Si mañana quieres probar
con GPT-5 o Gemini 3, hay que reescribir código.

### Solución: Provider Pattern

Crear una capa de abstracción que permita elegir el modelo sin cambiar la lógica.

```typescript
// supabase/functions/_shared/providers/types.ts

export interface AIProvider {
  name: string;
  model: string;
  generateWithSearch(systemPrompt: string, userMessage: string): Promise<AIResponse>;
  generateWithoutSearch(systemPrompt: string, userMessage: string): Promise<AIResponse>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    searchCalls?: number;
  };
  model: string;
}
```

### Implementación de providers

```
/supabase/functions/_shared/providers/
├── types.ts                  ← Interfaces comunes
├── claude-provider.ts        ← Implementación Claude
├── openai-provider.ts        ← Implementación OpenAI (con tools web_search)
├── gemini-provider.ts        ← Implementación Gemini (con google_search)
├── provider-factory.ts       ← Selector dinámico
└── cost-calculator.ts        ← Cálculo unificado de costos
```

### Factory selector

```typescript
// supabase/functions/_shared/providers/provider-factory.ts

export function getProvider(name: string): AIProvider {
  switch (name) {
    case 'claude-sonnet-4-6':
      return new ClaudeProvider('claude-sonnet-4-20250514');
    case 'claude-opus-4-6':
      return new ClaudeProvider('claude-opus-4-20250514');
    case 'gpt-5':
      return new OpenAIProvider('gpt-5');
    case 'gpt-4o':
      return new OpenAIProvider('gpt-4o');
    case 'gemini-3-pro':
      return new GeminiProvider('gemini-3-pro');
    default:
      return new ClaudeProvider('claude-sonnet-4-20250514');
  }
}
```

### Tabla de configuración en Supabase

```sql
CREATE TABLE radar_b2b.ai_providers_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  supports_web_search BOOLEAN DEFAULT true,
  input_cost_per_1m NUMERIC(6,3) NOT NULL,
  output_cost_per_1m NUMERIC(6,3) NOT NULL,
  search_cost_per_call NUMERIC(6,3) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  max_tokens_per_scan INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO radar_b2b.ai_providers_config
  (provider_name, display_name, model_id, input_cost_per_1m, output_cost_per_1m, search_cost_per_call, is_default)
VALUES
  ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'claude-sonnet-4-20250514', 3.00, 15.00, 0.01, true),
  ('claude-opus-4-6', 'Claude Opus 4.6', 'claude-opus-4-20250514', 5.00, 25.00, 0.01, false),
  ('claude-haiku-4-5', 'Claude Haiku 4.5', 'claude-haiku-4-5-20251001', 1.00, 5.00, 0.01, false),
  ('gpt-5', 'GPT-5', 'gpt-5', 2.50, 10.00, 0.02, false),
  ('gpt-4o', 'GPT-4o', 'gpt-4o', 2.50, 10.00, 0.02, false),
  ('gemini-3-pro', 'Gemini 3 Pro', 'gemini-3-pro', 2.00, 12.00, 0.00, false);
```

### UI en Administración

Panel de configuración con:
- Selector de modelo default
- Habilitar/deshabilitar modelos
- Ver costos por modelo
- Test de conectividad por modelo
- Estadísticas de uso por modelo (últimos 30 días)

---

## MEJORA 2: Sistema completo de gestión de tokens

### Arquitectura de tres niveles

```
┌────────────────────────────────────────────────────────┐
│  NIVEL 1: PREVIEW (antes de ejecutar)                 │
│  El usuario selecciona N empresas → ve costo estimado │
├────────────────────────────────────────────────────────┤
│  NIVEL 2: TRACKING (durante la ejecución)             │
│  Cada llamada registra tokens reales usados           │
├────────────────────────────────────────────────────────┤
│  NIVEL 3: ANALYTICS (después)                         │
│  Dashboard con consumo histórico + proyecciones       │
└────────────────────────────────────────────────────────┘
```

### Tablas en Supabase

```sql
-- Tabla: matriz de consumo esperado
CREATE TABLE radar_b2b.token_consumption_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,  -- 'radar_scan', 'scoring', 'abm_search', 'qualification'
  provider_name TEXT NOT NULL,
  avg_input_tokens INTEGER NOT NULL,
  avg_output_tokens INTEGER NOT NULL,
  avg_search_calls INTEGER DEFAULT 0,
  cached_percentage NUMERIC(4,2) DEFAULT 0.0,  -- 0.0 a 1.0
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed con valores basados en nuestros tests
INSERT INTO radar_b2b.token_consumption_matrix
  (operation_type, provider_name, avg_input_tokens, avg_output_tokens, avg_search_calls)
VALUES
  ('radar_scan', 'claude-sonnet-4-6', 6500, 800, 3),
  ('scoring', 'claude-sonnet-4-6', 2300, 500, 0),
  ('abm_search', 'claude-sonnet-4-6', 4000, 1000, 2),
  ('qualification', 'claude-sonnet-4-6', 3000, 600, 1);

-- Tabla: log de uso real por ejecución
CREATE TABLE radar_b2b.token_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_result_id UUID REFERENCES radar_b2b.scan_results(id) ON DELETE CASCADE,
  session_id UUID REFERENCES radar_b2b.scan_sessions(id),
  operation_type TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cached_tokens INTEGER DEFAULT 0,
  search_calls INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(8,6) NOT NULL,
  user_id UUID,  -- FK a tu tabla de usuarios existente
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_token_usage_session ON radar_b2b.token_usage_log(session_id);
CREATE INDEX idx_token_usage_date ON radar_b2b.token_usage_log(created_at);

-- Tabla: budget mensual por usuario/organización
CREATE TABLE radar_b2b.token_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  monthly_budget_usd NUMERIC(8,2) NOT NULL DEFAULT 60.00,
  alert_threshold NUMERIC(4,2) DEFAULT 0.80,  -- alerta al 80%
  hard_limit NUMERIC(4,2) DEFAULT 1.00,       -- bloqueo al 100%
  current_month_usage_usd NUMERIC(8,2) DEFAULT 0.00,
  reset_day INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vista para dashboard
CREATE VIEW radar_b2b.token_usage_summary AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  operation_type,
  provider_name,
  COUNT(*) as scan_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  AVG(total_cost_usd) as avg_cost_per_scan
FROM radar_b2b.token_usage_log
GROUP BY DATE_TRUNC('day', created_at), operation_type, provider_name;
```

### Endpoint de preview de costos

```typescript
// /api/radar/estimate-cost

// POST { numCompanies: 50, lineFilter: 'intra', providerName: 'claude-sonnet-4-6' }
// Returns: {
//   estimated_cost_usd: 2.85,
//   estimated_tokens: { input: 325000, output: 40000 },
//   breakdown: {
//     radar_scan: 2.50,
//     scoring: 0.35,  // solo para señales activas estimadas
//   },
//   budget_remaining: 45.20,
//   budget_percentage_used: 25.3,
//   will_exceed_budget: false,
//   warnings: []
// }
```

### UI: Preview antes de ejecutar

Cuando el usuario está configurando el escaneo, en el botón "Ejecutar" debe aparecer:

```
┌────────────────────────────────────────────────────────┐
│  Ejecutar escaneo — 50 empresas                        │
├────────────────────────────────────────────────────────┤
│  Modelo:           Claude Sonnet 4.6                   │
│  Costo estimado:   $2.85 USD                           │
│  Tokens estimados: ~365,000 (325k in + 40k out)        │
│  Tiempo estimado:  ~8 minutos                          │
├────────────────────────────────────────────────────────┤
│  Budget mensual:   $60.00                              │
│  Usado hasta hoy:  $15.20 (25%)                        │
│  Restante:         $44.80                              │
│  Después de este:  $41.95 restante                     │
├────────────────────────────────────────────────────────┤
│  [Cancelar]              [Ejecutar escaneo — $2.85]    │
└────────────────────────────────────────────────────────┘
```

### UI: Dashboard principal (administración)

```
┌────────────────────────────────────────────────────────┐
│  PANEL DE CONSUMO DE TOKENS                            │
├────────────────────────────────────────────────────────┤
│  [KPI] Este mes: $23.45 / $60.00 (39%)                 │
│  [KPI] Proyección: $58.20 (cerca del límite)           │
│  [KPI] Escaneos: 347 (348 empresas)                    │
│  [KPI] Costo promedio: $0.067/empresa                  │
├────────────────────────────────────────────────────────┤
│  GRÁFICO: Consumo diario últimos 30 días               │
│  [gráfico de barras con línea de proyección]           │
├────────────────────────────────────────────────────────┤
│  DESGLOSE POR OPERACIÓN                                │
│  Radar Scan:     $18.20  (78%)                         │
│  Scoring:        $3.15   (13%)                         │
│  ABM Search:     $1.60   (7%)                          │
│  Qualification:  $0.50   (2%)                          │
├────────────────────────────────────────────────────────┤
│  DESGLOSE POR MODELO                                   │
│  Claude Sonnet 4.6:  85%  ($19.93)                     │
│  Claude Haiku 4.5:   15%  ($3.52)                      │
├────────────────────────────────────────────────────────┤
│  ALERTAS                                               │
│  ⚠ Alerta configurada al 80% ($48.00)                 │
│  ✅ Estado: dentro del presupuesto                     │
└────────────────────────────────────────────────────────┘
```

### Alertas automáticas

- Al 50% del presupuesto → notificación informativa
- Al 80% → alerta con email al admin
- Al 95% → bloqueo de escaneos batch (solo manual)
- Al 100% → bloqueo total + aprobación requerida

---

## MEJORA 3: Fuentes y keywords en el frontend

### Problema actual del Radar v2

Ya tienes el módulo funcionando pero faltan 2 secciones de configuración
que sí estaban en el demo original y son críticas para buenos resultados.

### Agregar a la vista de configuración

```
┌────────────────────────────────────────────────────────┐
│  Paso 2 de 3 — Configuración avanzada                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🏛️ Fuentes institucionales (12 activas) [▼]          │
│     ┌──────────────────────────────────────────────┐   │
│     │ 🇨🇴 Colombia                                  │   │
│     │   [✓] SECOP (P5) — Licitaciones públicas     │   │
│     │   [✓] ANI (P5) — Concesiones                 │   │
│     │   [✓] Aerocivil (P5) — Planes aeroportuarios │   │
│     │   [ ] ANDI (P3) — Reportes industriales      │   │
│     │   [✓] DNP (P5) — CONPES y CAPEX              │   │
│     │                                              │   │
│     │ 🇲🇽 México                                    │   │
│     │   [✓] AFAC (P5)                              │   │
│     │   [✓] CompraNet (P5)                         │   │
│     │   ...                                        │   │
│     └──────────────────────────────────────────────┘   │
│                                                        │
│  🔑 Palabras clave (7) [▼]                             │
│     ┌──────────────────────────────────────────────┐   │
│     │ [terminal pasajeros ×] [sistema BHS ×]       │   │
│     │ [carrusel equipaje ×] [CUTE CUSS CBIS ×]    │   │
│     │ [ampliación aeropuerto ×]                    │   │
│     │                                              │   │
│     │ [+ Agregar keyword: ________________]        │   │
│     │                                              │   │
│     │ [Auto-configurar por línea] [Restaurar]      │   │
│     └──────────────────────────────────────────────┘   │
│                                                        │
│  📡 Canales de búsqueda                                │
│     [✓] Web general       [✓] Fuentes institucionales  │
│     [ ] RSS / Alertas     [ ] LinkedIn                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Auto-configuración por línea

Al cambiar línea de negocio:
- BHS → activa SECOP, ANI, Aerocivil, AFAC, DGAC, ANAC + keywords BHS
- Intralogística → activa CompraNet, CORFO, BNDES + keywords intra
- Cartón → activa CANAINPA, Klabin/Suzano IR + keywords cartón
- Todas → mezcla curada de las 3

### Admin: CRUD de fuentes y keywords

En el módulo de administración:

```
/administracion/radar-v2/fuentes
  - Tabla con todas las fuentes
  - Agregar/editar/eliminar fuente
  - Asignar peso (1-5)
  - Asignar líneas aplicables

/administracion/radar-v2/keywords
  - Tabla con todas las keywords por línea
  - Agregar/editar/eliminar keyword
  - Importar masivamente desde CSV
```

---

## MEJORA 4: Seguimiento en tiempo real (tipo Perplexity)

### Concepto

Cuando el usuario ejecuta un escaneo, en lugar de una barra de progreso estática,
mostrar el "pensamiento" del agente en vivo:

```
┌────────────────────────────────────────────────────────┐
│  🔴 Escaneando en vivo — Smurfit Westrock              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ✓ Descomponiendo la pregunta en sub-preguntas        │
│    ↓ ¿Tiene proyectos de expansión en LATAM?          │
│    ↓ ¿Ha publicado licitaciones o alianzas?           │
│    ↓ ¿Cuál es su CAPEX declarado?                     │
│    ↓ ¿Hay nuevas plantas en construcción?             │
│                                                        │
│  ✓ Buscando en web: "Smurfit Westrock inversión       │
│     LATAM 2026"                                        │
│     → Encontré 8 resultados                            │
│                                                        │
│  ✓ Buscando en web: "Smurfit Westrock planta          │
│     nueva Sonora México 2026"                         │
│     → Encontré 5 resultados                            │
│                                                        │
│  ⏳ Leyendo: mexicoindustry.com/smurfit-westrock...   │
│     "Nueva planta USD 65M en Ciudad Obregón..."       │
│                                                        │
│  ⏳ Leyendo: valoraanalitik.com/caldera-biomasa...    │
│     "Inversión USD 115.5M en Yumbo..."                │
│                                                        │
│  🧠 Analizando: ¿La empresa aparece en las fuentes?   │
│     ✓ Sí — confirmado en 4 fuentes                    │
│                                                        │
│  🧠 Evaluando criterios (6 obligatorios)              │
│     ✓ Inversión confirmada                            │
│     ✓ Expansión física                                │
│     ✓ Proyecto específico                             │
│     ✓ Financiación                                    │
│     ✗ Licitación activa                               │
│     ✗ Permisos gubernamentales                        │
│     → 4/6 cumplidos → SEÑAL VÁLIDA                    │
│                                                        │
│  ✨ Señal detectada                                    │
│                                                        │
├────────────────────────────────────────────────────────┤
│  Tokens: 6,234 / Tiempo: 23s / Costo: $0.064          │
└────────────────────────────────────────────────────────┘
```

### Implementación técnica

Usar streaming de la API de Claude + Server-Sent Events (SSE) o Supabase Realtime.

```typescript
// En la Edge Function

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    stream: true,  // ← activar streaming
    // ...
  })
});

// Leer stream y emitir eventos
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parsear eventos y emitir al frontend via SSE o Realtime
  emitToFrontend({
    type: 'tool_use_start',  // o 'search_result', 'thinking', 'text'
    data: parseChunk(chunk)
  });
}
```

### Eventos visibles al usuario

| Evento | Icono | Mensaje |
|--------|-------|---------|
| `scan_started` | 🔍 | "Iniciando búsqueda para [empresa]" |
| `thinking` | 🧠 | "Descomponiendo la pregunta..." |
| `search_query` | 🌐 | "Buscando: [query]" |
| `search_results` | 📊 | "Encontré N resultados" |
| `reading_source` | 📄 | "Leyendo: [URL truncada]" |
| `criteria_eval` | ✓/✗ | "Criterio X: cumplido/no cumplido" |
| `scoring` | 🎯 | "Calculando TIER y TIR..." |
| `signal_detected` | ✨ | "Señal detectada" |
| `signal_discarded` | 🚫 | "Descartada: [motivo]" |
| `scan_complete` | ✅ | "Completado en Xs" |

### Tabla para almacenar stream events (opcional, para replay)

```sql
CREATE TABLE radar_b2b.scan_stream_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_result_id UUID REFERENCES radar_b2b.scan_results(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  sequence_num INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## MEJORA 5: Unificación con tabs dentro de Radar v2

### Estructura del módulo

```
/escanear/radar-v2
├── Tab 1: Escanear        ← Nueva ejecución
├── Tab 2: En vivo         ← Ver escaneo en progreso
├── Tab 3: Resultados      ← Resultados históricos (NO duplica "Resultados v2")
├── Tab 4: Cronograma      ← Programación automática
└── Tab 5: Análisis        ← Tendencias, comparativas
```

### Tab 1: Escanear (3 pasos guiados)

```
┌────────────────────────────────────────────────────────┐
│  Paso 1 de 3 — ¿Qué quieres escanear?                  │
│                                                        │
│  ⚡ Escaneo rápido                                     │
│     [BHS Colombia] [Intra LATAM] [Cartón México] ...   │
│                                                        │
│  O configura tu escaneo                                │
│     [⚡ Automático]  [🎯 Manual]                       │
│                                                        │
│                           [Siguiente: Configurar →]    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  Paso 2 de 3 — Configuración                           │
│                                                        │
│  Línea: [Todas] [BHS] [Intra] [Cartón]                 │
│  Empresas: [selector según modo]                       │
│  Fuentes institucionales [▼]                           │
│  Keywords [▼]                                          │
│  Modelo IA: [Claude Sonnet 4.6 ▼]                      │
│                                                        │
│  [← Atrás]              [Siguiente: Revisar →]         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  Paso 3 de 3 — Confirmación                            │
│                                                        │
│  Resumen:                                              │
│  - 50 empresas seleccionadas                           │
│  - Línea: Intralogística                               │
│  - 12 fuentes activas                                  │
│  - 7 keywords                                          │
│                                                        │
│  Costo estimado: $2.85 USD                             │
│  Tiempo estimado: 8 minutos                            │
│  Budget restante después: $41.95 / $60.00              │
│                                                        │
│  [← Atrás]         [🚀 Ejecutar escaneo — $2.85]      │
└────────────────────────────────────────────────────────┘
```

### Tab 2: En vivo

La vista tipo Perplexity descrita en Mejora 4.

### Tab 3: Resultados

Tabla con filtros + vista de detalle expandible.

```
┌────────────────────────────────────────────────────────┐
│  [Filtros] Línea: Todas | País: Todos | Score: ≥6     │
│  [Exportar CSV] [Enviar a CRM]                         │
├────────────────────────────────────────────────────────┤
│  EMPRESA         │LÍNEA │PAÍS  │SCORE│VENTANA │ACCIÓN │
├──────────────────┼──────┼──────┼─────┼────────┼───────┤
│ ✅ DHL           │Intra │LATAM │ 9.2 │0-6m    │ABM    │
│ ✅ Smurfit WR    │Cartón│MX/CO │ 8.5 │0-6m    │ABM    │
│ ✅ FedEx         │Intra │Brasil│ 6.8 │6-12m   │Monit. │
│ ❌ UPS           │ —    │ —    │  —  │ —      │Arch.  │
└────────────────────────────────────────────────────────┘

[Click en fila abre panel lateral con detalle completo]
```

### Tab 4: Cronograma

Reemplaza el módulo cronograma roto del MVP:

```
┌────────────────────────────────────────────────────────┐
│  ESCANEOS PROGRAMADOS                                  │
│  [+ Nuevo cronograma]                                  │
├────────────────────────────────────────────────────────┤
│  DÍA       │LÍNEA          │EMPRESAS│ÚLTIMO    │ACCIÓN│
├────────────┼───────────────┼────────┼──────────┼──────┤
│ Lunes 7am  │BHS            │   50   │07/04 ✓  │[...] │
│ Martes 7am │Intralogística │   50   │08/04 ✓  │[...] │
│ Miérc. 7am │Cartón         │   50   │09/04 ✓  │[...] │
│ Jueves 7am │BHS            │   50   │10/04 ⚠  │[...] │
│ Vier. 7am  │Todas          │   30   │11/04 ✓  │[...] │
└────────────────────────────────────────────────────────┘

[Vista de calendario] [Vista de tabla]
```

### Tab 5: Análisis

```
- Gráfico: señales activas por línea (mensual)
- Gráfico: señales activas por país
- Top 10 empresas con más señales
- Comparativa de precision con escaneos anteriores
- Evolución de costos en el tiempo
```

---

## MEJORA 6: Wizard guiado 3 pasos (UX comercial)

Ya descrito en Mejora 5, Tab 1. Clave:

- Paso 1: qué → "¿Qué quieres escanear?" (preset o personalizado)
- Paso 2: cómo → "Configura detalles" (con opciones colapsadas por defecto)
- Paso 3: cuánto → "Revisa y ejecuta" (con costo claro)

Características del wizard:
- Breadcrumb en la parte superior (1 → 2 → 3)
- Puedes retroceder sin perder datos
- Validación en cada paso antes de avanzar
- Opciones avanzadas colapsadas (el 80% de usuarios solo usa defaults)
- Atajo: "Usar configuración anterior" si hay historial

---

## MEJORA 7: Optimización de costos escalable

### Estrategia 1: Prompt Caching

El system prompt (~2,000 tokens) es idéntico para todas las empresas del mismo lote.
Con caching, solo se paga 1 vez la escritura, y cada lectura cuesta 10%.

```typescript
// Activar prompt caching en la llamada
body: JSON.stringify({
  model: "claude-sonnet-4-20250514",
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" }  // ← cachea por 5 min
    }
  ],
  // ...
})
```

Ahorro: 30% del costo de input en lotes ≥10 empresas.

### Estrategia 2: Batch API para escaneos programados

Para escaneos automáticos de n8n (no urgentes), usar Batch API:
- 50% descuento en input y output
- Procesamiento en 24 horas
- Perfecto para cron nocturno

Ahorro adicional: 50% sobre el costo ya reducido con caching.

### Estrategia 3: Routing de modelos por complejidad

```
Empresa TIER A (estratégica) → Claude Sonnet 4.6  ($0.06/scan)
Empresa TIER B (media)       → Claude Sonnet 4.6  ($0.06/scan)
Empresa TIER C (baja prio)   → Claude Haiku 4.5   ($0.02/scan) ← 70% ahorro
Pre-filtro (¿vale la pena?)  → Claude Haiku 4.5   ($0.02/scan)
```

### Estrategia 4: Pre-filtro barato con Haiku

Antes de gastar $0.06 en un scan completo, un pre-filtro con Haiku
(costo $0.005) determina si vale la pena:

```
Pre-filtro Haiku ($0.005): ¿Esta empresa tuvo alguna mención
relacionada con inversión en los últimos 6 meses?

→ Si NO: descartar inmediatamente (ahorro $0.055)
→ Si SÍ: ejecutar scan completo con Sonnet
```

Ahorro: ~60% si el 40% de empresas no tienen actividad reciente.

### Estrategia 5: Cache de resultados por 7 días

Si una empresa se escaneó hace menos de 7 días con los mismos keywords,
retornar el resultado cacheado:

```sql
-- Verificar antes de escanear
SELECT * FROM radar_b2b.scan_results
WHERE company_id = ?
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 1;
```

Ahorro: 100% en re-escaneos dentro del período.

### Proyección de costos optimizada

| Escenario | 300 empresas/mes | Ahorro |
|-----------|-----------------:|--------|
| Sin optimización | $70 | — |
| + Prompt caching | $50 | 28% |
| + Batch API (nocturno) | $35 | 50% |
| + Routing por tier | $28 | 60% |
| + Pre-filtro Haiku | $20 | 71% |
| + Cache 7 días | $15 | 78% |

Con todas las optimizaciones: **$15/mes para 300 empresas**.
Te sobran $45 de tu presupuesto para pruebas manuales y experimentación.

---

## Equipo de agentes para ejecutar este plan

### 1. Agente Arquitecto (coordinador)

Responsable de:
- Validar que todas las mejoras respetan la arquitectura existente
- Coordinar orden de implementación
- Firmar cada entrega

### 2. Agente Arquitecto Backend

Responsable de:
- Diseñar la capa de abstracción multi-modelo
- Schema de tablas de tokens
- Edge Function modificada con streaming
- Cálculo de costos en tiempo real

### 3. Agente Arquitecto Frontend

Responsable de:
- Estructura de tabs en Radar v2
- Componente de wizard 3 pasos
- Panel de tokens en administración
- Vista streaming tipo Perplexity

### 4. Agente Arquitecto UI/UX

Responsable de:
- Adaptar los nuevos componentes al design system existente
- Microinteracciones del streaming
- Usabilidad del wizard
- Claridad del preview de costos

### 5. Agente Senior Frontend

Responsable de:
- Implementar tabs en Radar v2
- Wizard de 3 pasos
- Panel de fuentes y keywords
- Vista streaming en tiempo real (SSE o Supabase Realtime)
- Dashboard de tokens
- CRUD admin de fuentes/keywords

### 6. Agente Senior Backend

Responsable de:
- Provider pattern multi-modelo
- Streaming en Edge Function
- Sistema de tracking de tokens
- Preview de costos
- Cache de resultados 7 días
- Pre-filtro con Haiku

### 7. Agente Senior Full Stack

Responsable de:
- Integración streaming frontend ↔ backend
- Supabase Realtime subscriptions
- Optimización de queries
- Performance general

### 8. Agente de Documentación

Responsable de:
- Documentar cada provider (Claude, OpenAI, Gemini)
- Guía de usuario para el equipo comercial
- Documentación técnica de la API
- Changelog de v1 → v2

### 9. Agente QA / Testing

Responsable de:
- Tests de cada provider (Claude, OpenAI, Gemini)
- Tests del sistema de tokens (preview vs real)
- Tests E2E del wizard completo
- Tests de streaming (eventos en orden correcto)
- Tests de optimizaciones (caching, batch, pre-filter)
- Regression tests (que nada existente se rompa)

### 10. Agente Code Reviewer

Responsable de:
- Revisar cada PR antes de merge
- Validar convenciones del proyecto
- Performance audit
- Security audit (API keys, rate limiting)

---

## Orden de implementación recomendado

### Sprint 1 (3-5 días)
1. Schema SQL extendido (tokens, providers, stream events)
2. Provider pattern backend
3. Panel de tokens en administración (solo lectura)
4. Preview de costos antes de ejecutar

### Sprint 2 (5-7 días)
5. Fuentes y keywords en frontend (+ CRUD admin)
6. Wizard 3 pasos
7. Tabs en Radar v2

### Sprint 3 (5-7 días)
8. Streaming tipo Perplexity
9. Cronograma funcional
10. Cache 7 días + pre-filtro Haiku

### Sprint 4 (3-5 días)
11. Optimizaciones (caching, batch API)
12. Dashboard analytics
13. Tests E2E completos
14. Documentación final

Total estimado: 3-4 semanas con 2-3 desarrolladores (o Claude Code + revisión humana).

---

## Prompt maestro para Claude Code

```
Soy el Tech Lead de Matec S.A.S. Ya tengo el módulo Radar v2 funcional
con API de Claude. Ahora necesito ESCALARLO con 7 mejoras críticas.

REGLA: No romper nada existente. Agregar sobre lo que ya funciona.

FASE 0 — ANÁLISIS
Lee CLAUDE.md y /docs/maoa/. Revisa el estado actual del Radar v2.
Documenta en /docs/analisis-radar-v2-actual.md:
- Qué está implementado
- Qué falta del demo original (fuentes, keywords, streaming)
- Deuda técnica identificada

FASE 1 — MULTI-MODELO Y TOKENS
Agentes: Arquitecto Backend + Senior Backend + QA

1. Crear provider pattern (Claude, OpenAI, Gemini)
2. Agregar tablas: ai_providers_config, token_consumption_matrix,
   token_usage_log, token_budgets
3. Endpoint /api/radar/estimate-cost
4. Modificar Edge Function para registrar tokens reales
5. Tests de cada provider

FASE 2 — FRONTEND ENRIQUECIDO
Agentes: Arquitecto Frontend + UI/UX + Senior Frontend + QA

1. Agregar tabs en /escanear/radar-v2:
   - Escanear (con wizard 3 pasos)
   - En vivo (streaming)
   - Resultados
   - Cronograma
   - Análisis
2. Wizard 3 pasos con preview de costos
3. Secciones colapsables: fuentes institucionales, keywords
4. Panel admin: /administracion/tokens con dashboard completo
5. CRUD admin: /administracion/radar-v2/fuentes y /keywords

FASE 3 — STREAMING EN TIEMPO REAL
Agentes: Senior Full Stack + Arquitecto Backend + QA

1. Streaming de Claude API en Edge Function
2. Supabase Realtime subscriptions o SSE
3. Componente de streaming tipo Perplexity con:
   - Sub-preguntas
   - Queries de búsqueda
   - Fuentes leídas
   - Evaluación de criterios
   - Señal detectada/descartada
4. Tabla scan_stream_events
5. Tests de eventos en orden correcto

FASE 4 — OPTIMIZACIÓN
Agentes: Arquitecto Backend + Senior Backend + Documentación

1. Prompt caching (30% ahorro)
2. Batch API para escaneos programados (50% ahorro adicional)
3. Routing de modelos por tier
4. Pre-filtro con Haiku 4.5
5. Cache de resultados 7 días
6. Documentación de optimizaciones

FASE 5 — CRONOGRAMA Y RESULTADOS
Agentes: Senior Frontend + n8n Experto + QA

1. Reparar módulo cronograma existente
2. Integrar con sistema de escaneos programados
3. Conectar con n8n (workflows diario)
4. Tests E2E de cronograma completo

FASE 6 — ENTREGA
Agentes: Code Reviewer + Documentación + QA

1. Code review completo
2. Tests E2E con Playwright: DHL, FedEx, UPS, Smurfit WR
3. Guía de usuario para equipo comercial
4. Changelog v1 → v2
5. Informe /docs/informe-entrega-v2.md

Archivos de referencia en /docs/maoa/:
- Todo lo ya generado
- Este plan completo

Skills nuevas a crear si no existen:
- streaming-sse-supabase
- token-tracking-analytics
- multi-model-abstraction
- playwright-e2e-wizards
```

---

## Checklist de entrega final

### Multi-modelo
- [ ] Provider pattern implementado (Claude, OpenAI, Gemini)
- [ ] Tabla ai_providers_config con 6 modelos
- [ ] Selector de modelo en frontend
- [ ] Tests de cada provider

### Tokens y costos
- [ ] Tabla token_consumption_matrix con valores iniciales
- [ ] Tabla token_usage_log registrando cada llamada
- [ ] Tabla token_budgets con límites configurables
- [ ] Endpoint /api/radar/estimate-cost
- [ ] Preview de costos antes de ejecutar (3 escenarios: 1, varias, lote)
- [ ] Dashboard de consumo en administración
- [ ] Alertas al 50%, 80%, 95%, 100%

### Frontend enriquecido
- [ ] Tabs en /escanear/radar-v2
- [ ] Wizard 3 pasos funcional
- [ ] Fuentes institucionales colapsables (25 fuentes)
- [ ] Keywords colapsables (25+ keywords)
- [ ] Auto-configuración por línea
- [ ] CRUD admin de fuentes
- [ ] CRUD admin de keywords

### Streaming
- [ ] Edge Function con stream: true
- [ ] Eventos emitidos: thinking, search_query, reading, criteria, signal
- [ ] Frontend con vista estilo Perplexity
- [ ] Tokens y costo visible en tiempo real

### Optimizaciones
- [ ] Prompt caching activo (30% ahorro)
- [ ] Batch API para cron nocturno (50% ahorro)
- [ ] Routing por tier (C usa Haiku)
- [ ] Pre-filtro con Haiku antes de scan completo
- [ ] Cache de resultados 7 días

### Cronograma
- [ ] Módulo cronograma reparado
- [ ] Integración con n8n
- [ ] Ejecución manual "Ejecutar ahora"
- [ ] Vista calendario + vista tabla

### Pruebas
- [ ] Tests unitarios de providers
- [ ] Tests de preview de costos
- [ ] Tests E2E con Playwright del wizard completo
- [ ] Test de streaming (eventos en orden)
- [ ] Test de regresión (nada roto)
- [ ] Test de costos reales vs estimados

### Documentación
- [ ] Guía de usuario (equipo comercial)
- [ ] Documentación técnica de providers
- [ ] Changelog v1 → v2
- [ ] Runbook de optimizaciones
- [ ] Informe de entrega
