# Guía de Ejecución — Claude Code + n8n MCP

**Versión:** 1.0 · **Fecha:** Abril 2026
**Para:** Sebastian / Juan
**Propósito:** Instrucciones paso a paso para ejecutar las mejoras de los 3 agentes usando Claude Code

---

## Qué va a pasar (resumen de 30 segundos)

Claude Code tiene conectado el MCP de n8n. Eso significa que cuando le das el prompt correcto, él:
1. Lee directamente el workflow desde `n8n.event2flow.com`
2. Modifica los nodos que necesitan fix
3. Lo guarda de vuelta en n8n via la API
4. Lo prueba ejecutando el workflow con datos de test
5. Te dice si funcionó o si hubo errores (y los corrige solo)

**No tienes que abrir n8n, no tienes que hacer nada manualmente en los workflows.**

---

## Prerequisito: abrir Claude Code en la carpeta correcta

```bash
# Opción A — desde la terminal
cd "C:\Users\Juan\Documents\Agentic Workflows\clients"
claude

# Opción B — desde VS Code
# Abrir la carpeta "clients" en VS Code
# Ctrl+Shift+P → "Claude: Open Claude Code"
```

Verificar que Claude Code cargó el CLAUDE.md correcto — debería decir algo como:
> "Contexto cargado: Matec Radar B2B — Sistema de Inteligencia Comercial..."

---

## Fase 1a — WF03 Prospector (20 min)

### Paso 1: crear la rama

```bash
git checkout develop
git pull origin develop
git checkout -b fix/wf03-v2
```

### Paso 2: dar este prompt a Claude Code

```
Lee el archivo docs/PROMPT_Agent03_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "RLUDpi3O5Rb6WEYJ" para leer el workflow actual.
Aplica los 6 cambios descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con execute_workflow.
No generes archivos locales — trabaja directo en n8n via MCP.
```

### Paso 3: esperar y verificar

Claude Code va a mostrar en tiempo real:
- "Leyendo workflow RLUDpi3O5Rb6WEYJ..." → debe mostrar la lista de nodos
- "Aplicando cambio 1 de 6: Code: Parse Input" → va nodo por nodo
- "Guardando workflow actualizado..." → PUT a la API
- "Ejecutando prueba con Smurfit Kappa..." → execute_workflow
- Resultado: tabla de contactos encontrados

**Lo que debes ver al final:**
```
✅ Ejecución exitosa
   Contactos encontrados: 4
   Tab GSheets: Prospectos
   Persona_IDs: SMURFITKAPCOLOMBIA-COL-001, -002, -003, -004
```

### Paso 4: commit y PR

```bash
git add -A
git commit -m "feat(wf03): Prospector v2.0 — 6 mejoras aplicadas via n8n MCP"
git push origin fix/wf03-v2
```

Abrir PR en GitHub: `fix/wf03-v2 → develop`

---

## Fase 1b — WF02 Radar (45 min) ← Hacer esta primero si tienes poco tiempo

### Paso 1: crear la rama

```bash
git checkout develop
git checkout -b fix/wf02-v2
```

### Paso 2: dar este prompt a Claude Code

```
Lee el archivo docs/PROMPT_Agent02_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "fko0zXYYl5X4PtHz" para leer el workflow actual.
Aplica los 6 fixes descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con los 2 payloads de test.
No generes archivos locales — trabaja directo en n8n via MCP.
```

### Paso 3: qué va a pasar (más detallado porque este es el más crítico)

Claude Code va a:

1. **Leer WF02** — 63 nodos, tarda unos segundos
2. **Fix 1 — Construir Query Tavily:**
   - Antes: el nodo solo hacía `return { json: { ...$input.item.json } }` (no construía query)
   - Después: código completo con keywords específicas por línea (BHS, cartón, intra, etc.)
3. **Fix 2 — SCORE CAL:**
   - Busca el nodo Set `Format Final Columns1`
   - Agrega el campo `SCORE CAL` que faltaba
   - Sin este campo, el composite_score siempre era 0 (bug crítico)
4. **Fix 3 — Code: Calcular Composite:**
   - Inserta un nodo nuevo entre `Format Final Columns1` y el `IF`
   - Calcula: `composite = (score_cal/10)*40 + (score_radar/100)*60`
   - Asigna tier_compuesto: ORO ≥70, MONITOREO 40-69, ARCHIVO <40
5. **Fix 4 — IF condition:**
   - Antes: `tier === "ORO"` (solo ORO prosperaba)
   - Después: `tier_compuesto !== "ARCHIVO"` (ORO y MONITOREO prosperan)
6. **Fix 5 — HTTP Trigger WF03:**
   - Agrega `composite_score`, `max_contacts`, `paises[]` al body
7. **Fix 6 — Tavily credential:**
   - Mueve la API key hardcodeada a credencial n8n
   - Si la credencial no existe, la crea via `/api/v1/credentials`
8. **Guardar** el workflow completo via PUT
9. **Prueba 1:** Grupo Bimbo / Final de Línea / score_cal=9
   - Esperar: `composite_score ≥ 70`, `tier_compuesto = "ORO"`, WF03 disparado
10. **Prueba 2:** Terminal de Carga Bogotá / BHS / MONITOREO
    - Esperar: `tier_compuesto = "MONITOREO"`, WF03 disparado con `max_contacts = 3`

### Paso 4: qué hacer si Claude Code reporta un error

**Error: "Workflow not found"**
→ Verificar que el MCP está conectado a `n8n.event2flow.com` (no a localhost)
→ Pedir a Claude Code: "Usa search_workflows para listar los workflows disponibles"

**Error: "Cannot update workflow — no changes detected"**
→ El workflow ya tenía ese fix aplicado — Claude Code lo verificará y pasará al siguiente

**Error en execute_workflow: timeout**
→ Normal en pruebas largas — pedir a Claude Code que verifique el resultado en n8n → Executions

### Paso 5: commit y PR

```bash
git add -A
git commit -m "fix(wf02): SCORE CAL, query Tavily, MONITOREO prospección, composite score v2"
git push origin fix/wf02-v2
```

---

## Fase 1c — WF01 Calificador (45 min)

### Paso 1: crear la rama

```bash
git checkout develop
git checkout -b fix/wf01-v2
```

### Paso 2: dar este prompt a Claude Code

```
Lee el archivo docs/PROMPT_Agent01_v2.md y ejecútalo completo.

Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "jDtdafuyYt8TXISl" para leer el workflow actual.
Aplica los 6 fixes descritos en el PROMPT directamente en n8n.
Guarda via la API de n8n y prueba con los 2 payloads de test.
No generes archivos locales — trabaja directo en n8n via MCP.
```

### Paso 3: qué va a pasar

1. **Fix 1 — Tavily credential:** mueve la key del nodo `Buscar Perfil Empresa`
2. **Fix 2 — Webhook response inmediata:** cambia `responseMode` + agrega nodo `Respond to Webhook` en paralelo (el webhook ya no deja colgado al frontend mientras procesa)
3. **Fix 3 — Error handling Tavily:** si Tavily falla, el workflow continúa con perfil vacío (no se cae)
4. **Fix 4 — Timeout HTTP WF02:** sube a 10 segundos + `neverError: true`
5. **Fix 5 — paises[] para multinacionales:** si `MULTIPLANTA = "Presencia internacional"`, WF02 recibe `paises: ["Colombia", "Mexico", "Chile", "Peru"]`
6. **Fix 6 — Switch 6 outputs:** verifica que el Switch tiene salidas para BHS, CARTON, INTRA, CARGO, MOTOS, FINAL_LINEA

**Prueba 1:** Smurfit Kappa Colombia
- Esperar: respuesta inmediata `{ status: "processing" }` + score + paises[] en el body a WF02

**Prueba 2:** Taller Mecánico López
- Esperar: score < 5 → tier ARCHIVO → NO dispara WF02

### Paso 4: commit y PR

```bash
git add -A
git commit -m "fix(wf01): respuesta inmediata webhook, paises[] multinacional, Tavily error handling"
git push origin fix/wf01-v2
```

---

## Verificación de la cadena completa (después de Fases 1a + 1b + 1c)

Después de que los 3 PRs estén mergeados en `develop`:

```bash
git checkout develop
git pull origin develop
```

Prueba de integración end-to-end:

```bash
curl -X POST https://n8n.event2flow.com/webhook/calificador \
  -H "Content-Type: application/json" \
  -d '{
    "empresas": [{
      "empresa": "Grupo Nutresa",
      "pais": "Colombia",
      "linea_negocio": "Final de Línea",
      "company_domain": "grupnutresa.com"
    }]
  }'
```

Ir a n8n → Executions y verificar que WF01 → WF02 → WF03 se ejecutaron en cadena.
Verificar GSheets tab `Prospectos` para ver los contactos de Grupo Nutresa.

---

## Fase 2 — Frontend (Día 2, solo después de Fase 1)

### Paso 1: crear la rama

```bash
git checkout develop
git pull origin develop
git checkout -b feature/frontend-v2
```

### Paso 2: dar este prompt a Claude Code

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

### Paso 3: esperar

Claude Code va a editar los 4 archivos, luego correr los 3 comandos.
Si hay errores de TypeScript en el build, los va a corregir solo.

### Paso 4: commit y PR

```bash
git add radar-frontend/
git commit -m "fix(frontend): 4 bugs — LINEA_OPTIONS, campo empresa, tier/paises[], LineaNegocio type"
git push origin feature/frontend-v2
```

---

## Tips para trabajar con Claude Code + n8n MCP

### Si Claude Code dice "no tengo acceso al MCP de n8n"
Verificar que iniciaste Claude Code desde el directorio correcto y que el MCP está configurado en `~/.config/claude/claude_desktop_config.json` con la URL `https://n8n.event2flow.com`.

### Si el workflow queda en estado inconsistente
Pedir a Claude Code:
```
Vuelve a leer el workflow "fko0zXYYl5X4PtHz" con get_workflow_details
y dime cuál es el estado actual del nodo "Construir Query Tavily".
```

### Si execute_workflow falla con error de webhook
Algunos workflows en n8n requieren que estén **activos** para ejecutarse via webhook.
Pedir a Claude Code que verifique si el workflow está activo:
```
Usa la API de n8n para verificar si el workflow fko0zXYYl5X4PtHz está activo.
Si no lo está, actívalo.
```

### Usar Agent Teams para ejecutar las 3 fases en paralelo
Si tienes Claude Code con Agent Teams habilitado, puedes correr 1a + 1b + 1c al mismo tiempo.
Ver el archivo `docs/PROMPT_MASTER_AgentTeams.md` para el prompt completo de Agent Teams.

---

## Checklist de validación final

Después de la Fase 5 (release), verificar:

- [ ] Abrir `https://n8n.event2flow.com` → WF01 activo
- [ ] Abrir `https://n8n.event2flow.com` → WF02 activo (63 nodos, nuevo nodo "Code: Calcular Composite")
- [ ] Abrir `https://n8n.event2flow.com` → WF03 activo
- [ ] Google Sheets `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` → tab Prospectos tiene datos
- [ ] Frontend en `localhost:3000` → página Scan muestra 6 líneas (no 4)
- [ ] Frontend → disparar scan de "Grupo Nutresa / Final de Línea" → resultado en GSheets en < 5 min
