# Plan Maestro de Ejecución — Matec Radar B2B v2.0

**Fecha:** Abril 2026 · **Basado en:** Análisis FinancIA + Radar Frontend
**Tiempo total estimado:** ~10 horas distribuidas en 3 días

---

## Estado real del proyecto (lo que ya está listo)

### ✅ Ya construido en radar-frontend
- Shadcn/ui completo: button, card, badge, input, select, dialog, table, tabs...
- TanStack Query + Table (data fetching + tablas)
- Recharts (visualizaciones: KPI, charts, score distribution)
- Páginas: Dashboard `/`, Scan `/scan`, Results `/results`, Empresas `/empresas`, Contactos `/contactos`
- Componentes de dominio: KPIGrid, SignalDetailSheet, PipelineStatus, ScoreBadge, TierBadge
- Dual driver: `lib/db/driver.ts` → Prisma (SQLite) O Supabase según `DB_DRIVER`
- Supabase ya instalado (`@supabase/supabase-js`) con archivos en `lib/db/supabase/`

### ❌ Lo que le falta (por orden de impacto)
1. **Identidad visual MATEC** — sidebar gris genérico, colores oklch sin marca, fuentes Geist
2. **Autenticación** — la app no tiene login, cualquiera puede acceder
3. **Slash commands Claude Code** — no tiene `.claude/commands/`
4. **4 bugs críticos** — 4 líneas faltantes, campo `empresa`, tier/paises[], LineaNegocio
5. **Conexión Supabase activa** — `DB_DRIVER=prisma` en `.env.local`, Supabase keys vacías
6. **n8n MCP: 6 fixes por agente** — ya documentados en PROMPT_Agent0X_v2.md

---

## Mapa de dependencias

```
PASO 0 — Copiar slash commands (5 min · tú · AHORA MISMO)
    ↓
PASO A — Brand MATEC en globals.css + fuentes (30 min · Claude Code)
    ↓
PASO B — Sidebar MATEC: reemplazar Navigation.tsx (30 min · Claude Code)
    ↓ ─────────────────────────────────────────────────────────────────┐
PASO C — 4 bug fixes frontend (30 min · Claude Code)                  │
    ↓                                                                  │
PASO D — Autenticación (login + session + middleware) (2 h · Claude Code)
    ↓
PASO E — Supabase activo (30 min · tú: pegar keys en .env.local)
    ↓ ─────────────────────────────────────────────────────────────────┘
PASO F — n8n WF03 + WF02 + WF01 mejoras vía MCP (2 h · Claude Code)
    ↓
PASO G — Prueba de cadena completa WF01→WF02→WF03→UI (30 min · tú)
    ↓
PASO H — Release v2.0.0 + Git tag
```

---

## PASO 0 — Copiar slash commands de n8n (5 min · TÚ · HAZLO AHORA)

Este paso no requiere Claude Code. Lo haces tú directamente en la terminal:

```bash
# Desde C:\Users\Juan\Documents\Agentic Workflows\clients\radar-frontend
mkdir -p .claude\commands
copy "..\..\..\financia\financia\.claude\commands\n8n-code-js.md"       ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-code-py.md"       ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-mcp-tools.md"     ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-workflow-patterns.md" ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-validation.md"    ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-node-config.md"   ".claude\commands\"
copy "..\..\..\financia\financia\.claude\commands\n8n-expression-syntax.md" ".claude\commands\"
```

**Resultado:** Claude Code en la carpeta `radar-frontend` tendrá acceso a `/n8n-mcp-tools`, `/n8n-validation`, `/n8n-workflow-patterns`, etc. cuando trabaje en los agentes.

---

## PASO A — Brand MATEC: globals.css + tipografías (30 min · Claude Code)

**Rama:** `fix/brand-matec`

```bash
git checkout develop
git checkout -b fix/brand-matec
```

**Prompt para Claude Code:**
```
Lee radar-frontend/CLAUDE.md y docs/ANALISIS_FinancIA_vs_Radar.md.

Trabaja en radar-frontend/.

CAMBIO 1 — app/globals.css:
Reemplaza los valores oklch genéricos del :root con los colores MATEC reales.
Mantén la estructura shadcn (@theme inline, etc.) pero cambia los valores:
  --primary: #142e47          (Azul MATEC — antes era oklch negro)
  --primary-foreground: #f7fbff
  --secondary: #71acd2        (Azul claro MATEC)
  --secondary-foreground: #10263a
  --sidebar: #142e47          (sidebar azul MATEC)
  --sidebar-foreground: #f8fbfd
  --sidebar-primary: #71acd2
  --sidebar-accent: rgba(255,255,255,0.08)
  --destructive: #941941      (Vinotinto MATEC)
  --ring: #71acd2
  --background: #f3f6f8       (fondo MATEC — no blanco puro)
  -- success: #19816a         (verde MATEC — agregar como variable nueva)
  --warning: #9a3d2d          (terracota MATEC — agregar)

También agregar en @theme inline:
  --color-success: var(--success);
  --color-warning: var(--warning);

CAMBIO 2 — app/layout.tsx:
Importar Barlow y Public_Sans de Google Fonts y agregarlas como variables CSS.
Barlow: pesos 500, 600, 700 → variable --font-display
Public_Sans: pesos 400, 500, 600, 700 → variable --font-ui (reemplaza --font-sans)

Aplicar en el body: `className={displayFont.variable} ${uiFont.variable}`

Verificar con: npm run build
```

**Git:**
```bash
git add app/globals.css app/layout.tsx
git commit -m "fix(brand): colores MATEC en globals.css + tipografías Barlow/Public Sans"
```

---

## PASO B — Sidebar MATEC: Navigation.tsx (30 min · Claude Code)

**Continúa en rama `fix/brand-matec`**

**Prompt para Claude Code:**
```
Lee el archivo financia/frontend/src/components/layout/app-shell.tsx como referencia.
Trabaja en radar-frontend/.

Reescribe components/Navigation.tsx para que use la identidad visual MATEC:

CAMBIO 1 — Sidebar azul MATEC (no gris):
  - Fondo: bg-sidebar (que es #142e47 por los tokens que ya pusimos)
  - Texto: text-sidebar-foreground
  - Ítem activo: bg-white/14 text-white
  - Ítem hover: hover:bg-white/8
  - Quitar: bg-gray-900, bg-blue-600

CAMBIO 2 — Header del sidebar con branding:
  Mostrar:
  - Supertítulo: "MATEC" en uppercase tracking-wide, texto blanco/60
  - Título: "Radar B2B" en bold, texto blanco
  - Subtítulo: "Inteligencia Comercial" en texto blanco/70

CAMBIO 3 — Mantener los mismos 6 nav items actuales (no cambiar rutas).

CAMBIO 4 — Footer del sidebar con usuario (opcional, hardcoded por ahora):
  - Nombre del sistema
  - Versión

Verificar con: npm run build
```

**Git:**
```bash
git add components/Navigation.tsx
git commit -m "fix(brand): sidebar MATEC azul + branding Radar B2B"
git push origin fix/brand-matec
# PR: fix/brand-matec → develop
```

---

## PASO C — 4 bug fixes del frontend (30 min · Claude Code)

**Rama:** `fix/frontend-bugs`

```bash
git checkout develop
git checkout -b fix/frontend-bugs
```

**Prompt para Claude Code:**
```
Lee radar-frontend/CLAUDE.md y docs/PROMPT_Frontend_v2.md.
Trabaja en radar-frontend/.

Aplica los 4 bug fixes:

BUG F1 — app/scan/page.tsx:
Busca LINEA_OPTIONS (o el array donde están las líneas de negocio).
Agrega las 4 que faltan: 'Cargo', 'Motos', 'Final de Línea', 'Solumat'
Total debe quedar: BHS/Aeropuertos, Cartón/Papel, Intralogística, Cargo, Motos, Final de Línea, Solumat

BUG F2 — lib/n8n.ts:
En la función que construye el payload para el webhook /calificador (WF01),
cambiar el campo 'nombre' por 'empresa' para que WF01 lo reconozca.

BUG F3 — app/api/prospect/route.ts:
En el body enviado a WF03 (webhook /prospector), agregar:
  - tier: (el tier calculado)
  - paises: (array de países si es multinacional)

BUG F4 — lib/types.ts:
Asegurar que LineaNegocio tenga los 6 valores:
  'BHS' | 'CARTON_PAPEL' | 'INTRALOGISTICA' | 'CARGO' | 'MOTOS' | 'FINAL_LINEA'
  más 'ALL' para búsquedas globales.

Correr al final: npm run lint && npm run test && npm run build
Reportar si todos pasan.
```

**Git:**
```bash
git add app/scan/ lib/n8n.ts app/api/prospect/ lib/types.ts
git commit -m "fix(frontend): 4 bugs — LINEA_OPTIONS, campo empresa, tier/paises[], LineaNegocio"
git push origin fix/frontend-bugs
# PR: fix/frontend-bugs → develop
```

---

## PASO D — Autenticación completa (2 horas · Claude Code)

**Rama:** `feature/auth`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/auth
```

**Prompt para Claude Code:**
```
Lee radar-frontend/CLAUDE.md, docs/ANALISIS_FinancIA_vs_Radar.md.
Lee también estos archivos de FinancIA como referencia de implementación:
  - financia/frontend/src/features/auth/session.ts
  - financia/frontend/src/middleware.ts
  - financia/frontend/src/app/(public)/login/page.tsx
  - financia/frontend/src/features/auth/actions.ts
  - financia/frontend/src/lib/supabase/admin.ts
  - financia/frontend/src/lib/env.ts
  - financia/frontend/src/lib/data-fallback.ts

Trabaja en radar-frontend/.

PARTE 1 — Supabase dual mode (copiar patrón FinancIA):
1. Crear lib/env.ts con hasSupabaseEnv() (igual que FinancIA)
2. Crear lib/data-fallback.ts con withDataFallback() (igual que FinancIA)
3. Crear lib/supabase/client.ts — createSupabaseBrowserClient()
4. Crear lib/supabase/server.ts — createSupabaseServerClient()
5. Crear lib/supabase/admin.ts — createSupabaseAdminClient()
   (adaptar de FinancIA — mismo patrón, misma estructura)

PARTE 2 — Sistema de sesión (adaptar de FinancIA):
6. Crear lib/auth/session.ts:
   - Cookie: "radar_session" (HttpOnly, 8h TTL)
   - SessionUser: { id, name, email, role: "ADMIN" | "COMERCIAL" | "VIEWER" }
   - Funciones: getCurrentSession(), ensureSession(), clearSession()
   - Demo mode: si no hay Supabase, usar usuario demo hardcodeado

7. Crear lib/auth/actions.ts (Server Actions):
   - login(email, password): llama Supabase Auth → setAppSession()
   - logout(): clearSession() + redirect /login

PARTE 3 — Rutas públicas vs privadas:
8. Crear app/(public)/login/page.tsx:
   - Formulario email + contraseña con validación básica
   - Estilo MATEC: fondo #f3f6f8, card blanca, logo "Radar B2B"
   - En modo demo (sin Supabase): email "demo@matec.com.co" entra directo
   
9. Mover el layout actual a app/(private)/layout.tsx:
   - Llamar ensureSession() → redirect /login si no hay sesión
   - Pasar session al Navigation.tsx (para mostrar nombre de usuario)

10. Crear middleware.ts (adaptar de FinancIA):
    - Rutas públicas: /login, /api, /_next
    - Rutas admin-only: /admin/* → solo ADMIN
    - Todo lo demás: cualquier usuario autenticado

PARTE 4 — Actualizar Navigation.tsx:
11. Agregar el bloque de usuario en el footer del sidebar:
    - Mostrar session.name y session.email
    - Botón "Cerrar sesión" que llama logout action

Correr al final: npm run build
```

**Git:**
```bash
git add -A
git commit -m "feat(auth): Supabase Auth + session cookie + login page + middleware MATEC"
git push origin feature/auth
# PR: feature/auth → develop
```

---

## PASO E — Activar Supabase (15 min · TÚ · NO Claude Code)

Esto lo haces tú directamente:

### E.1 — Obtener las keys de Supabase

1. Abrir `https://supabase.valparaiso.cafe` → **Settings → API**
2. Copiar:
   - `anon` (public) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### E.2 — Actualizar `.env.local`

Abrir `radar-frontend/.env.local` y agregar/actualizar:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.valparaiso.cafe
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
# Dejar esto por compatibilidad pero ya no es el principal:
DB_DRIVER=supabase
```

### E.3 — Ejecutar migración SQL

1. Abrir `https://supabase.valparaiso.cafe` → **SQL Editor**
2. Ejecutar el archivo: `radar-frontend/supabase/migrations/20260408_001_public_schema.sql`
3. Verificar que las tablas existen: `empresas`, `ejecuciones`, `senales`, `contactos`

### E.4 — Crear usuario admin

```sql
-- En Supabase SQL Editor
-- Primero crear en Supabase Auth, luego agregar en tabla usuarios:
INSERT INTO public.usuarios (nombre, email, rol, estado_acceso)
VALUES ('Sebastian', 'tatanse20@gmail.com', 'ADMIN', 'ACTIVO');
```

---

## PASO F — Mejoras de los 3 agentes n8n vía MCP (2 horas · Claude Code)

**Abre Claude Code en:** `C:\Users\Juan\Documents\Agentic Workflows\clients`

Las 3 sub-fases se pueden dar en secuencia (1 prompt cada una). Empezar por WF02 que es el más crítico.

### F.1 — WF02 Radar (45 min)

**Rama:** `fix/wf02-v2`
```bash
git checkout develop && git checkout -b fix/wf02-v2
```

**Prompt:**
```
Lee el archivo docs/PROMPT_Agent02_v2.md y ejecútalo completo.
Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "fko0zXYYl5X4PtHz" para leer el workflow.
Aplica los 6 fixes directamente en n8n. Guarda via la API y prueba con los 2 payloads.
```

```bash
git add -A && git commit -m "fix(wf02): SCORE CAL, query Tavily, MONITOREO prospección, composite score v2"
git push origin fix/wf02-v2
```

### F.2 — WF01 Calificador (45 min)

**Rama:** `fix/wf01-v2`
```bash
git checkout develop && git checkout -b fix/wf01-v2
```

**Prompt:**
```
Lee el archivo docs/PROMPT_Agent01_v2.md y ejecútalo completo.
Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "jDtdafuyYt8TXISl" para leer el workflow.
Aplica los 6 fixes directamente en n8n. Guarda via la API y prueba con los 2 payloads.
```

```bash
git add -A && git commit -m "fix(wf01): respuesta inmediata, paises[] multinacional, Tavily error handling"
git push origin fix/wf01-v2
```

### F.3 — WF03 Prospector (20 min)

**Rama:** `fix/wf03-v2`
```bash
git checkout develop && git checkout -b fix/wf03-v2
```

**Prompt:**
```
Lee el archivo docs/PROMPT_Agent03_v2.md y ejecútalo completo.
Tienes acceso al MCP de n8n conectado a https://n8n.event2flow.com.
Usa get_workflow_details con workflowId "RLUDpi3O5Rb6WEYJ" para leer el workflow.
Aplica los 6 cambios directamente en n8n. Guarda via la API y prueba con execute_workflow.
```

```bash
git add -A && git commit -m "feat(wf03): Prospector v2.0 — parse input, job titles, dedup, rate limit"
git push origin fix/wf03-v2
```

---

## PASO G — Prueba de la cadena completa (30 min · TÚ)

Después de que los 3 PRs de agentes estén mergeados en `develop`:

```bash
git checkout develop && git pull origin develop
```

**Prueba end-to-end:**

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

**Verificar en n8n → Executions:**
- [ ] WF01 ejecutó → score asignado → tier ORO o MONITOREO
- [ ] WF02 ejecutó → composite_score calculado → señal detectada
- [ ] WF03 ejecutó → contactos en GSheets tab `Prospectos`

**Verificar en el frontend** (`localhost:3000`):
- [ ] Login funciona con las credenciales de Supabase
- [ ] Sidebar azul MATEC visible
- [ ] Página Scan muestra 6 líneas de negocio (no 4)
- [ ] Los contactos de Nutresa aparecen en `/contactos`

---

## PASO H — Release v2.0.0 (15 min · TÚ)

```bash
# Merge todos los PRs a develop primero, luego:
git checkout main
git pull origin main
git merge --no-ff develop -m "release: v2.0.0 — agentes mejorados + brand MATEC + auth"
git tag -a v2.0.0 -m "v2.0.0: composite score, MONITOREO, paises[], brand MATEC, login"
git push origin main --tags
```

---

## Resumen del orden por días

### DÍA 1 (Hoy) — Base y brand (2 horas)
| Tiempo | Quién | Qué |
|--------|-------|-----|
| 5 min | **Tú** | Paso 0: copiar slash commands |
| 30 min | Claude Code | Paso A: globals.css + fuentes MATEC |
| 30 min | Claude Code | Paso B: Navigation azul MATEC |
| 30 min | Claude Code | Paso C: 4 bug fixes frontend |
| 15 min | **Tú** | Revisar los PRs y mergear a develop |

### DÍA 2 — Auth + Agentes (4 horas)
| Tiempo | Quién | Qué |
|--------|-------|-----|
| 2 h | Claude Code | Paso D: autenticación completa |
| 15 min | **Tú** | Paso E: pegar Supabase keys + SQL |
| 45 min | Claude Code | Paso F.1: WF02 Radar fixes |
| 45 min | Claude Code | Paso F.2: WF01 Calificador fixes |
| 20 min | Claude Code | Paso F.3: WF03 Prospector fixes |

### DÍA 3 — Prueba + Release (1 hora)
| Tiempo | Quién | Qué |
|--------|-------|-----|
| 30 min | **Tú** | Paso G: prueba cadena completa |
| 15 min | **Tú** | Paso H: release v2.0.0 |

---

## Checklist final v2.0.0

### Agents n8n
- [ ] WF01 responde en < 1 segundo al webhook (no deja colgada la UI)
- [ ] WF02 calcula composite_score correctamente (con SCORE CAL)
- [ ] WF02 dispara WF03 para empresas MONITOREO (no solo ORO)
- [ ] WF03 obtiene contactos C-LEVEL primero
- [ ] WF03 maneja rate limit 429 de Apollo con retry 30s
- [ ] No hay API keys hardcodeadas en ningún workflow

### Frontend
- [ ] Sidebar azul #142E47 con logo "Radar B2B · MATEC"
- [ ] Página Scan tiene las 6 líneas de negocio
- [ ] Login funciona (Supabase Auth en modo real, demo en modo local)
- [ ] Middleware protege rutas privadas
- [ ] Fuentes Barlow (títulos) + Public Sans (UI) cargadas

### Datos
- [ ] GSheets tab `Prospectos` recibe contactos después de un scan
- [ ] Base de datos Supabase conectada (no SQLite)

---

## Si en algún paso Claude Code se traba — qué hacer

**Problema: "Workflow not found" en n8n MCP**
→ En Claude Code: escribir `search_workflows` para listar los disponibles
→ Si devuelve vacío: el MCP apunta a n8n equivocado — verificar config en `~/.config/claude/`

**Problema: build falla después de cambios en globals.css**
→ Decirle a Claude Code: "Corre `npm run build` y muéstrame el error"
→ Suele ser que Tailwind v4 necesita que los tokens estén en `@theme inline`

**Problema: login no funciona con Supabase**
→ Verificar que `NEXT_PUBLIC_SUPABASE_URL` está en `.env.local` (con el prefijo `NEXT_PUBLIC_`)
→ Verificar que la migración SQL se ejecutó (la tabla `usuarios` existe)

**Problema: WF03 no escribe en GSheets**
→ Verificar credencial `Google Sheets account 3` en n8n → Settings → Credentials
→ Probar manualmente: n8n → WF03 → botón de test en nodo GSheets
