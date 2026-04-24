# Plan de Ejecución — Matec Radar B2B v2.0

**Versión:** 2.1 · **Fecha:** Abril 2026
**Objetivo:** Mejorar los 3 agentes n8n en producción + frontend, usando Claude Code con MCP de n8n
**Enfoque:** Claude Code ejecuta todo automáticamente via n8n MCP — cero pasos manuales en la UI de n8n

---

## Estado actual (actualizado 2026-04-09)

| Fase | Estado | Detalle |
|------|--------|---------|
| FASE 1a — WF03 Prospector v2.0 | ✅ COMPLETADO | Dual-write Supabase activo (commit 79c1451) |
| FASE 1b — WF02 Radar fixes | ✅ COMPLETADO | Bugs A/B/C corregidos (commit 888f625) |
| FASE 2 — Frontend v2.0 | ✅ COMPLETADO | Bugs F1/F2/F3/F4 fijos, 101 tests (commits 7dbcefb, af85de3) |
| Supabase schema + dual-write | ✅ COMPLETADO (parcial) | Schema `matec_radar` creado, admin client, DB_DRIVER switcher, dual-write en los 3 WFs |
| Supabase conexión activa | ⚠️ PENDIENTE | Requiere paso manual: exponer `matec_radar` en `PGRST_DB_SCHEMAS` en Supabase Studio |
| FASE 1c — WF01 Calificador v2.0 | ⏳ PENDIENTE | Bugs D/E aún sin aplicar en n8n |
| FASE 3 — Tests adicionales | ⏳ PENDIENTE | Playwright e2e pendiente |
| FASE 4 — Code Review | ⏳ PENDIENTE | |
| FASE 5 — Release v2.0.0 | ⏳ PENDIENTE | Esperando merge fix/wf03-v2 → main |

**Rama activa:** `fix/wf03-v2` (11 commits adelante de main)

---

## Cómo funciona la ejecución automatizada

Claude Code tiene acceso al **MCP de n8n** conectado a `https://n8n.event2flow.com`.
Esto significa que **no tienes que tocar la interfaz de n8n** para ninguna de las mejoras de los agentes.

El flujo por cada agente es:
```
1. Claude Code llama get_workflow_details(workflowId)    ← lee el workflow actual
2. Modifica el JSON en memoria (nodo por nodo)            ← aplica los fixes
3. Guarda via PUT /api/v1/workflows/{id}                 ← actualiza en n8n
4. Ejecuta con execute_workflow(workflowId, testPayload)  ← prueba en producción
5. Verifica el resultado y corrige si hay error           ← criterio de éxito
```

---

## Mapa de dependencias

```
FASE 1a — WF03 Prospector (20 min) ─────────────────────┐
FASE 1b — WF02 Radar (45 min) ──────────────────────────┤ → pueden ir en paralelo
FASE 1c — WF01 Calificador (45 min) ────────────────────┘
                                                         ↓
FASE 2 — Frontend fixes (2.5 horas) ────────────────────┐
                                                         ↓
FASE 3 — Tests (2 horas) ──────────────────────────┐    │
FASE 4 — Code Review (paralelo) ───────────────────┤    │
                                                   ↓    ↓
FASE 5 — Prueba cadena completa + Release v2.0.0 ───────┘
```

**Nota:** La Fase 0 (Supabase) está parcialmente completa — schema `matec_radar` creado y dual-write implementado en los 3 WFs. Pendiente: exponer schema en `PGRST_DB_SCHEMAS` (paso manual en Supabase Studio) y cambiar `DB_DRIVER=supabase`.

---

## Preparación Git (antes de empezar)

```bash
cd "C:\Users\Juan\Documents\Agentic Workflows\clients"
git checkout develop
git pull origin develop
```

---

## FASE 1a — WF03 Prospector v2.0 (20 min · Claude Code) ✅ COMPLETADO

**Rama:** `fix/wf03-v2`
**Workflow ID:** `RLUDpi3O5Rb6WEYJ`
**Webhook:** `/prospector`

```bash
git checkout -b fix/wf03-v2
```

**Prompt para Claude Code** (pegar tal cual):
```
Lee el archivo docs/PROMPT_Agent03_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "RLUDpi3O5Rb6WEYJ" para leer el workflow actual.
Aplica los 6 cambios descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con execute_workflow.
No generes archivos locales — trabaja directo en n8n via MCP.
```

**Lo que Claude Code hará automáticamente:**
1. `get_workflow_details("RLUDpi3O5Rb6WEYJ")` — leer el workflow
2. Verificar/reemplazar `Code: Parse Input` (3 formatos de input)
3. Verificar/reemplazar `Code: Build Apollo Query` (6 líneas + job titles)
4. Verificar/reemplazar `Code: Filter & Format` (classifyNivel + deduplicación)
5. Verificar/agregar `IF: Rate Limited?` + `Wait 30s`
6. Verificar/agregar `Code: Deduplicar` antes de GSheets
7. Verificar campo `Es_Multinacional` en el nodo GSheets append
8. `PUT /api/v1/workflows/RLUDpi3O5Rb6WEYJ` — guardar
9. `execute_workflow` con Smurfit Kappa Colombia (tier ORO, esperar ≥ 3 contactos)

**Criterio de éxito:** La ejecución completa sin error y ≥ 3 contactos aparecen en GSheets tab `Prospectos`.

**Git al terminar:**
```bash
git add -A
git commit -m "feat(wf03): Prospector v2.0 — 6 mejoras aplicadas via n8n MCP"
git push origin fix/wf03-v2
# Abrir PR: fix/wf03-v2 → develop
```

---

## FASE 1b — WF02 Radar v2.0 (45 min · Claude Code) ✅ COMPLETADO

**Rama:** `fix/wf02-v2`
**Workflow ID:** `fko0zXYYl5X4PtHz`
**Webhook:** `/radar-scan`

```bash
git checkout develop
git checkout -b fix/wf02-v2
```

**Prompt para Claude Code** (pegar tal cual):
```
Lee el archivo docs/PROMPT_Agent02_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "fko0zXYYl5X4PtHz" para leer el workflow actual.
Aplica los 6 fixes descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con los 2 payloads de test.
No generes archivos locales — trabaja directo en n8n via MCP.
```

**Lo que Claude Code hará automáticamente:**
1. `get_workflow_details("fko0zXYYl5X4PtHz")` — leer el workflow (63 nodos)
2. **Fix 1** — Reemplazar `Code: Construir Query Tavily` con código completo (keywords por línea)
3. **Fix 2** — Agregar `SCORE CAL`, `PAIS`, `paises` al nodo Set `Format Final Columns1`
4. **Fix 3** — Insertar nuevo nodo `Code: Calcular Composite` + actualizar conexiones
5. **Fix 4** — Cambiar condición de `IF: Tier ORO para WF03` a `tier_compuesto !== "ARCHIVO"`
6. **Fix 5** — Actualizar `jsonBody` de `HTTP: Trigger Prospector WF03` con `composite_score`, `max_contacts`, `paises[]`
7. **Fix 6** — Mover API keys Tavily a credencial n8n (crear credencial si no existe)
8. `PUT /api/v1/workflows/fko0zXYYl5X4PtHz` — guardar
9. `execute_workflow` × 2 pruebas:
   - Grupo Bimbo / Final de Línea / score_cal=9 → esperar `tier_compuesto="ORO"`, dispara WF03
   - Terminal de Carga Bogotá / BHS / MONITOREO → esperar `tier_compuesto="MONITOREO"`, también dispara WF03

**Bugs resueltos (commit 888f625):**
- Bug A: `SCORE CAL` faltante → composite_score siempre era 0 ✅ FIJO
- Bug B: MONITOREO nunca prospectaba → ahora sí (threshold cambiado) ✅ FIJO
- Bug C: `Construir Query Tavily` vacío → búsqueda genérica → señales incorrectas ✅ FIJO

**Criterio de éxito:** Ambas pruebas completan sin error y WF03 se dispara.

**Git al terminar:**
```bash
git add -A
git commit -m "fix(wf02): SCORE CAL, query Tavily, MONITOREO prospección, composite score v2"
git push origin fix/wf02-v2
# Abrir PR: fix/wf02-v2 → develop
```

---

## FASE 1c — WF01 Calificador v2.0 (45 min · Claude Code)

**Rama:** `fix/wf01-v2`
**Workflow ID:** `jDtdafuyYt8TXISl`
**Webhook:** `/calificador`

```bash
git checkout develop
git checkout -b fix/wf01-v2
```

**Prompt para Claude Code** (pegar tal cual):
```
Lee el archivo docs/PROMPT_Agent01_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "jDtdafuyYt8TXISl" para leer el workflow actual.
Aplica los 6 fixes descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con los 2 payloads de test.
No generes archivos locales — trabaja directo en n8n via MCP.
```

**Lo que Claude Code hará automáticamente:**
1. `get_workflow_details("jDtdafuyYt8TXISl")` — leer el workflow (20 nodos)
2. **Fix 1** — Mover API key Tavily a credencial n8n (en nodo `Buscar Perfil Empresa`)
3. **Fix 2** — Webhook `responseMode: "responseNode"` + nuevo nodo `Respond to Webhook` en paralelo
4. **Fix 3** — `continueOnFail: true` en nodo Tavily + nuevo `IF: Tavily OK?` + `Code: Set Perfil Vacío`
5. **Fix 4** — Timeout 10000ms + `neverError: true` en `HTTP: Trigger Radar WF02`
6. **Fix 5** — `paises[]` en el jsonBody a WF02, derivado del campo `MULTIPLANTA`
7. **Fix 6** — Verificar `Switch Linea Cal.` tiene los 6 outputs correctos
8. `PUT /api/v1/workflows/jDtdafuyYt8TXISl` — guardar
9. `execute_workflow` × 2 pruebas:
   - Smurfit Kappa Colombia / multinacional → respuesta inmediata `processing` + score + paises[]
   - Taller Mecánico López → score < 5 → tier ARCHIVO → NO dispara WF02

**Bugs que este fix resuelve:**
- Bug D: WF03 no podía hacer búsqueda multi-país (faltaba `paises[]`)
- Bug E: API keys Tavily hardcodeadas (seguridad)

**Criterio de éxito:** Ambas pruebas correctas. Cadena WF01→WF02 funcional.

**Git al terminar:**
```bash
git add -A
git commit -m "fix(wf01): respuesta inmediata webhook, paises[] multinacional, Tavily error handling"
git push origin fix/wf01-v2
# Abrir PR: fix/wf01-v2 → develop
```

---

## Merge de Fases 1a + 1b + 1c en develop

```bash
# Después de que los 3 PRs están aprobados y mergeados:
git checkout develop
git pull origin develop

# Prueba de integración de la cadena completa
curl -X POST https://n8n.event2flow.com/webhook/calificador \
  -H "Content-Type: application/json" \
  -d '{
    "empresas": [{
      "empresa": "Smurfit Kappa Colombia",
      "pais": "Colombia",
      "linea_negocio": "Cartón y Papel",
      "company_domain": "smurfitkappa.com"
    }]
  }'
```

Verificar en n8n → Executions:
- WF01 ejecuta → score asignado → dispara WF02
- WF02 ejecuta → score_radar + composite_score → dispara WF03
- WF03 ejecuta → contactos en GSheets

---

## FASE 2 — Frontend v2.0 (Día 2 · ~2.5 horas · Claude Code) ✅ COMPLETADO

**Rama:** `feature/frontend-v2`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/frontend-v2
```

**Prompt para Claude Code** (pegar tal cual):
```
Lee radar-frontend/CLAUDE.md y docs/PROMPT_Frontend_v2.md antes de empezar.
Trabaja en el directorio radar-frontend/.

Aplica los 4 bug fixes en este orden:

Bug F1 — app/scan/page.tsx: Agregar las 4 líneas faltantes en LINEA_OPTIONS
  Valores a agregar: 'Cargo', 'Motos', 'Final de Línea', 'Solumat'

Bug F2 — lib/n8n.ts: Cambiar 'nombre' por 'empresa' en el payload al webhook WF01

Bug F3 — app/api/prospect/route.ts: Agregar 'tier' y 'paises[]' en el body a WF03

Bug F4 — lib/types.ts: Completar LineaNegocio con los 6 valores correctos más 'ALL'

Después de los 4 fixes, correr:
  npm run lint
  npm run test
  npm run build

Si todos pasan, reportar OK.
```

**Criterio de éxito:** `lint` + `test` + `build` pasan sin errores.

**Git al terminar:**
```bash
git add radar-frontend/
git commit -m "fix(frontend): 4 bugs — LINEA_OPTIONS, campo empresa, tier/paises[], LineaNegocio type"
git push origin feature/frontend-v2
# Abrir PR: feature/frontend-v2 → develop
```

---

## FASE 3 — Tests (Día 3 · 2 horas · Claude Code)

**Rama:** `test/cobertura-v2`

```bash
git checkout develop
git pull origin develop
git checkout -b test/cobertura-v2
```

**Prompt para Claude Code:**
```
Lee radar-frontend/CLAUDE.md.

Escribe tests para los 4 fixes del frontend:

1. Vitest unit test — lib/n8n.ts: verificar que el payload tiene campo 'empresa' (no 'nombre')
2. Vitest unit test — lib/types.ts: verificar que LineaNegocio incluye los 6 valores
3. Vitest integration test — app/api/prospect/route.ts: mock de WF03, verificar que se envía tier y paises[]
4. Playwright e2e test — app/scan/page.tsx: verificar que los 6 botones de línea están visibles

Correr todos los tests al final: npm run test && npx playwright test
```

**Git al terminar:**
```bash
git add radar-frontend/
git commit -m "test: cobertura de los 4 fixes del frontend — unit + integration + e2e"
git push origin test/cobertura-v2
# Abrir PR: test/cobertura-v2 → develop
```

---

## FASE 4 — Code Review (Paralelo con Fase 3 · 1 hora · Claude Code)

**Rama:** `docs/code-review-v2`

```bash
git checkout develop
git checkout -b docs/code-review-v2
```

**Prompt para Claude Code:**
```
Lee radar-frontend/CLAUDE.md y clients/CLAUDE.md.

Haz un code review de los cambios en las ramas feature/frontend-v2 y fix/wf0*:

1. SEGURIDAD: verificar que no hay API keys hardcodeadas en el frontend
2. SEGURIDAD: verificar que SUPABASE_SERVICE_ROLE_KEY no se expone al cliente
3. N8N QUALITY: verificar que los workflows usan credenciales n8n (no headerParameters hardcodeados)
4. TIPADO: verificar que lib/types.ts es consistente con lo que usan las API routes
5. TECH DEBT: listar los 5 items de deuda técnica más urgentes

Genera un reporte en docs/CODE_REVIEW_v2.md con hallazgos y recomendaciones.
```

**Git al terminar:**
```bash
git add docs/CODE_REVIEW_v2.md
git commit -m "docs: code review v2.0 — seguridad, calidad n8n, tech debt"
git push origin docs/code-review-v2
# Abrir PR: docs/code-review-v2 → develop
```

---

## FASE 5 — Release v2.0.0 (Día 3 final · 30 min)

```bash
# Verificar que todos los PRs están mergeados en develop
git checkout develop
git pull origin develop

# Prueba de la cadena completa (WF01→WF02→WF03→GSheets)
# [ver curl de prueba arriba]

# Merge develop → main
git checkout main
git pull origin main
git merge --no-ff develop -m "release: v2.0.0 — 3 agentes mejorados + frontend fixes"

# Tag de versión
git tag -a v2.0.0 -m "v2.0.0: composite score, MONITOREO prospección, paises[], frontend 6 líneas"
git push origin main --tags
```

**Checklist de release:**
- [ ] WF01 responde inmediatamente al webhook (no timeout 30s) — Bug D/E pendientes
- [x] WF02 calcula composite_score correctamente (con SCORE CAL) — Bug A FIJO
- [x] WF02 dispara WF03 para MONITOREO (no solo ORO) — Bug B FIJO
- [x] WF03 obtiene contactos correctos por nivel (C-LEVEL primero) — v2.0 activo
- [x] Frontend muestra las 6 líneas en la página Scan — Bug F1 FIJO
- [x] GSheets Prospectos tiene contactos con Es_Multinacional y Persona_ID
- [ ] No hay API keys hardcodeadas en ningún workflow — Bug E pendiente en WF01

---

## Resumen de IDs (referencia rápida)

| Agente | ID n8n | Webhook |
|--------|--------|---------|
| WF01 Calificador | `jDtdafuyYt8TXISl` | `/calificador` |
| WF02 Radar | `fko0zXYYl5X4PtHz` | `/radar-scan` |
| WF03 Prospector | `RLUDpi3O5Rb6WEYJ` | `/prospector` |

---

## Estimación total

| Fase | Tiempo | Quién |
|------|--------|-------|
| 1a WF03 | 20 min | Claude Code (MCP) |
| 1b WF02 | 45 min | Claude Code (MCP) |
| 1c WF01 | 45 min | Claude Code (MCP) |
| 2 Frontend | 2.5 horas | Claude Code |
| 3 Tests | 2 horas | Claude Code |
| 4 Code Review | 1 hora | Claude Code |
| 5 Release | 30 min | Tú (git) |
| **Total** | **~7.5 horas** | |
