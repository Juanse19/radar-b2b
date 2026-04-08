# PROMPT MAESTRO — Agent Teams para Matec Radar B2B

## Instrucciones de uso

Este prompt activa un **Agent Team** en Claude Code con 6 teammates especializados trabajando en paralelo. Cada uno tiene un rol y módulo exclusivo.

**Requisito:** Claude Code v2.1.32+ con Agent Teams habilitado:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
claude
```

O en `settings.json`:
```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

**Directorio de trabajo:** `C:\Users\Juan\Documents\Agentic Workflows\clients`

---

## PROMPT (copiar y pegar en Claude Code)

```
Necesito que crees un Agent Team para mejorar el proyecto Matec Radar B2B.
El proyecto es un sistema de prospección B2B con 3 agentes n8n encadenados
y un frontend Next.js. Lee docs/arquitectura.md y docs/ANALISIS_Sistema_v2.md
antes de briefear a los teammates.

Crea los siguientes 6 teammates en paralelo. Cada uno tiene un rol exclusivo.
Usa Sonnet para todos. Todos trabajan en el mismo repo pero en módulos distintos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 1 — Agent02-Radar Engineer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee docs/PROMPT_Agent02_v2.md y aplica los 6 cambios al workflow de n8n.
Tu output es el archivo n8n/wf02-radar/create-wf02.js actualizado.

Cambios requeridos (en orden de prioridad):
1. Fix Construir Query Tavily (Bug 1) — sin keywords la búsqueda es ineficaz
2. Agregar SCORE CAL a Format Final Columns1 (Bug 2) — afecta composite_score
3. Code: Calcular Composite — nuevo nodo que calcula tier_compuesto correctamente
4. Ampliar IF: Tier ORO para WF03 para incluir MONITOREO (Bug 3)
5. Actualizar body de HTTP: Trigger Prospector WF03 con campos correctos (Bug 5)
6. Mover API keys Tavily a referencia de credencial (Bug 4)

IMPORTANTE: No generar el JSON de n8n desde cero. El workflow ya existe en producción.
Solo generar el diff de los nodos que cambian, documentado en un archivo
n8n/wf02-radar/CHANGES_v2.md que Claude Code (en otro pass) puede aplicar con import.

Cuando termines cada cambio, escribe un test manual en n8n/wf02-radar/TEST_v2.md
con el payload de prueba exacto y el resultado esperado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 2 — Agent01-Calificador Engineer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee docs/PROMPT_Agent01_v2.md y aplica los 6 cambios al workflow de n8n.
Tu output principal es n8n/wf01-calificador/CHANGES_v2.md.

Cambios requeridos (en orden de prioridad):
1. Incluir paises[] para multinacionales en el payload a WF02 (Bug 5)
2. Respuesta inmediata al webhook — nodo Respond to Webhook (Bug 2)
3. Manejo de error Tavily — continueOnFail + IF Tavily OK? (Bug 3)
4. Mover API key Tavily a credencial n8n (Bug 1)
5. Aumentar timeout HTTP trigger WF02 a 10s (Bug 4)
6. Verificar/completar Switch Linea Cal. con los 6 Excels (Bug 6)

Para el Bug 5 (paises[]), implementar la lógica:
- Si MULTIPLANTA === "Presencia internacional" → paises: [pais_base, "Mexico", "Chile", "Peru"]
- Si MULTIPLANTA === "Varias sedes regionales" → paises: [pais_base]
- Si el webhook original ya trae paises_extra[] → usar ese array

Para el Bug 2, el webhook n8n debe estar en responseMode: "responseNode".
Si no lo está, documentar el cambio necesario y cómo aplicarlo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 3 — Agent03-Prospector Engineer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee docs/PROMPT_Agent03_v2.md y verifica que el workflow v2.0 ya disponible
en docs/docs_contactos/Agent03_Prospector_v2.0.json esté correcto y completo.

Tu tarea es:
1. Leer el JSON del v2.0 y validar que los 6 cambios documentados están aplicados
2. Si falta algún cambio, aplicarlo y guardar el JSON corregido en
   n8n/wf03-prospector/Agent03_Prospector_v2.1.json
3. Verificar que el nodo "Code: Parse Input" maneja los 3 formatos de input
4. Verificar que "Code: Build Apollo Query" cubre las 6 líneas de negocio
5. Verificar que "IF: Rate Limited?" y "Wait 30s" están correctamente conectados
6. Crear n8n/wf03-prospector/TEST_v2.md con 3 payloads de prueba:
   - Payload tipo WF02 (uppercase fields, tier ORO)
   - Payload tipo frontend (empresa + paises[] array)
   - Payload empresa multinacional con 3 países

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 4 — Frontend Engineer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee docs/PROMPT_Frontend_v2.md y aplica los cambios al proyecto Next.js
en radar-frontend/. Lee también CLAUDE.md del frontend antes de tocar código.

PARTE 1 — Supabase (coordinar con el usuario primero):
- Actualizar .env.local con las variables correctas (NO hardcodear keys)
- Si DB_DRIVER=supabase no funciona por falta de keys, mantener DB_DRIVER=prisma
  y solo hacer los cambios de código que no requieran Supabase activo
- Documentar en radar-frontend/docs/SUPABASE_SETUP.md los pasos exactos
  que el usuario debe seguir para activar Supabase

PARTE 2 — Fixes de código (no requieren Supabase):
1. Agregar las 4 líneas faltantes en LINEA_OPTIONS (Cargo, Motos, Final de Línea, Solumat)
2. Fix del mapping de campos empresa en lib/n8n.ts (empresa→nombre, linea_negocio→linea)
3. Fix de api/prospect/route.ts para incluir tier y paises[] en el payload a WF03
4. Actualizar lib/types.ts — LineaNegocio con los 6 valores

PARTE 3 — Nueva página /calificacion:
Crear app/calificacion/page.tsx — tabla de empresas con score_calificacion,
tier_calculado, fecha de última calificación. Filtros por línea y tier.
Reusar los componentes TierBadge, ScoreBadge, LineaBadge existentes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 5 — QA Engineer (Tests)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee radar-frontend/.claude/skills/senior-qa/SKILL.md antes de empezar.
Tu tarea es escribir los tests que validan la integración entre frontend y n8n.

PARTE 1 — Tests unitarios (Vitest) para la lógica de negocio:
Crear/actualizar radar-frontend/tests/unit/

a) tests/unit/scoring.test.ts — valida la fórmula de composite_score:
   - composite = (score_cal/10)*40 + (score_radar/100)*60
   - ORO si composite >= 70, MONITOREO si 40-69, ARCHIVO si < 40
   - Casos: score_cal=9, score_radar=75 → composite=81 → ORO
   - Casos: score_cal=6, score_radar=50 → composite=54 → MONITOREO
   - Casos: score_cal=3, score_radar=20 → composite=24 → ARCHIVO

b) tests/unit/linea-mapping.test.ts — valida el mapeo de líneas a keywords:
   - "Final de Línea" → keywords contiene "CAPEX" y "embalaje"
   - "BHS" → keywords contiene "aeropuerto" o "terminal"
   - "Intralogística" → keywords contiene "CEDI" o "bodega"

c) tests/unit/paises-expansion.test.ts — valida la expansión multi-país:
   - Empresa multinacional → paises[] tiene ≥ 2 países
   - Empresa local → paises[] tiene exactamente 1 país
   - paises[] nunca tiene duplicados

PARTE 2 — Tests de integración (Vitest) para API routes:
Actualizar radar-frontend/tests/integration/

a) tests/integration/trigger.test.ts — mockear el webhook de n8n y verificar:
   - POST /api/trigger con linea=BHS → llama WF01 con formato correcto
   - Los campos empresa, company_domain, pais, linea_negocio están presentes
   - Registra ejecución en DB

b) tests/integration/api-signals.test.ts — nuevo test:
   - POST /api/signals con señal de WF02 → guarda en DB
   - GET /api/signals?tier=ORO → retorna solo señales ORO
   - GET /api/signals/stats → retorna objeto con totales por tier

PARTE 3 — Tests e2e (Playwright):
Actualizar/crear radar-frontend/tests/e2e/

a) tests/e2e/scan.spec.ts — ampliar para las 6 líneas:
   - Cada línea aparece como opción en el selector
   - El botón "Lanzar Escaneo" solo se activa cuando hay línea seleccionada

b) tests/e2e/pipeline.spec.ts — nuevo test:
   - Después de lanzar un escaneo, el PipelineStatus muestra "En progreso"
   - Después de 30s (mock), muestra el status completado

Usar mocks de n8n webhook en todos los tests. No llamar al n8n real en tests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAMMATE 6 — Code Reviewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee radar-frontend/.claude/skills/code-reviewer/SKILL.md antes de empezar.
Tu tarea es hacer una revisión de seguridad y calidad del proyecto completo.

PARTE 1 — Auditoría de seguridad:
Buscar en todo el proyecto:
a) API keys hardcodeadas en código fuente (no en .env)
b) Endpoints que no validan input (falta validación de body)
c) Errores que exponen detalles internos al usuario
d) Variables de entorno que se exponen al cliente (NEXT_PUBLIC_) con data sensible

PARTE 2 — Revisión de calidad del código n8n:
Revisar los 3 workflows (JSONs en docs/docs_contactos/ y n8n/):
a) ¿Hay nodos con conexiones rotas (se referencia un nodo que no existe)?
b) ¿Hay expresiones que fallarían silenciosamente con datos nulos?
c) ¿El loop devuelve correctamente al SplitInBatches después de cada empresa?
d) ¿Los errores de Apollo 429 se manejan correctamente?

PARTE 3 — Generar reporte:
Crear docs/CODE_REVIEW_v2.md con:
- Hallazgos críticos (bloquean producción)
- Hallazgos medios (deben corregirse antes de lanzar)
- Hallazgos bajos (mejoras opcionales)
- Tabla de deuda técnica priorizada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Coordinación

- Teammates 1, 2, 3 (n8n) pueden trabajar completamente en paralelo
- Teammate 4 (frontend) puede trabajar en paralelo con los n8n
- Teammate 5 (QA) debe esperar a que Teammate 4 termine los cambios en lib/n8n.ts
  antes de escribir los tests de integración (puede hacer los unit tests mientras)
- Teammate 6 (code review) puede trabajar en paralelo con todos

Cuando cada teammate termine, reportar:
- Archivos modificados
- Cambios aplicados vs pendientes
- Bloqueadores encontrados (ej: necesita key de Supabase del usuario)
```

---

## Alternativa — Ejecutar teammates por separado

Si no tenés Agent Teams habilitado, puedes ejecutar cada teammate como una sesión Claude Code separada. El orden recomendado es:

1. **Teammate 3** (WF03 validar v2.0) — sin dependencias, completamente autónomo
2. **Teammates 1 y 2** (WF02 y WF01) — en paralelo, sin dependencias entre sí
3. **Teammate 4** (Frontend fixes) — después de 1 y 2 para asegurarse que el formato de campos es correcto
4. **Teammate 5** (QA) — después del 4
5. **Teammate 6** (Code Review) — después de todos

Para cada uno, abrir Claude Code en el directorio del proyecto y pegar el contenido del bloque del teammate correspondiente.
