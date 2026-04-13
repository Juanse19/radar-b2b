# MEMORIA — Matec Radar B2B Frontend

> Archivo de memoria cross-sesión para Claude Code. Actualizar cuando cambie arquitectura, stack, o estado de módulos.
> Última actualización: 2026-04-13

---

## 1. Arquitectura General

El sistema tiene 3 agentes N8N encadenados. El frontend **solo los dispara y visualiza** — NO es el backend de los agentes.

```
Frontend Next.js
    │
    └── POST /api/trigger → N8N WF01 Calificador (webhook: /calificador, ID: jDtdafuyYt8TXISl)
                                │
                                └── score ≥ 5 → POST /radar-scan → WF02 Radar (ID: fko0zXYYl5X4PtHz)
                                                    │
                                                    └── composite ≥ 40 → POST /prospector → WF03 Prospector (ID: RLUDpi3O5Rb6WEYJ)
```

- **WF01 Calificador**: evalúa empresa con Tavily + GPT-4.1-mini → score 0-10 → tier ORO/MONITOREO/ARCHIVO
- **WF02 Radar**: detecta señales CAPEX/licitación → score_radar 0-100 → composite score
- **WF03 Prospector**: busca contactos Apollo.io → 5 contactos (ORO) / 3 (MONITOREO) → escribe en GSheets

**N8N Host**: `https://n8n.event2flow.com`

El frontend también puede disparar WF02 y WF03 manualmente via `/api/radar` y `/api/prospect`.

---

## 2. Stack Técnico

| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Next.js | 16.2.0 | App Router |
| React | 19.2.4 | — |
| TypeScript | ^5 | — |
| Tailwind CSS | ^4 | CSS-first, `@theme inline` en globals.css — **SIN tailwind.config.ts** |
| shadcn/ui | ^4.1.0 | componentes en `components/ui/` |
| @base-ui/react | ^1.3.0 | — |
| TanStack Query | ^5.91.2 | — |
| TanStack Table | ^8.21.3 | — |
| @supabase/supabase-js | ^2.100.0 | — |
| @supabase/ssr | ^0.10.0 | (devDep) para server components |
| next-themes | ^0.4.6 | dark mode |
| sonner | ^2.0.7 | toasts |
| recharts | ^3.8.1 | gráficas dashboard |
| lucide-react | ^0.577.0 | iconos |
| tw-animate-css | ^1.4.0 | animaciones Tailwind |
| Vitest | ^4.1.0 | tests unitarios/integración |
| Playwright | ^1.58.2 | tests e2e |
| msw | ^2.12.13 | mock service worker para tests |

> Tailwind v4 no usa `tailwind.config.ts`. Los tokens se definen con `@theme inline` directamente en `globals.css`.

---

## 3. IDs de Producción (NO cambiar)

| Componente | ID / Valor |
|-----------|-----------|
| WF01 ID N8N | `jDtdafuyYt8TXISl` |
| WF01 Webhook path | `calificador` |
| WF02 ID N8N | `fko0zXYYl5X4PtHz` |
| WF02 Webhook path | `radar-scan` |
| WF03 ID N8N | `RLUDpi3O5Rb6WEYJ` |
| WF03 Webhook path | `prospector` |
| N8N Host | `https://n8n.event2flow.com` |
| Supabase URL | `https://supabase.valparaiso.cafe` (self-hosted) |
| GSheets Base Datos | `13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818` |
| GSheets Log/Prospectos | `1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo` |

---

## 4. Design System — Tokens CSS

Definidos en `app/globals.css` con Tailwind v4 `@theme inline`. **No usar hex hardcodeados** — siempre usar tokens.

### Modo claro (`:root`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--background` | `#f3f6f8` | fondo general |
| `--surface` | `#ffffff` | cards, paneles |
| `--surface-muted` | `#e8eef3` | superficies secundarias |
| `--foreground` | `#142e47` | texto principal |
| `--primary` | `#142e47` | azul institucional MATEC |
| `--primary-foreground` | `#f7fbff` | texto sobre primary |
| `--secondary` | `#71acd2` | azul claro MATEC |
| `--secondary-foreground` | `#10263a` | — |
| `--muted` | `#e8eef3` | fondo muted |
| `--muted-foreground` | `#60758a` | texto secundario |
| `--border` | `#d2dce4` | bordes |
| `--danger` / `--destructive` | `#941941` | errores, alertas |
| `--success` | `#19816a` | estados ok |
| `--warning` | `#9a3d2d` | advertencias |
| `--sidebar` | `#142e47` | sidebar azul institucional |
| `--sidebar-primary` | `#71acd2` | items activos sidebar |
| `--ring` | `#71acd2` | focus ring |
| `--radius` | `0.625rem` | radio base (variantes: sm/md/lg/xl/2xl/3xl/4xl) |

### Modo oscuro (`.dark`)

| Token | Valor | Cambio notable |
|-------|-------|---------------|
| `--background` | `#0c1e30` | navy profundo |
| `--surface` | `#142e47` | — |
| `--primary` | `#71acd2` | invertido: azul claro se vuelve primary |
| `--primary-foreground` | `#0c1e30` | — |
| `--foreground` | `#ddeaf4` | — |
| `--border` | `#2a4a63` | — |
| `--sidebar` | `#0a1929` | más oscuro que el contenido |
| `--danger` / `--destructive` | `#e05577` | rojo claro |
| `--success` | `#22a98a` | verde brillante |

### Tipografía

- **Display / headings**: Barlow (`var(--font-display)`)
- **UI / tablas**: Inter (`var(--font-ui)`)
- **Mono**: Geist Mono (`var(--font-geist-mono)`)
- Escala fluida con `clamp()`:
  - `h1` / `.heading-xl`: `clamp(1.5rem, 3vw, 2.25rem)`
  - `h2` / `.heading-lg`: `clamp(1.25rem, 2.5vw, 1.75rem)`
  - `h3` / `.heading-md`: `clamp(1.05rem, 2vw, 1.35rem)`
  - `h4` / `.heading-sm`: `1.1rem`

### Clases utilitarias (definidas en globals.css)

- `.heading-xl`, `.heading-lg`, `.heading-md`, `.heading-sm` — tipografía display
- `.text-balance` — `text-wrap: balance`
- `.panel` — card translúcida con backdrop-filter blur(8px)
- `.page-heading` — fuente display con tracking -0.03em
- `.scroll-area-no-bar` — scrollbar invisible
- `.app-shell-grid` — grid layout sidebar(260px) + contenido

---

## 5. Estado de Módulos (Sprint 3.8)

| Módulo | Ruta | Estado | Notas |
|--------|------|--------|-------|
| Dashboard | `/` | ✅ Funcional | KPIs, charts por línea, señales ORO |
| Escanear | `/scan` | ✅ Funcional | 3 tabs: Calificador/Radar/Prospector, 6 líneas |
| Resultados | `/results` | ✅ Funcional | Tabla filtrable señales WF02 |
| Contactos | `/contactos` | ✅ Funcional | Tabla Apollo contacts WF03 |
| Empresas | `/admin/empresas` | ✅ Funcional | CRUD 932 empresas, overflow-x-auto |
| Usuarios | `/admin/usuarios` | ✅ Funcional | CRUD + roles, design tokens aplicados |
| Líneas | `/admin/lineas` | ✅ Funcional | CRUD líneas de negocio |
| Fuentes | `/admin/fuentes` | ✅ Funcional | CRUD fuentes de búsqueda |
| Calificación | `/calificacion` | ⏳ Pendiente | No implementado aún |
| Cronograma | `/schedule` | ✅ Funcional | Programar escaneos automáticos |
| Login | `/login` | ✅ Funcional | Supabase Auth email/password |

---

## 6. Base de Datos — Solo Supabase

- **Antes**: Prisma (SQLite) como fallback + Supabase
- **Ahora (Sprint 3.8)**: migrando a Supabase-only. El fallback SQLite se está eliminando.
- **Supabase URL**: `https://supabase.valparaiso.cafe` (self-hosted)
- **Schema**: `matec_radar` (definido en `SUPABASE_DB_SCHEMA`)
- **Capa de acceso**: `lib/db/index.ts` → facade que llama a `lib/db/supabase/`
- **Regla crítica**: nunca acceder a Supabase directamente en componentes — siempre via `lib/db/index.ts`

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `ejecuciones` | Registro de cada disparo de agente N8N |
| `senales` | Señales de inversión detectadas por WF02 |
| `empresas` | Base de datos de 932 empresas objetivo |
| `contactos` | Contactos encontrados por WF03 (Apollo.io) |
| `usuarios` | Usuarios con roles ADMIN/COMERCIAL/AUXILIAR |

### Timeout de ejecuciones

Ejecuciones en estado `running` o `waiting` por más de **30 minutos** se marcan automáticamente como `timeout` (estado en DB: `'timeout'`, mensaje: `'Sin respuesta del agente (timeout 30 min)'`). Esto ocurre en `getPipelines()` en `lib/db/supabase/ejecuciones.ts` de forma fire-and-forget.

### Inicialización Supabase

```bash
# 1. Ejecutar migración SQL en Supabase SQL Editor:
supabase/migrations/20260408_001_public_schema.sql

# 2. Verificar conexión:
npx tsx scripts/verify_supabase.ts

# 3. Importar empresas desde Excel:
node scripts/import_empresas.js
```

---

## 7. Autenticación

- **Proveedor**: Supabase Auth (email/password)
- **Sesión server-side**: `lib/auth/session.ts`
- **Roles**: `ADMIN`, `COMERCIAL`, `AUXILIAR`
- **Credenciales de prueba**: `juancamilo@matec.com.co` / `Matec2026!`
- **Guards**: todas las API routes están protegidas — sin sesión válida retornan `401`
- **Regla**: `SUPABASE_SERVICE_ROLE_KEY` NUNCA se expone al cliente — solo en routes server-side

---

## 8. Tests E2E

Archivo: `tests/e2e/modules.spec.ts` — 8 tests Playwright

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | Login con credenciales válidas | Redirige fuera de `/login` tras submit |
| 2 | Dashboard — KPIs y señales ORO | Página carga, heading visible, no redirige a login |
| 3 | Escanear — 6 líneas + formulario agentes | Al menos 4 de 6 líneas visibles (BHS, Cartón, Intralogística, Final de Línea, Motos, Solumat) |
| 4 | Señales (results) — tabla de inversión | Página carga sin redirect a login |
| 5 | Contactos — tabla Apollo | Página carga sin redirect a login |
| 6 | Empresas admin — tabla con filtros | Página `/admin/empresas` carga correctamente |
| 7 | TopBar — tema oscuro toggle | Botón `aria-label="Cambiar tema"` activa clase `.dark` en `<html>` |
| 8 | Auth guard — `/api/trigger` sin sesión | POST sin auth retorna HTTP 401 |

Screenshots guardados en `tests/e2e/test-results/` (01- al 08-).

Todos pasaron en Sprint 3.7.

```bash
npx playwright test              # correr todos
npx playwright test --ui         # con UI visual
npm run test                     # Vitest (unit/integration)
```

---

## 9. Convenciones de Desarrollo

### Reglas absolutas

1. **Leer el módulo antes de editar** — no asumir lo que hay
2. **No hardcodear URLs de N8N** — usar variables de entorno (`N8N_HOST`, `N8N_WEBHOOK_PATH`, etc.)
3. **No acceder a Supabase directamente en componentes** — siempre via `lib/db/index.ts`
4. **No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente** — solo en server-side routes
5. **No usar hex hardcodeados** — usar tokens CSS (`bg-primary`, `text-foreground`, `bg-surface`, etc.)
6. **No hardcodear DB_DRIVER** — Supabase only después de Sprint 3.8
7. **Todo nuevo componente UI**: usar shadcn/ui existente antes de crear uno nuevo

### Estructura de páginas

```tsx
// Correcto — AppShell proporciona el padding
export default function MiPage() {
  return (
    <div className="space-y-6">
      <h1 className="heading-xl">Título</h1>
      ...
    </div>
  );
}

// INCORRECTO — no agregar estos en páginas
<div className="min-h-screen bg-background px-4 py-8">
```

### Antes de cualquier PR

```bash
npm run lint    # debe pasar sin errores
npm run test    # Vitest — debe pasar
npm run build   # TypeScript check + build — debe completar
```

### Variables de entorno requeridas (`.env.local`)

```bash
N8N_HOST=https://n8n.event2flow.com
N8N_API_KEY=<n8n-api-key>
N8N_WORKFLOW_ID=jDtdafuyYt8TXISl
N8N_WEBHOOK_PATH=calificador
N8N_RADAR_WORKFLOW_ID=fko0zXYYl5X4PtHz
N8N_RADAR_WEBHOOK_PATH=radar-scan
N8N_PROSPECT_WORKFLOW_ID=RLUDpi3O5Rb6WEYJ
N8N_PROSPECT_WEBHOOK_PATH=prospector
SUPABASE_URL=https://supabase.valparaiso.cafe
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DB_SCHEMA=matec_radar
NEXT_PUBLIC_SUPABASE_URL=https://supabase.valparaiso.cafe
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
BASE_DE_DATOS_SHEET_ID=13C6RJPORu6CPqr1iL0zXU-gUi3eTV-eYo8i-IV9K818
LOG_SHEET_ID=1rtFoTi3ZwNHi9RBidFGcxOHtK6lOvCuhebUB1eS-MGo
```

### Tipo LineaNegocio (6 valores correctos)

```typescript
export type LineaNegocio =
  | 'BHS'
  | 'Cartón'
  | 'Intralogística'
  | 'Cargo'
  | 'Motos'
  | 'Final de Línea'
  | 'Solumat'
  | 'ALL';
```

---

## 10. Bugs Resueltos (Sprint 3.7–3.8)

| Bug | Descripción | Estado |
|-----|-------------|--------|
| Señales empresa_id filter | Señales WF02 no se filtraban por empresa_id | ✅ Resuelto |
| Auth guards | 7 API routes sin protección, retornaban datos sin sesión | ✅ Resuelto |
| Dark mode | Sin soporte tema oscuro (no-op toggle) | ✅ Resuelto |
| Tipografía fluida | Sin escala fluid typography | ✅ Resuelto |
| Hex hardcodeados | `bg-[#142e47]` en páginas admin en lugar de tokens | ✅ Resuelto |
| Layout doble contenedor | `min-h-screen` en páginas causaba doble scroll | ✅ Resuelto |
| Execution tray | Sin botón "Limpiar", sin auto-expiración de ejecuciones | ✅ Resuelto |
| Bug F1 — Solo 4 líneas en /scan | `LINEA_OPTIONS` incompleto (faltaban Cargo, Motos, Final de Línea, Solumat) | ✅ Resuelto |
| Bug F2 — Campo `nombre` vs `empresa` | `lib/n8n.ts` enviaba `nombre` en lugar de `empresa` al webhook WF01 | ✅ Resuelto |

---

## 11. Bugs Activos en Agentes N8N (no frontend)

> Documentados aquí para contexto. Los fixes están en `docs/PROMPT_Agent0X_v2.md`.

| Bug | Agente | Descripción |
|-----|--------|-------------|
| Bug A | WF02 | `SCORE CAL` no se calcula en composite_score (siempre usa score_cal=0) |
| Bug B | WF02 | Solo tier ORO dispara WF03 (case-sensitive equals "ORO") — MONITOREO nunca prospecta |
| Bug C | WF02 | Nodo "Construir Query Tavily" vacío — búsqueda usa query genérica sin keywords |
| Bug D | WF01 | No envía `paises[]` para multinacionales — WF03 no puede hacer búsqueda multi-país |
| Bug E | WF01/WF02 | API keys Tavily hardcodeadas (seguridad) |
| Bug F3 | Frontend `/api/prospect` | No envía `tier` ni `paises[]` a WF03 |
| Bug F4 | `lib/types.ts` | `LineaNegocio` type incompleto (faltan 3 valores) |

---

## 12. Pendientes (Backlog)

| Ítem | Prioridad | Sprint |
|------|-----------|--------|
| `/calificacion` page — implementar resultados WF01 con scores | Media | 3.9 |
| Eliminar Prisma completamente (remover dependencia y archivos) | Alta | 3.8 |
| Supabase URL producción en WF02 (señales se guardan sin empresa_id) | Alta | 3.8 |
| IF: Tiene Menciones false negatives en WF02 | Alta | — |
| Microsoft Excel OAuth renewal en n8n (credential expira) | Alta | Urgente |
| HubSpot integration en /contactos | Media | 4.0 |
| Fixes agentes WF01/WF02 v2.0 (ver docs/PROMPT_Agent0X_v2.md) | Alta | 3.9 |
| Importar WF03 v2.0 JSON en n8n (archivo en docs/) | Alta | Pendiente deploy |

---

## 13. Skills Disponibles

Skills en `radar-frontend/.claude/skills/`:

| Skill | Activar con |
|-------|-------------|
| `code-reviewer` | Auditoría de seguridad y calidad |
| `senior-backend` | Patterns de API y base de datos |
| `senior-frontend` | Best practices React/Next.js |
| `senior-qa` | Generación de tests (Vitest + Playwright) |
| `senior-devops` | CI/CD y deployment |
| `senior-security` | Seguridad y pentesting |

**Para activar**: leer `SKILL.md` del directorio antes de trabajar en esa área.

---

## 14. Payloads de Webhook (referencia rápida)

### POST /api/trigger → WF01

```json
{
  "linea": "Final de Línea",
  "batchSize": 10,
  "empresas": [
    {
      "empresa": "Grupo Nutresa",
      "company_domain": "grupnutresa.com",
      "pais": "Colombia",
      "linea_negocio": "Final de Línea",
      "paises": ["Colombia", "Mexico"]
    }
  ]
}
```

### POST /api/radar → WF02 (disparo manual)

```json
{
  "empresa": "Grupo Bimbo",
  "pais": "Mexico",
  "linea_negocio": "Final de Línea",
  "tier": "ORO",
  "company_domain": "grupobimbo.com",
  "score_calificacion": 9
}
```

### POST /api/prospect → WF03 (disparo manual)

```json
{
  "linea": "Final de Línea",
  "batchSize": 5,
  "contactosPorEmpresa": 5,
  "empresas": [
    {
      "empresa": "Grupo Bimbo",
      "company_domain": "grupobimbo.com",
      "pais": "Mexico",
      "linea_negocio": "Final de Línea",
      "tier": "ORO",
      "paises": ["Mexico", "Colombia"]
    }
  ]
}
```
