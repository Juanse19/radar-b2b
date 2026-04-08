# Análisis: FinancIA vs Radar Matec — Qué adoptar y cómo

**Fecha:** Abril 2026
**Propósito:** Comparar la arquitectura de FinancIA con el frontend Radar actual, identificar qué llevar al proyecto, y generar el plan de acción concreto.

---

## 1. Arquitectura de FinancIA (mapa completo)

```
financia/
├── CLAUDE.md                  ← Instrucciones para Claude Code (n8n + Supabase)
├── AGENTS.md                  ← System prompt del agente n8n experto
├── .claude/commands/          ← Slash commands personalizados:
│   ├── n8n-code-js.md         │  /n8n-code-js
│   ├── n8n-code-py.md         │  /n8n-code-py
│   ├── n8n-expression-syntax.md│ /n8n-expression-syntax
│   ├── n8n-mcp-tools.md       │  /n8n-mcp-tools
│   ├── n8n-node-config.md     │  /n8n-node-config
│   ├── n8n-validation.md      │  /n8n-validation
│   └── n8n-workflow-patterns.md│ /n8n-workflow-patterns
│
├── docs/                      ← Documentación técnica completa
│   ├── PRD_financia.md
│   ├── financia_lineamientos_marca_matec.md ← Design system MATEC
│   ├── plan_fase4_front_supabase_mvp.md
│   └── ...
│
├── sql/                       ← Migraciones numeradas secuencialmente
│   ├── 001_...sql → 012_...sql
│
├── n8n/
│   └── workflows/             ← JSONs de workflows bajo control de versiones
│
├── scripts/                   ← Scripts de mantenimiento (backfill, sync, fix)
│
└── frontend/                  ← Next.js App (la parte más madura)
    └── src/
        ├── app/
        │   ├── (public)/      ← /login, /registro (sin auth)
        │   └── (private)/     ← /dashboard, /facturas, /admin/* (con auth)
        ├── features/          ← Módulos por dominio (auth, facturas, usuarios)
        │   └── [dominio]/
        │       ├── actions.ts  ← Server Actions con Zod
        │       ├── schema.ts   ← Validación Zod
        │       └── components/ ← UI del dominio
        ├── services/          ← Capa de datos (Supabase + mock fallback)
        ├── components/
        │   ├── ui/            ← Primitivos (button, card, badge, input)
        │   ├── layout/        ← app-shell.tsx (sidebar + header + footer)
        │   └── dashboard/     ← KPIs, charts, activity feed
        ├── lib/
        │   ├── supabase/      ← client.ts, server.ts, admin.ts
        │   ├── env.ts         ← hasSupabaseEnv() → modo demo vs real
        │   ├── data-fallback.ts ← withDataFallback() para errores recuperables
        │   └── mock-data.ts   ← Datos demo cuando no hay Supabase
        ├── types/domain.ts    ← Todos los tipos TypeScript
        └── middleware.ts      ← Control de acceso por rol (Edge Runtime)
```

### Stack técnico de FinancIA
- **Next.js 16** (App Router, webpack) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** (con `@theme inline` para tokens de diseño)
- **Supabase** (`@supabase/ssr`) — auth + PostgreSQL + Storage
- **TanStack Query** + **TanStack Table** — datos del cliente
- **React Hook Form** + **Zod 4** — formularios y validación
- **Recharts** — visualizaciones
- **Playwright** — tests E2E
- **Barlow** (display) + **Public Sans** (UI) — tipografías de Google Fonts

### Patrón "Dual Mode" (la joya de FinancIA)
```typescript
// lib/env.ts
export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// services/facturas.ts
const result = await withDataFallback(
  () => supabase.from('vw_facturas_bandeja').select(...),  // real
  () => invoices  // mock
);
```
Sin variables de entorno → la app corre con datos ficticios. Con variables → Supabase real.

### Sistema de autenticación de FinancIA
```
Login → Supabase Auth (email/password) 
      → resolveSessionFromSupabaseUser()
      → busca app_usuario por auth_user_id o email
      → escribe cookie HttpOnly "financia_session" (8h)
      → middleware.ts verifica cookie en cada request
      → layout.tsx llama ensureSession() → redirect /login si no hay sesión
```

### Design System MATEC (globals.css)
```css
:root {
  --primary: #142E47;      /* Azul MATEC */
  --secondary: #71ACD2;    /* Azul claro */
  --success: #19816A;      /* Verde */
  --danger: #941941;       /* Vinotinto */
  --warning: #9A3D2D;      /* Terracota */
  --background: #f3f6f8;
  --sidebar: #142E47;
}
/* Fuentes: Barlow (títulos) + Public Sans (UI) */
```

---

## 2. Estado actual del frontend Radar (radar-frontend/)

```
radar-frontend/
├── CLAUDE.md                  ← Instrucciones básicas
├── app/
│   ├── scan/page.tsx          ← Página principal (solo 4 de 6 líneas)
│   ├── api/
│   │   ├── calificador/       ← Proxy a WF01
│   │   └── prospect/          ← Proxy a WF03
│   └── layout.tsx
├── lib/
│   ├── n8n.ts                 ← Funciones de llamada a webhooks
│   ├── types.ts               ← Tipos (LineaNegocio incompleto)
│   └── db/driver.ts           ← DB_DRIVER (Prisma o Supabase)
├── .env.local                 ← DB_DRIVER=prisma, sin Supabase keys
└── supabase/migrations/       ← SQL de migración (no ejecutadas)
```

**Lo que le falta al Radar vs FinancIA:**

| Característica | FinancIA ✅ | Radar Frontend ❌ |
|----------------|------------|-------------------|
| Autenticación | Supabase Auth + cookie | Sin auth |
| Dual mode (demo/real) | `hasSupabaseEnv()` | Sin implementar |
| Error handling Supabase | `withDataFallback()` | Sin implementar |
| Design system MATEC | Completo (globals.css) | Sin definir |
| Tipografías MATEC | Barlow + Public Sans | Predeterminadas |
| Roles y permisos | ADMIN/COORDINADOR/AUXILIAR | Sin roles |
| Middleware de acceso | ✅ edge runtime | Sin implementar |
| Módulos por dominio (features/) | ✅ | Sin estructura |
| Capa de servicios (services/) | ✅ | Sin implementar |
| Server Actions + Zod | ✅ | Sin implementar |
| TanStack Query | ✅ | Sin implementar |
| Slash commands Claude Code | 7 comandos n8n | Sin implementar |

---

## 3. Diagrama de arquitectura objetivo (Radar v2.0)

```
radar-frontend/ (Next.js 16 — App Router)
│
├── .claude/commands/              ← NUEVO: Slash commands para n8n
│   ├── n8n-mcp-tools.md           ← copiar de FinancIA
│   ├── n8n-workflow-patterns.md   ← copiar de FinancIA
│   └── n8n-validation.md          ← copiar de FinancIA
│
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── login/page.tsx     ← NUEVO: login con Supabase Auth
│   │   └── (private)/
│   │       ├── layout.tsx         ← NUEVO: ensureSession()
│   │       ├── dashboard/page.tsx ← NUEVO: KPIs del radar
│   │       ├── scan/page.tsx      ← EXISTENTE: agregar 6 líneas
│   │       ├── prospectos/page.tsx← NUEVO: ver contactos en GSheets
│   │       └── pipeline/page.tsx  ← NUEVO: ver estado WF01→WF02→WF03
│   │
│   ├── features/
│   │   ├── auth/                  ← NUEVO: login, session, logout
│   │   ├── scan/                  ← NUEVO: formulario de scan por línea
│   │   ├── prospectos/            ← NUEVO: tabla de contactos
│   │   └── pipeline/              ← NUEVO: seguimiento de ejecuciones
│   │
│   ├── services/
│   │   ├── ejecuciones.ts         ← NUEVO: leer de Supabase
│   │   ├── prospectos.ts          ← NUEVO: contactos por empresa
│   │   └── empresas.ts            ← NUEVO: base de datos 829 empresas
│   │
│   ├── components/
│   │   ├── ui/                    ← NUEVO: button, card, badge, input
│   │   ├── layout/app-shell.tsx   ← NUEVO: sidebar MATEC
│   │   └── dashboard/             ← NUEVO: KPI cards, charts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          ← NUEVO: cliente browser
│   │   │   ├── server.ts          ← NUEVO: cliente SSR
│   │   │   └── admin.ts           ← NUEVO: cliente service role
│   │   ├── env.ts                 ← NUEVO: hasSupabaseEnv()
│   │   ├── data-fallback.ts       ← NUEVO: withDataFallback()
│   │   ├── mock-data.ts           ← NUEVO: datos demo
│   │   └── n8n.ts                 ← EXISTENTE: mejorar payload
│   │
│   ├── types/domain.ts            ← NUEVO: tipos completos del dominio
│   └── middleware.ts              ← NUEVO: control de acceso por rol
│
└── globals.css                    ← NUEVO: design system MATEC
```

---

## 4. Plan de implementación: Radar → arquitectura FinancIA

### PASO 0 — Copiar los slash commands de n8n (5 min · ya)

```bash
mkdir -p radar-frontend/.claude/commands
cp financia/.claude/commands/n8n-*.md radar-frontend/.claude/commands/
```

Esto le da a Claude Code los comandos `/n8n-mcp-tools`, `/n8n-validation`, etc. cuando trabaje en el Radar.

### PASO 1 — Design system MATEC (30 min · frontend)

**Archivo:** `radar-frontend/src/app/globals.css`

Copiar exactamente el sistema de tokens de FinancIA:
```css
:root {
  --background: #f3f6f8;
  --foreground: #142e47;
  --surface: #ffffff;
  --surface-muted: #e8eef3;
  --border: #d2dce4;
  --sidebar: #142e47;
  --sidebar-foreground: #f8fbfd;
  --primary: #142e47;
  --primary-foreground: #f7fbff;
  --secondary: #71acd2;
  --secondary-foreground: #10263a;
  --success: #19816a;
  --warning: #9a3d2d;
  --danger: #941941;
  --muted: #60758a;
}
```

**Archivo:** `radar-frontend/src/app/layout.tsx`

Agregar tipografías MATEC (igual que FinancIA):
```typescript
import { Barlow, Public_Sans } from "next/font/google";
const displayFont = Barlow({ variable: "--font-display", weight: ["500","600","700"] });
const uiFont = Public_Sans({ variable: "--font-ui", weight: ["400","500","600","700"] });
```

### PASO 2 — Librería de componentes UI (1 hora)

Copiar los componentes base de FinancIA a `radar-frontend/src/components/ui/`:
- `button.tsx` — botón con variantes (primary, secondary, ghost)
- `card.tsx` — card panel con sombra y borde
- `badge.tsx` — badge de estado (success, warning, danger)
- `input.tsx` — input con label y error state
- `select.tsx` — select con opciones

### PASO 3 — AppShell / Sidebar MATEC (1 hora)

Copiar y adaptar `app-shell.tsx` de FinancIA al Radar.

Navegación del Radar:
```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/scan", label: "Nuevo Scan", icon: Search },
  { href: "/prospectos", label: "Prospectos", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Activity },
  { href: "/admin/empresas", label: "Empresas", icon: Building, roles: ["ADMIN"] },
]
```

### PASO 4 — Supabase dual mode (2 horas)

Copiar exactamente de FinancIA:

**`lib/supabase/client.ts`** — `createSupabaseBrowserClient()`
**`lib/supabase/server.ts`** — `createSupabaseServerClient()`
**`lib/supabase/admin.ts`** — `createSupabaseAdminClient()` (service role)
**`lib/env.ts`** — `hasSupabaseEnv()`
**`lib/data-fallback.ts`** — `withDataFallback()` (copiar exacto)
**`lib/mock-data.ts`** — datos demo del Radar (empresas, ejecuciones, prospectos)

El patrón de cada service quedará así:
```typescript
// services/ejecuciones.ts
export async function getEjecuciones() {
  return withDataFallback(
    async () => {
      const admin = createSupabaseAdminClient();
      return admin.schema('public').from('ejecuciones').select('*');
    },
    () => mockEjecuciones  // datos demo
  );
}
```

### PASO 5 — Autenticación (2 horas)

Copiar el sistema de auth de FinancIA casi sin cambios:

**`features/auth/session.ts`** — `getCurrentSession()`, `ensureSession()`, `clearSession()`
**`features/auth/actions.ts`** — Server Action `login()`, `logout()`
**`app/(public)/login/page.tsx`** — página de login
**`app/(private)/layout.tsx`** — layout con `ensureSession()`
**`middleware.ts`** — control de acceso por rol

Roles del Radar:
```typescript
type UserRole = "ADMIN" | "COMERCIAL" | "VIEWER";
// ADMIN: todo
// COMERCIAL: scan + prospectos + pipeline
// VIEWER: solo dashboard + prospectos (solo lectura)
```

### PASO 6 — Schema Supabase del Radar (1 hora)

Crear el SQL de migración basado en el modelo de FinancIA (misma estructura, diferente dominio):

```sql
-- sql/001_radar_schema.sql
create schema if not exists public;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nombre text not null,
  email text not null unique,
  rol text not null check (rol in ('ADMIN', 'COMERCIAL', 'VIEWER')),
  estado_acceso text not null default 'PENDIENTE',
  creado_en timestamptz default now()
);

create table if not exists public.ejecuciones (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  pais text,
  linea_negocio text,
  tier text,
  composite_score numeric,
  estado text default 'PROCESANDO',
  wf01_ejecutado_en timestamptz,
  wf02_ejecutado_en timestamptz,
  wf03_ejecutado_en timestamptz,
  creado_en timestamptz default now()
);

create table if not exists public.prospectos (
  id text primary key,  -- formato: EMPRESA-PAIS-001
  empresa text not null,
  pais text,
  nombre text,
  apellido text,
  cargo text,
  nivel text,           -- C-LEVEL, DIRECTOR, GERENTE, JEFE
  email_verificado text,
  linkedin text,
  linea_negocio text,
  tier text,
  es_multinacional boolean default false,
  fecha timestamptz default now(),
  ejecucion_id uuid references public.ejecuciones(id)
);
```

---

## 5. Qué diferencia al Radar de FinancIA (no copiar ciegamente)

| Aspecto | FinancIA | Radar |
|---------|----------|-------|
| Dominio | Facturas electrónicas | Prospección B2B |
| Schema SQL | `financiero` | `public` |
| Roles | ADMIN/COORDINADOR/AUXILIAR | ADMIN/COMERCIAL/VIEWER |
| Datos principales | facturas | prospectos + empresas + ejecuciones |
| Flujo de datos | Email → n8n → Supabase → UI | Frontend → WF01→WF02→WF03 → GSheets → UI |
| Complejidad n8n | 1 workflow (invoice processing) | 3 agentes encadenados |
| Slash commands | /n8n-code-js, /n8n-node-config, etc. | Los mismos + /apollo-search |

---

## 6. Orden de ejecución recomendado

```
AHORA (antes de tocar código):
  → Copiar .claude/commands/ de FinancIA al Radar (5 min)
  → Actualizar CLAUDE.md del frontend con la arquitectura objetivo

SEMANA 1 (después de Fases 1a+1b+1c de agentes):
  → Paso 1: globals.css + tipografías (30 min)
  → Paso 2: componentes UI (1 hora)
  → Paso 3: AppShell MATEC (1 hora)

SEMANA 2:
  → Paso 4: Supabase dual mode (2 horas)
  → Paso 5: Auth (2 horas)
  → Paso 6: Schema SQL + migración (1 hora)

SEMANA 3:
  → Conectar services a Supabase
  → Dashboard de KPIs reales (ejecuciones, prospectos por línea)
  → Pipeline view (seguimiento WF01→WF02→WF03 en tiempo real)
```

---

## 7. Prompt para Claude Code — Fase 2 Frontend (versión mejorada)

```
Lee radar-frontend/CLAUDE.md, clients/CLAUDE.md, y el archivo
docs/ANALISIS_FinancIA_vs_Radar.md para entender el plan completo.

También lee estos archivos de FinancIA como referencia de implementación:
- financia/frontend/src/app/globals.css          (design system)
- financia/frontend/src/lib/supabase/server.ts   (cliente Supabase SSR)
- financia/frontend/src/lib/env.ts               (hasSupabaseEnv)
- financia/frontend/src/lib/data-fallback.ts     (withDataFallback)
- financia/frontend/src/features/auth/session.ts (auth session)
- financia/frontend/src/middleware.ts            (control acceso)
- financia/frontend/src/components/layout/app-shell.tsx (sidebar)

Trabaja en radar-frontend/.

PARTE 1 — Design system MATEC (adaptar de FinancIA):
1. Reemplazar globals.css con los tokens de diseño MATEC exactos
2. Agregar Barlow + Public Sans en app/layout.tsx
3. Crear src/components/ui/ con: button.tsx, card.tsx, badge.tsx, input.tsx

PARTE 2 — Supabase dual mode (copiar patrón de FinancIA):
4. Crear lib/supabase/client.ts, server.ts, admin.ts
5. Crear lib/env.ts con hasSupabaseEnv()
6. Crear lib/data-fallback.ts con withDataFallback()
7. Crear lib/mock-data.ts con datos demo del Radar

PARTE 3 — Bug fixes del frontend (de PROMPT_Frontend_v2.md):
8. Fix F1: agregar 4 líneas en LINEA_OPTIONS (scan/page.tsx)
9. Fix F2: campo 'empresa' en payload WF01 (lib/n8n.ts)
10. Fix F3: tier + paises[] en payload WF03
11. Fix F4: LineaNegocio con 6 valores en types.ts

Correr al final: npm run lint && npm run typecheck && npm run build
```

---

## 8. Resumen ejecutivo: FinancIA es el blueprint

FinancIA tiene resuelto exactamente lo que el Radar necesita:

1. **Autenticación real** → copiar sistema cookie HttpOnly (session.ts)
2. **Supabase sin romper nada** → copiar dual mode (hasSupabaseEnv + withDataFallback)
3. **Identidad visual MATEC** → copiar globals.css + tipografías
4. **Sidebar profesional** → copiar app-shell.tsx y adaptar nav items
5. **Estructura escalable** → adoptar features/ + services/ + types/domain.ts
6. **n8n best practices** → copiar .claude/commands/ al Radar

La diferencia es el dominio: FinancIA gestiona facturas, el Radar gestiona prospección. El 80% del código de infraestructura se puede adaptar directamente.
