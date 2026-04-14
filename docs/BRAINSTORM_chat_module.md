# Brainstorm — Módulo de Chat con Reportes (Próximo Sprint)

> Basado en slide 8 de la presentación Matec Radar B2B (Reunion_radar_comercial_mejorada.pptx)  
> Estado: **documento de ideación** — cero código implementado  
> Rama: `feature/chat-module-brainstorm`

---

## 1. Qué propone el slide 8

El slide describe usar el frontend no solo para disparar agentes, sino como un **interfaz de consulta conversacional** sobre toda la base de datos. El flujo propuesto:

```
Base unificada (Supabase)
        ↓
  Módulo de Chat (/chat)
        ↓
  Motor de Reportes (backend)
        ↓
  Salida Comercial
  (tabla estructurada + resumen ejecutivo + exportar)
```

El objetivo es que cualquier persona del equipo comercial pueda hacer preguntas en lenguaje natural y recibir respuestas tabuladas y accionables, sin necesidad de filtros manuales en el dashboard.

---

## 2. Casos de uso concretos (ejemplos del slide)

| Pregunta natural | Respuesta esperada |
|---|---|
| "¿Cuáles son las 50 cuentas estratégicas de Matec hoy?" | Tabla: empresa, tier, score, señal más reciente, contactos disponibles |
| "Muéstrame oportunidades A de cartón + intralogística con inversión reciente" | Empresas ORO de esas dos líneas con fechaNoticia < 90 días |
| "¿Qué empresas no tienen contacto, pero sí señal de inversión alta?" | Score radar ≥ 60, sin filas en tabla contactos — lista accionable |
| "Dame un reporte ejecutivo por línea para esta semana" | 6 tarjetas (una por línea): top 3 empresas, señales nuevas, contactos nuevos |
| "¿Cuántas empresas MONITOREO hay en México sin contacto?" | Conteo + lista filtrada |

---

## 3. Componentes lógicos que implica

### 3.1 Base unificada (ya existe)

Supabase ya tiene las tablas `empresas`, `senales`, `contactos`, `ejecuciones`, `calificaciones`. Lo que falta para que un LLM opere bien sobre ellas:

- **Vista consolidada** (`matec_radar.v_empresa_completa` o similar): join de empresa + última señal + conteo contactos + tier vigente. Permite queries simples sin joins en el código del motor.
- **Índice semántico opcional**: embeddings de `descripcion` de señales para búsqueda por similitud (no necesario para MVP).

### 3.2 UI de Chat (`/chat`)

Ruta nueva en el frontend. Componentes mínimos:

- **Input de texto** con botón enviar + historial de mensajes en pantalla
- **Panel de respuesta estructurada**: tabla de resultados + párrafo de resumen ejecutivo
- **Botón "Exportar"**: genera Excel descargable con la tabla de resultados
- **Chips de sugerencia** (opcional): accesos rápidos a las preguntas más frecuentes del equipo

Diseño: chat-left (historial) + panel-right (resultado en tabla) o pantalla dividida.

### 3.3 Motor de Reportes (backend)

Endpoint `/api/chat` que recibe la pregunta y devuelve datos estructurados. Dos enfoques posibles:

**Opción A — Tool Calling contra Supabase (recomendado para MVP)**

El LLM (Claude o GPT-4) recibe la pregunta del usuario y tiene acceso a un set de funciones predefinidas que ejecutan queries de Supabase. El modelo decide qué función llamar, con qué parámetros, y luego redacta el resumen.

```
Usuario: "empresas ORO de cartón sin contacto"
   → LLM → llama `buscarEmpresasPorTierYLinea({ tier: 'ORO', linea: 'Cartón' })`
          → llama `filtrarSinContactos(resultados)`
   → devuelve tabla + "Hay 7 empresas ORO en cartón sin contacto asignado..."
```

Funciones predefinidas para MVP (5-8 tools suficientes):

| Tool | Descripción |
|---|---|
| `buscarEmpresasPorTier(tier, linea?, pais?)` | Filtra empresas por tier, línea y/o país |
| `empresasConSenalesSinContactos(scoreMin?)` | Empresas con señal alta y sin contactos |
| `top50CuentasEstrategicas()` | Las 50 mejores por composite_score |
| `reportePorLinea(fechaDesde?)` | Resumen por línea: top empresas, señales nuevas, contactos |
| `senalesRecientes(linea?, dias?)` | Señales de los últimos N días, opcionalmente por línea |
| `contactosPorEmpresa(empresaId)` | Lista de contactos de una empresa |
| `estadisticasGenerales()` | Totales: empresas por tier, señales esta semana, contactos nuevos |

**Opción B — RAG con embeddings**

Generar embeddings de todas las señales/descripciones y hacer búsqueda por similitud antes de responder. Más potente para preguntas abiertas, más complejo de mantener. Recomendado para sprint posterior.

### 3.4 Exportación

- Botón visible en el panel de respuesta cuando hay tabla de resultados
- Backend genera Excel (via `xlsx` npm package, ya disponible en el proyecto) y lo devuelve como stream
- Nombre del archivo: `matec-reporte-{fecha}.xlsx`
- Columnas del Excel = columnas de la tabla de respuesta (dinámicas según la query)

---

## 4. Preguntas abiertas para el próximo sprint

1. **¿Motor = Claude o GPT-4?** El proyecto usa OpenAI (`gpt-4.1-mini`) en n8n. Para el chat podría usarse Claude (via Anthropic API) dado el acceso disponible, con mejor adherencia a las instrucciones del system prompt. ¿Mantener un solo proveedor o usar ambos?

2. **¿Persistir conversaciones?** ¿El historial del chat se guarda en Supabase (tabla `chat_sessions`)? ¿Es compartible entre usuarios del equipo? ¿O es solo sesión local?

3. **Guardrails**: El motor solo debe responder sobre datos de Matec. Necesita un system prompt con scope explícito ("solo consultas sobre el Radar Matec") y rechazo de preguntas fuera de scope. ¿Qué nivel de validación se requiere?

4. **Integración CRM directa**: El slide menciona "salida comercial". ¿La primera versión exporta a Excel (más simple) o ya conecta a HubSpot vía API? Recomendación: Excel para MVP, HubSpot en sprint siguiente.

5. **Autenticación**: El frontend ya tiene sesiones por `matec_session_pub`. El historial del chat debería asociarse al usuario logueado. ¿Es necesario para MVP o se deja como pantalla compartida?

6. **Latencia**: Una query con tool calling puede tardar 3-8 segundos. ¿Se muestra un spinner simple o streaming de respuesta (SSE/WebSocket)?

---

## 5. Alcance sugerido para MVP (próximo sprint)

**Lo que entra:**

- [ ] Ruta `/chat` con UI básica: input + historial + panel de resultados en tabla
- [ ] Endpoint `POST /api/chat` con tool calling sobre Supabase (5-8 funciones predefinidas)
- [ ] Modelo: Claude claude-sonnet-4-6 con system prompt acotado a datos Matec
- [ ] Streaming de respuesta (SSE) para mejor UX
- [ ] Botón "Exportar Excel" con los resultados de la última respuesta
- [ ] Chips de sugerencia con las 5 preguntas más frecuentes del equipo
- [ ] Vista responsiva: panel izquierdo (historial corto) + panel derecho (resultado)

**Lo que NO entra en MVP:**

- Persistencia de sesiones en DB (historial solo en memoria de sesión)
- Integración HubSpot directa
- RAG con embeddings (Opción B)
- Autenticación por usuario para el historial

---

## 6. Estimado técnico

| Componente | Complejidad | Notas |
|---|---|---|
| Vista `/chat` (UI) | Media | ~300 líneas, nuevo componente de chat + tabla de resultados |
| Tool functions (Supabase) | Media | 5-8 functions, queries directas, bien tipadas con TypeScript |
| Endpoint `/api/chat` con tool calling | Alta | Streaming SSE + tool calling loop + manejo de errores |
| Exportación Excel | Baja | `xlsx` ya instalado, ~50 líneas |
| System prompt + guardrails | Baja | Texto, iterable |
| **Total estimado** | **Alta** | 2-3 días de desarrollo enfocado |

---

## 7. Arquitectura propuesta (diagrama simplificado)

```
Usuario escribe pregunta
       ↓
  /chat (Next.js)
       ↓
  POST /api/chat (route.ts)
       ├── System prompt con scope Matec
       ├── Historial de mensajes (session memory)
       └── Tools: [buscarEmpresas, reportePorLinea, ...]
                           ↓
                    Claude API (tool calling loop)
                           ↓
                  Queries a Supabase (matec_radar schema)
                           ↓
                  Respuesta: { tabla: [...], resumen: "..." }
       ↓
  Panel de resultados (tabla + párrafo)
       ↓
  [Exportar Excel] → GET /api/chat/export
```

---

## 8. Referencia de archivos para cuando se implemente

| Archivo | Rol |
|---|---|
| `app/chat/page.tsx` | UI principal (nuevo) |
| `app/api/chat/route.ts` | Endpoint con tool calling (nuevo) |
| `app/api/chat/export/route.ts` | Exportación Excel (nuevo) |
| `lib/chat-tools.ts` | Funciones predefinidas → Supabase (nuevo) |
| `lib/db/index.ts` | Facade existente — extender con nuevas queries |
| `supabase/migrations/` | Agregar vista consolidada si se necesita |
