# Arquitectura del Sistema — Matec Radar B2B

## Decisión Clave: 3 Workflows Separados en N8N

Se eligió separar el monolito original (75 nodos) en 3 workflows independientes conectados via webhooks.

**Razones:**
- El orden correcto del negocio es Calificar → Buscar → Prospectar (el monolito lo tenía invertido)
- Un fallo en Tavily/Apollo no debe tumbar toda la cadena
- Cada agente tiene triggers y frecuencias distintas
- Apollo tiene presupuesto limitado (2,540 tokens) y requiere control independiente

**Comunicación:** Webhook-to-webhook. WF01 llama a WF02 con empresas score ≥ 5. WF02 llama a WF03 con señales ORO.

---

## Flujo de Datos Detallado

```
Google Sheets (1026 empresas)
          │
          ▼
[Frontend /scan] ──POST /webhook/calificador──▶ [WF01 Calificador]
                                                      │
                                    Loop por empresa   │
                                    Tavily (perfil)    │
                                    GPT-4.1-mini       │
                                    Score 0-10         │
                                    Tier ORO/MON/ARC   │
                                    6 Excel SharePoint │
                                    GSheets Cal_Log    │
                                    Supabase (dual-write) │
                                                      │ score ≥ 5
                                                      ▼
                                              [WF02 Radar]
                                            Tavily búsqueda (keywords por línea)
                                            AI RADAR1 análisis
                                            Score PROM 0-100
                                            Composite score (con SCORE CAL)
                                            6 Excel SharePoint
                                            Pinecone vectorial
                                            Gmail (score_radar ≥ 80)
                                            Supabase (dual-write) │
                                                      │ tier_compuesto != ARCHIVO
                                                      ▼
                                              [WF03 Prospector]
                                            Apollo People Search
                                            ORO=5 / MONITOREO=3 contactos
                                            GSheets Prospection_Log
                                            Supabase (dual-write: contactos + prospecciones)
```

---

## IDs de Producción

| Componente | ID / Valor |
|-----------|-----------|
| WF01 ID N8N | `jDtdafuyYt8TXISl` |
| WF02 ID N8N | `fko0zXYYl5X4PtHz` |
| WF03 ID N8N | `RLUDpi3O5Rb6WEYJ` |
| GSheets Resultados | `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` |
| GSheets Base Datos | `13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818` |
| Supabase URL | `https://supabase.valparaiso.cafe` |
| Supabase schema | `matec_radar` |
| Pinecone índice | `matec-radar` (namespace: `proyectos_2026`) |
| OpenAI credential | `OpenAi account 3` (id: `21AmZDFfjIkvbK67`) |
| Excel credential | `Microsoft Excel account 2` (id: `aXCgjM196D6Oj5tf`) |
| GSheets credential | `Google Sheets account 3` (id: `Yv0pMNMe4juimTet`) |

---

## Frontend Stack

| Componente | Versión / Detalle |
|-----------|------------------|
| Framework | Next.js 16.2 (App Router) |
| CSS | Tailwind CSS v4 — CSS-first config via `@import "tailwindcss"` |
| TypeScript | Strict mode activado |
| Tests | Vitest — 101 tests pasando |
| Design system | Tokens de color en `globals.css` (no colores Tailwind hardcodeados) |
| Tema | Light theme completo (dark-mode removido del scope actual) |

El frontend usa el dispatcher `lib/db/index.ts` que enruta a SQLite (Prisma) o Supabase según la variable `DB_DRIVER`.

---

## Supabase Integration

**Estado:** Schema creado, dual-write scaffolded. Pendiente paso manual de admin.

| Item | Estado |
|------|--------|
| Schema `matec_radar` creado | ✅ |
| Admin client (`lib/db/supabase-admin.ts`) | ✅ |
| DB driver switcher (`DB_DRIVER` env var) | ✅ |
| Dual-write WF01/WF02/WF03 vía CTE persist nodes | ✅ |
| Migration script SQLite → Supabase | ✅ (`tools/migrate_to_supabase.py`) |
| Exponer schema en `PGRST_DB_SCHEMAS` | ⚠️ Pendiente — acción manual en Supabase Studio |

**Para activar Supabase como fuente primaria:**
1. Ir a Supabase Studio → Settings → API → agregar `matec_radar` a `PGRST_DB_SCHEMAS`
2. Ejecutar el SQL de migración en Supabase Studio
3. Cambiar en `.env.local`: `DB_DRIVER=supabase`

**Variables de entorno requeridas:**
```
NEXT_PUBLIC_SUPABASE_URL=https://supabase.valparaiso.cafe
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # solo en server-side, nunca exponer al cliente
DB_DRIVER=prisma   # cambiar a "supabase" cuando esté configurado
```

---

## Decisiones Técnicas N8N

### typeVersion de nodos críticos
- Webhook: `2.1` (con `responseMode: 'onReceived'`)
- splitInBatches: `3` (**IMPORTANTE:** `main[0]` = done port, `main[1]` = loop body)
- Code: `2`
- IF: `2.3` (con `options.version: 3`)
- MicrosoftExcel: `2.2` (resource: `worksheet`, dataMode: `autoMap`)
- GoogleSheets: `4.4` (requiere `columns.schema` explícito para append en runtime)

### Webhook body wrapping
N8N v2 envuelve el JSON body bajo `.body`:
```javascript
const raw = $input.all()[0].json;
const body = raw.body || raw; // compatibilidad v1 y v2
```

### Formato de datos entre workflows
WF02 produce campos uppercase (`COMPANY NAME`, `LÍNEA DE NEGOCIO`).
WF03 acepta ambos formatos via:
```javascript
empresa: e.empresa || e['COMPANY NAME'] || ''
linea_negocio: e.linea_negocio || e['LÍNEA DE NEGOCIO'] || ''
```

---

## Monolito Original (Desactivado)

ID: `cB6VI7ZPS4fFVi-dAk4RG` — 75 nodos. Backup en `n8n/shared/` (sin credenciales).
